import postgres from "postgres";

// Supabase(Postgres) 연결.
// 연결 문자열은 환경변수 DATABASE_URL 에 둔다 (.env.local / Vercel 환경변수).
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

function createSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL 환경변수가 없습니다.");
  }
  // Supabase는 SSL 필요. prepare:false 는 pgbouncer 풀러 호환.
  return postgres(url, { ssl: "require", prepare: false });
}

export const sql = globalForDb.__sql ?? createSql();
if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

// 테이블 생성 (최초 1회). API에서 ensureSchema()를 호출해 보장.
let schemaReady: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = migrate();
  return schemaReady;
}

// 데이터가 묶이는 단위. household_id(가구) 기준으로 공유.
const DATA_TABLES = [
  "accounts", "transactions", "recurring_items",
  "holdings", "properties", "goals", "net_worth_snapshots",
];

async function migrate() {
  // 가구(가계부) — 여러 사용자가 하나의 household를 공유
  await sql`
    CREATE TABLE IF NOT EXISTS households (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '우리집',
      invite_code TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // 사용자(구글 계정). 어느 household에 속하는지 household_id로 연결.
  // ⚠️ 이름이 'users'면 Supabase의 시스템 auth 테이블과 혼동되므로 app_users 사용.
  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      image TEXT,
      household_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // 데이터 테이블들 — household_id 기준
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id BIGSERIAL PRIMARY KEY,
      household_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'checking',
      balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      household_id BIGINT NOT NULL,
      account_id BIGINT,
      kind TEXT NOT NULL,
      category TEXT,
      memo TEXT,
      amount DOUBLE PRECISION NOT NULL,
      date TEXT NOT NULL,
      recurring_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS recurring_items (
      id BIGSERIAL PRIMARY KEY,
      household_id BIGINT NOT NULL,
      account_id BIGINT,
      kind TEXT NOT NULL,
      category TEXT,
      memo TEXT,
      amount DOUBLE PRECISION NOT NULL,
      day_of_month INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS holdings (
      id BIGSERIAL PRIMARY KEY,
      household_id BIGINT NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT,
      market TEXT NOT NULL DEFAULT 'US',
      shares DOUBLE PRECISION NOT NULL DEFAULT 0,
      avg_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      dca_monthly DOUBLE PRECISION NOT NULL DEFAULT 0,
      dca_expected_return DOUBLE PRECISION NOT NULL DEFAULT 7,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS properties (
      id BIGSERIAL PRIMARY KEY,
      household_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      market_value DOUBLE PRECISION NOT NULL DEFAULT 0,
      loan_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      loan_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
      monthly_payment DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS goals (
      id BIGSERIAL PRIMARY KEY,
      household_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      target_amount DOUBLE PRECISION NOT NULL,
      target_date TEXT NOT NULL,
      expected_return DOUBLE PRECISION NOT NULL DEFAULT 7,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id BIGSERIAL PRIMARY KEY,
      household_id BIGINT NOT NULL,
      ym TEXT NOT NULL,
      total_assets DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_debt DOUBLE PRECISION NOT NULL DEFAULT 0,
      net_worth DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(household_id, ym)
    )`;

  // 기존 user_id 기반 스키마에서 올라온 경우 → household_id 컬럼 보강 (안전 마이그레이션)
  for (const t of DATA_TABLES) {
    await sql.unsafe(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS household_id BIGINT`);
    // 예전 user_id 데이터가 있으면 household 1로 귀속
    await sql.unsafe(`UPDATE ${t} SET household_id = 1 WHERE household_id IS NULL`);
    // 예전 user_id 컬럼이 NOT NULL로 남아 있으면 INSERT가 막힌다 → 제약 해제 (컬럼 있을 때만)
    await sql.unsafe(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='${t}' AND column_name='user_id' AND is_nullable='NO'
        ) THEN
          EXECUTE 'ALTER TABLE ${t} ALTER COLUMN user_id DROP NOT NULL';
        END IF;
      END $$;`);
  }
  // app_users 컬럼 보강 (예전 버전 대비)
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS household_id BIGINT`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS image TEXT`;
}

/**
 * 사용자 이메일로 household_id를 찾거나 새로 만든다.
 * - 처음 로그인하는 사용자 → 새 household 생성하고 그 주인이 됨
 * - 이미 있는 사용자 → 자기 household_id 반환
 */
export async function getOrCreateHouseholdForEmail(
  email: string, name?: string | null, image?: string | null
): Promise<number> {
  await ensureSchema();
  const existing = await sql<{ household_id: number | null }[]>`
    SELECT household_id FROM app_users WHERE email=${email} LIMIT 1`;

  if (existing.length > 0) {
    let hid = existing[0].household_id;
    if (!hid) {
      hid = await createHousehold();
      await sql`UPDATE app_users SET household_id=${hid} WHERE email=${email}`;
    }
    // 프로필 최신화
    await sql`UPDATE app_users SET name=${name ?? null}, image=${image ?? null} WHERE email=${email}`;
    return hid;
  }

  // 신규 사용자 → 새 가구 생성
  const hid = await createHousehold();
  await sql`INSERT INTO app_users (email, name, image, household_id) VALUES (${email}, ${name ?? null}, ${image ?? null}, ${hid})`;
  return hid;
}

async function createHousehold(): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    INSERT INTO households (name) VALUES ('우리집') RETURNING id`;
  return rows[0].id;
}
