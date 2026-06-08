import postgres from "postgres";

// Supabase(Postgres) 연결.
// 연결 문자열은 환경변수 DATABASE_URL 에 둔다 (.env.local / Vercel 환경변수).
// Supabase 대시보드 → Project Settings → Database → Connection string(URI) 값.
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

function createSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL 환경변수가 없습니다. .env.local 에 Supabase 연결 문자열을 넣어주세요."
    );
  }
  // Supabase는 SSL 필요. prepare:false 는 (pgbouncer 풀러 호환).
  return postgres(url, { ssl: "require", prepare: false });
}

export const sql = globalForDb.__sql ?? createSql();
if (process.env.NODE_ENV !== "production") globalForDb.__sql = sql;

// 현재는 단일 사용자(1) 고정. 구글 로그인 추가 시 이 값을 세션 사용자로 교체.
export const CURRENT_USER_ID = 1;

// 테이블 생성 (최초 1회). API에서 ensureSchema()를 호출해 보장.
let schemaReady: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = migrate();
  return schemaReady;
}

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'me',
      email TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'checking',
      balance DOUBLE PRECISION NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
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
      user_id BIGINT NOT NULL,
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
      user_id BIGINT NOT NULL,
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
      user_id BIGINT NOT NULL,
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
      user_id BIGINT NOT NULL,
      name TEXT NOT NULL,
      target_amount DOUBLE PRECISION NOT NULL,
      target_date TEXT NOT NULL,
      expected_return DOUBLE PRECISION NOT NULL DEFAULT 7,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      ym TEXT NOT NULL,
      total_assets DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_debt DOUBLE PRECISION NOT NULL DEFAULT 0,
      net_worth DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, ym)
    )`;
  // 기본 사용자 보장
  await sql`INSERT INTO users (id, name) VALUES (1, 'me') ON CONFLICT (id) DO NOTHING`;
}
