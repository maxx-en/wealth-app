import { sql, ensureSchema } from "./db";

// 모든 쿼리는 household_id(가구) 기준. 호출 전 스키마 보장.
async function ready() { await ensureSchema(); }

// ---------- 타입 ----------
export type Account = {
  id: number; household_id: number; name: string; type: string;
  balance: number; sort_order: number;
  // base_balance: 마지막으로 직접 입력한 기준 잔액 (DB의 balance 원본)
  // balance: 표시 잔액 = base_balance + 기준 시각 이후 거래 합 (계산값)
  base_balance?: number;
};
export type Transaction = {
  id: number; household_id: number; account_id: number | null; kind: string;
  category: string | null; memo: string | null; amount: number; date: string;
  recurring_id: number | null;
};
export type RecurringItem = {
  id: number; household_id: number; account_id: number | null; kind: string;
  category: string | null; memo: string | null; amount: number;
  day_of_month: number; active: number;
};
export type Holding = {
  id: number; household_id: number; symbol: string; name: string | null;
  market: string; shares: number; avg_cost: number; currency: string;
  dca_monthly: number; dca_expected_return: number;
};
export type Property = {
  id: number; household_id: number; name: string; market_value: number;
  loan_balance: number; loan_rate: number; monthly_payment: number;
};
export type Goal = {
  id: number; household_id: number; name: string; target_amount: number;
  target_date: string; expected_return: number;
};

// ---------- 설정(키-값 캐시) ----------
const DEFAULT_USD_KRW = 1400; // 환율을 한 번도 안 가져온 신규 유저 기본값

/** 마지막으로 저장된 환율을 즉시 반환 (외부 호출 없음). 없으면 기본값 1400. */
export async function getCachedUsdKrw(hid: number): Promise<number> {
  await ready();
  const rows = await sql<{ value: string }[]>`
    SELECT value FROM household_settings WHERE household_id=${hid} AND key='usd_krw' LIMIT 1`;
  const v = rows[0]?.value ? Number(rows[0].value) : NaN;
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_USD_KRW;
}

/** 환율 새로고침 시 가져온 값을 저장 (다음 접속 때 이 값으로 즉시 표시). */
export async function setCachedUsdKrw(hid: number, rate: number) {
  await ready();
  await sql`
    INSERT INTO household_settings (household_id, key, value, updated_at)
    VALUES (${hid}, 'usd_krw', ${String(rate)}, now())
    ON CONFLICT (household_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`;
}

/** 마지막으로 저장된 종목 시세 맵 { 심볼: 현재가 }. 외부 호출 없이 즉시 반환. */
export async function getCachedQuotes(hid: number): Promise<Record<string, number>> {
  await ready();
  const rows = await sql<{ value: string }[]>`
    SELECT value FROM household_settings WHERE household_id=${hid} AND key='quotes' LIMIT 1`;
  if (!rows[0]?.value) return {};
  try { return JSON.parse(rows[0].value) as Record<string, number>; }
  catch { return {}; }
}

/** 주가 업데이트 시 가져온 시세를 저장 → 대시보드가 이 값으로 평가액을 즉시 계산. */
export async function setCachedQuotes(hid: number, prices: Record<string, number>) {
  await ready();
  await sql`
    INSERT INTO household_settings (household_id, key, value, updated_at)
    VALUES (${hid}, 'quotes', ${JSON.stringify(prices)}, now())
    ON CONFLICT (household_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`;
}

// ---------- 계좌 ----------
// 표시 잔액 = 기준 잔액(balance) + 기준 시각(balance_updated_at) 이후 그 계좌의 거래 합.
// 수입은 +, 지출/저축은 − 로 누적. "기준 시각 이후"는 거래의 실제 입력 시점(created_at) 기준.
export async function getAccounts(hid: number): Promise<Account[]> {
  await ready();
  const rows = await sql<(Account & { base_balance: number })[]>`
    SELECT a.id, a.household_id, a.name, a.type, a.sort_order,
      a.balance AS base_balance,
      a.balance + COALESCE((
        SELECT SUM(CASE WHEN t.kind='income' THEN t.amount ELSE -t.amount END)
        FROM transactions t
        WHERE t.account_id = a.id AND t.created_at > a.balance_updated_at
      ), 0) AS balance
    FROM accounts a
    WHERE a.household_id=${hid}
    ORDER BY a.sort_order, a.id`;
  return rows;
}
export async function addAccount(hid: number, name: string, type: string, balance: number) {
  await ready();
  // 새 계좌는 지금이 기준 시각
  await sql`INSERT INTO accounts (household_id,name,type,balance,balance_updated_at) VALUES (${hid},${name},${type},${balance},now())`;
}
export async function updateAccount(hid: number, id: number, name: string, type: string, balance: number) {
  await ready();
  // 잔액을 직접 수정하면 그 순간을 새 기준 시각으로 → 이후 거래만 다시 누적된다
  await sql`UPDATE accounts SET name=${name},type=${type},balance=${balance},balance_updated_at=now() WHERE id=${id} AND household_id=${hid}`;
}
export async function deleteAccount(hid: number, id: number) {
  await ready();
  await sql`DELETE FROM accounts WHERE id=${id} AND household_id=${hid}`;
}

// ---------- 거래 ----------
export async function getTransactions(hid: number, ym?: string): Promise<Transaction[]> {
  await ready();
  if (ym) return await sql<Transaction[]>`
    SELECT * FROM transactions WHERE household_id=${hid} AND substr(date,1,7)=${ym}
    ORDER BY date DESC, id DESC`;
  return await sql<Transaction[]>`SELECT * FROM transactions WHERE household_id=${hid} ORDER BY date DESC, id DESC`;
}
export async function addTransaction(hid: number, t: Omit<Transaction, "id" | "household_id">) {
  await ready();
  await sql`INSERT INTO transactions (household_id,account_id,kind,category,memo,amount,date,recurring_id)
    VALUES (${hid},${t.account_id},${t.kind},${t.category},${t.memo},${t.amount},${t.date},${t.recurring_id ?? null})`;
}
export async function deleteTransaction(hid: number, id: number) {
  await ready();
  await sql`DELETE FROM transactions WHERE id=${id} AND household_id=${hid}`;
}

// 월별 합계
export async function monthlySummary(hid: number, ym: string) {
  await ready();
  const rows = await sql<{ kind: string; total: number }[]>`
    SELECT kind, SUM(amount) as total FROM transactions
    WHERE household_id=${hid} AND substr(date,1,7)=${ym} GROUP BY kind`;
  const out = { income: 0, expense: 0, saving: 0 };
  rows.forEach((r) => {
    if (r.kind === "income") out.income = Number(r.total);
    else if (r.kind === "expense") out.expense = Number(r.total);
    else if (r.kind === "saving") out.saving = Number(r.total);
  });
  return out;
}

// 카테고리별 합계
export async function categoryBreakdown(hid: number, ym: string, kind: string) {
  await ready();
  return await sql<{ category: string; total: number; cnt: number }[]>`
    SELECT COALESCE(category,'미분류') as category, SUM(amount) as total, COUNT(*)::int as cnt
    FROM transactions WHERE household_id=${hid} AND kind=${kind} AND substr(date,1,7)=${ym}
    GROUP BY category ORDER BY total DESC`;
}

// 최근 N개월 추이
export async function monthlyTrend(hid: number, months: number) {
  await ready();
  const rows = await sql<{ ym: string; kind: string; total: number }[]>`
    SELECT substr(date,1,7) as ym, kind, SUM(amount) as total
    FROM transactions WHERE household_id=${hid} GROUP BY ym, kind ORDER BY ym`;
  const map: Record<string, { ym: string; income: number; expense: number; saving: number }> = {};
  rows.forEach((r) => {
    if (!map[r.ym]) map[r.ym] = { ym: r.ym, income: 0, expense: 0, saving: 0 };
    (map[r.ym] as any)[r.kind] = Number(r.total);
  });
  const all = Object.values(map).sort((a, b) => a.ym.localeCompare(b.ym));
  return all.slice(-months);
}

// ---------- 정기항목 ----------
export async function getRecurringItems(hid: number): Promise<RecurringItem[]> {
  await ready();
  return await sql<RecurringItem[]>`SELECT * FROM recurring_items WHERE household_id=${hid} ORDER BY day_of_month, id`;
}
export async function addRecurringItem(hid: number, r: Omit<RecurringItem, "id" | "household_id" | "active">) {
  await ready();
  await sql`INSERT INTO recurring_items (household_id,account_id,kind,category,memo,amount,day_of_month)
    VALUES (${hid},${r.account_id},${r.kind},${r.category},${r.memo},${r.amount},${r.day_of_month})`;
}
export async function deleteRecurringItem(hid: number, id: number) {
  await ready();
  await sql`DELETE FROM recurring_items WHERE id=${id} AND household_id=${hid}`;
}
export async function toggleRecurringItem(hid: number, id: number, active: number) {
  await ready();
  await sql`UPDATE recurring_items SET active=${active} WHERE id=${id} AND household_id=${hid}`;
}

/** 정기항목을 특정 월의 거래로 생성 (중복 방지) */
export async function materializeRecurring(hid: number, ym: string): Promise<number> {
  await ready();
  const items = (await getRecurringItems(hid)).filter((i) => i.active);
  let created = 0;
  for (const it of items) {
    const exists = await sql`
      SELECT 1 FROM transactions WHERE household_id=${hid} AND recurring_id=${it.id} AND substr(date,1,7)=${ym} LIMIT 1`;
    if (exists.length > 0) continue;
    const day = String(Math.min(it.day_of_month, 28)).padStart(2, "0");
    const date = `${ym}-${day}`;
    await sql`INSERT INTO transactions (household_id,account_id,kind,category,memo,amount,date,recurring_id)
      VALUES (${hid},${it.account_id},${it.kind},${it.category},${it.memo},${it.amount},${date},${it.id})`;
    created++;
  }
  return created;
}

// ---------- 주식 ----------
export async function getHoldings(hid: number): Promise<Holding[]> {
  await ready();
  return await sql<Holding[]>`SELECT * FROM holdings WHERE household_id=${hid} ORDER BY id`;
}
export async function addHolding(hid: number, h: Omit<Holding, "id" | "household_id">) {
  await ready();
  await sql`INSERT INTO holdings (household_id,symbol,name,market,shares,avg_cost,currency,dca_monthly,dca_expected_return)
    VALUES (${hid},${h.symbol},${h.name},${h.market},${h.shares},${h.avg_cost},${h.currency},${h.dca_monthly},${h.dca_expected_return})`;
}
export async function updateHolding(hid: number, id: number, h: Omit<Holding, "id" | "household_id">) {
  await ready();
  await sql`UPDATE holdings SET symbol=${h.symbol},name=${h.name},market=${h.market},shares=${h.shares},
    avg_cost=${h.avg_cost},currency=${h.currency},dca_monthly=${h.dca_monthly},dca_expected_return=${h.dca_expected_return}
    WHERE id=${id} AND household_id=${hid}`;
}
export async function deleteHolding(hid: number, id: number) {
  await ready();
  await sql`DELETE FROM holdings WHERE id=${id} AND household_id=${hid}`;
}

// ---------- 부동산 ----------
export async function getProperties(hid: number): Promise<Property[]> {
  await ready();
  return await sql<Property[]>`SELECT * FROM properties WHERE household_id=${hid} ORDER BY id`;
}
export async function addProperty(hid: number, p: Omit<Property, "id" | "household_id">) {
  await ready();
  await sql`INSERT INTO properties (household_id,name,market_value,loan_balance,loan_rate,monthly_payment)
    VALUES (${hid},${p.name},${p.market_value},${p.loan_balance},${p.loan_rate},${p.monthly_payment})`;
}
export async function updateProperty(hid: number, id: number, p: Omit<Property, "id" | "household_id">) {
  await ready();
  await sql`UPDATE properties SET name=${p.name},market_value=${p.market_value},loan_balance=${p.loan_balance},
    loan_rate=${p.loan_rate},monthly_payment=${p.monthly_payment} WHERE id=${id} AND household_id=${hid}`;
}
export async function deleteProperty(hid: number, id: number) {
  await ready();
  await sql`DELETE FROM properties WHERE id=${id} AND household_id=${hid}`;
}

// ---------- 목표 ----------
export async function getGoals(hid: number): Promise<Goal[]> {
  await ready();
  return await sql<Goal[]>`SELECT * FROM goals WHERE household_id=${hid} ORDER BY target_date`;
}
export async function addGoal(hid: number, g: Omit<Goal, "id" | "household_id">) {
  await ready();
  await sql`INSERT INTO goals (household_id,name,target_amount,target_date,expected_return)
    VALUES (${hid},${g.name},${g.target_amount},${g.target_date},${g.expected_return})`;
}
export async function deleteGoal(hid: number, id: number) {
  await ready();
  await sql`DELETE FROM goals WHERE id=${id} AND household_id=${hid}`;
}

// ---------- 순자산 스냅샷 ----------
export async function getSnapshots(hid: number) {
  await ready();
  return await sql<{ id: number; ym: string; total_assets: number; total_debt: number; net_worth: number }[]>`
    SELECT * FROM net_worth_snapshots WHERE household_id=${hid} ORDER BY ym`;
}
export async function saveSnapshot(hid: number, ym: string, assets: number, debt: number) {
  await ready();
  await sql`
    INSERT INTO net_worth_snapshots (household_id,ym,total_assets,total_debt,net_worth)
    VALUES (${hid},${ym},${assets},${debt},${assets - debt})
    ON CONFLICT (household_id,ym) DO UPDATE SET
      total_assets=EXCLUDED.total_assets, total_debt=EXCLUDED.total_debt, net_worth=EXCLUDED.net_worth`;
}

// ---------- 가구/초대 ----------
export async function getHousehold(hid: number) {
  await ready();
  const rows = await sql<{ id: number; name: string; invite_code: string | null }[]>`
    SELECT id, name, invite_code FROM households WHERE id=${hid}`;
  return rows[0] ?? null;
}

export async function getHouseholdMembers(hid: number) {
  await ready();
  return await sql<{ email: string; name: string | null; image: string | null }[]>`
    SELECT email, name, image FROM app_users WHERE household_id=${hid} ORDER BY created_at`;
}

/** 초대 코드 생성(없으면). 8자리 영숫자 */
export async function ensureInviteCode(hid: number): Promise<string> {
  await ready();
  const h = await getHousehold(hid);
  if (h?.invite_code) return h.invite_code;
  // 충돌 가능성 거의 없는 코드 생성 (DB에서 유니크 보장)
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    try {
      await sql`UPDATE households SET invite_code=${code} WHERE id=${hid}`;
      return code;
    } catch {
      // unique 충돌 시 재시도
    }
  }
  throw new Error("초대 코드 생성 실패");
}

/** 초대 코드로 합류 → 그 코드의 household로 사용자 이동 */
export async function joinHouseholdByCode(email: string, code: string): Promise<number | null> {
  await ready();
  const rows = await sql<{ id: number }[]>`SELECT id FROM households WHERE invite_code=${code}`;
  if (rows.length === 0) return null;
  const hid = rows[0].id;
  await sql`UPDATE app_users SET household_id=${hid} WHERE email=${email}`;
  return hid;
}

function randomCode(): string {
  // Math.random 사용 불가 환경 대비: 시간+카운터 기반은 부적절하므로 crypto 사용
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 헷갈리는 글자 제외
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
