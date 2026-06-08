import { sql, CURRENT_USER_ID as UID, ensureSchema } from "./db";

// 모든 쿼리 함수는 비동기(Postgres). 호출 전 스키마 보장.
async function ready() { await ensureSchema(); }

// ---------- 타입 ----------
export type Account = {
  id: number; user_id: number; name: string; type: string;
  balance: number; sort_order: number;
};
export type Transaction = {
  id: number; user_id: number; account_id: number | null; kind: string;
  category: string | null; memo: string | null; amount: number; date: string;
  recurring_id: number | null;
};
export type RecurringItem = {
  id: number; user_id: number; account_id: number | null; kind: string;
  category: string | null; memo: string | null; amount: number;
  day_of_month: number; active: number;
};
export type Holding = {
  id: number; user_id: number; symbol: string; name: string | null;
  market: string; shares: number; avg_cost: number; currency: string;
  dca_monthly: number; dca_expected_return: number;
};
export type Property = {
  id: number; user_id: number; name: string; market_value: number;
  loan_balance: number; loan_rate: number; monthly_payment: number;
};
export type Goal = {
  id: number; user_id: number; name: string; target_amount: number;
  target_date: string; expected_return: number;
};

// ---------- 계좌 ----------
export async function getAccounts(): Promise<Account[]> {
  await ready();
  return await sql<Account[]>`SELECT * FROM accounts WHERE user_id=${UID} ORDER BY sort_order, id`;
}
export async function addAccount(name: string, type: string, balance: number) {
  await ready();
  await sql`INSERT INTO accounts (user_id,name,type,balance) VALUES (${UID},${name},${type},${balance})`;
}
export async function updateAccount(id: number, name: string, type: string, balance: number) {
  await ready();
  await sql`UPDATE accounts SET name=${name},type=${type},balance=${balance} WHERE id=${id} AND user_id=${UID}`;
}
export async function deleteAccount(id: number) {
  await ready();
  await sql`DELETE FROM accounts WHERE id=${id} AND user_id=${UID}`;
}

// ---------- 거래 ----------
export async function getTransactions(ym?: string): Promise<Transaction[]> {
  await ready();
  if (ym) return await sql<Transaction[]>`
    SELECT * FROM transactions WHERE user_id=${UID} AND substr(date,1,7)=${ym}
    ORDER BY date DESC, id DESC`;
  return await sql<Transaction[]>`SELECT * FROM transactions WHERE user_id=${UID} ORDER BY date DESC, id DESC`;
}
export async function addTransaction(t: Omit<Transaction, "id" | "user_id">) {
  await ready();
  await sql`INSERT INTO transactions (user_id,account_id,kind,category,memo,amount,date,recurring_id)
    VALUES (${UID},${t.account_id},${t.kind},${t.category},${t.memo},${t.amount},${t.date},${t.recurring_id ?? null})`;
}
export async function deleteTransaction(id: number) {
  await ready();
  await sql`DELETE FROM transactions WHERE id=${id} AND user_id=${UID}`;
}

// 월별 합계 (수입/지출/저축)
export async function monthlySummary(ym: string) {
  await ready();
  const rows = await sql<{ kind: string; total: number }[]>`
    SELECT kind, SUM(amount) as total FROM transactions
    WHERE user_id=${UID} AND substr(date,1,7)=${ym} GROUP BY kind`;
  const out = { income: 0, expense: 0, saving: 0 };
  rows.forEach((r) => {
    if (r.kind === "income") out.income = Number(r.total);
    else if (r.kind === "expense") out.expense = Number(r.total);
    else if (r.kind === "saving") out.saving = Number(r.total);
  });
  return out;
}

// 특정 월의 카테고리별 합계
export async function categoryBreakdown(ym: string, kind: string) {
  await ready();
  return await sql<{ category: string; total: number; cnt: number }[]>`
    SELECT COALESCE(category,'미분류') as category, SUM(amount) as total, COUNT(*)::int as cnt
    FROM transactions WHERE user_id=${UID} AND kind=${kind} AND substr(date,1,7)=${ym}
    GROUP BY category ORDER BY total DESC`;
}

// 최근 N개월 월별 수입/지출/저축 추이
export async function monthlyTrend(months: number) {
  await ready();
  const rows = await sql<{ ym: string; kind: string; total: number }[]>`
    SELECT substr(date,1,7) as ym, kind, SUM(amount) as total
    FROM transactions WHERE user_id=${UID} GROUP BY ym, kind ORDER BY ym`;
  const map: Record<string, { ym: string; income: number; expense: number; saving: number }> = {};
  rows.forEach((r) => {
    if (!map[r.ym]) map[r.ym] = { ym: r.ym, income: 0, expense: 0, saving: 0 };
    (map[r.ym] as any)[r.kind] = Number(r.total);
  });
  const all = Object.values(map).sort((a, b) => a.ym.localeCompare(b.ym));
  return all.slice(-months);
}

// ---------- 정기항목 ----------
export async function getRecurringItems(): Promise<RecurringItem[]> {
  await ready();
  return await sql<RecurringItem[]>`SELECT * FROM recurring_items WHERE user_id=${UID} ORDER BY day_of_month, id`;
}
export async function addRecurringItem(r: Omit<RecurringItem, "id" | "user_id" | "active">) {
  await ready();
  await sql`INSERT INTO recurring_items (user_id,account_id,kind,category,memo,amount,day_of_month)
    VALUES (${UID},${r.account_id},${r.kind},${r.category},${r.memo},${r.amount},${r.day_of_month})`;
}
export async function deleteRecurringItem(id: number) {
  await ready();
  await sql`DELETE FROM recurring_items WHERE id=${id} AND user_id=${UID}`;
}
export async function toggleRecurringItem(id: number, active: number) {
  await ready();
  await sql`UPDATE recurring_items SET active=${active} WHERE id=${id} AND user_id=${UID}`;
}

/**
 * 정기항목을 특정 월(ym)의 거래로 생성. 이미 그 달에 같은 recurring_id로 생성됐으면 건너뜀.
 */
export async function materializeRecurring(ym: string): Promise<number> {
  await ready();
  const items = (await getRecurringItems()).filter((i) => i.active);
  let created = 0;
  for (const it of items) {
    const exists = await sql`
      SELECT 1 FROM transactions WHERE user_id=${UID} AND recurring_id=${it.id} AND substr(date,1,7)=${ym} LIMIT 1`;
    if (exists.length > 0) continue;
    const day = String(Math.min(it.day_of_month, 28)).padStart(2, "0");
    const date = `${ym}-${day}`;
    await sql`INSERT INTO transactions (user_id,account_id,kind,category,memo,amount,date,recurring_id)
      VALUES (${UID},${it.account_id},${it.kind},${it.category},${it.memo},${it.amount},${date},${it.id})`;
    created++;
  }
  return created;
}

// ---------- 주식 ----------
export async function getHoldings(): Promise<Holding[]> {
  await ready();
  return await sql<Holding[]>`SELECT * FROM holdings WHERE user_id=${UID} ORDER BY id`;
}
export async function addHolding(h: Omit<Holding, "id" | "user_id">) {
  await ready();
  await sql`INSERT INTO holdings (user_id,symbol,name,market,shares,avg_cost,currency,dca_monthly,dca_expected_return)
    VALUES (${UID},${h.symbol},${h.name},${h.market},${h.shares},${h.avg_cost},${h.currency},${h.dca_monthly},${h.dca_expected_return})`;
}
export async function updateHolding(id: number, h: Omit<Holding, "id" | "user_id">) {
  await ready();
  await sql`UPDATE holdings SET symbol=${h.symbol},name=${h.name},market=${h.market},shares=${h.shares},
    avg_cost=${h.avg_cost},currency=${h.currency},dca_monthly=${h.dca_monthly},dca_expected_return=${h.dca_expected_return}
    WHERE id=${id} AND user_id=${UID}`;
}
export async function deleteHolding(id: number) {
  await ready();
  await sql`DELETE FROM holdings WHERE id=${id} AND user_id=${UID}`;
}

// ---------- 부동산 ----------
export async function getProperties(): Promise<Property[]> {
  await ready();
  return await sql<Property[]>`SELECT * FROM properties WHERE user_id=${UID} ORDER BY id`;
}
export async function addProperty(p: Omit<Property, "id" | "user_id">) {
  await ready();
  await sql`INSERT INTO properties (user_id,name,market_value,loan_balance,loan_rate,monthly_payment)
    VALUES (${UID},${p.name},${p.market_value},${p.loan_balance},${p.loan_rate},${p.monthly_payment})`;
}
export async function updateProperty(id: number, p: Omit<Property, "id" | "user_id">) {
  await ready();
  await sql`UPDATE properties SET name=${p.name},market_value=${p.market_value},loan_balance=${p.loan_balance},
    loan_rate=${p.loan_rate},monthly_payment=${p.monthly_payment} WHERE id=${id} AND user_id=${UID}`;
}
export async function deleteProperty(id: number) {
  await ready();
  await sql`DELETE FROM properties WHERE id=${id} AND user_id=${UID}`;
}

// ---------- 목표 ----------
export async function getGoals(): Promise<Goal[]> {
  await ready();
  return await sql<Goal[]>`SELECT * FROM goals WHERE user_id=${UID} ORDER BY target_date`;
}
export async function addGoal(g: Omit<Goal, "id" | "user_id">) {
  await ready();
  await sql`INSERT INTO goals (user_id,name,target_amount,target_date,expected_return)
    VALUES (${UID},${g.name},${g.target_amount},${g.target_date},${g.expected_return})`;
}
export async function deleteGoal(id: number) {
  await ready();
  await sql`DELETE FROM goals WHERE id=${id} AND user_id=${UID}`;
}

// ---------- 순자산 스냅샷 ----------
export async function getSnapshots() {
  await ready();
  return await sql<{ id: number; ym: string; total_assets: number; total_debt: number; net_worth: number }[]>`
    SELECT * FROM net_worth_snapshots WHERE user_id=${UID} ORDER BY ym`;
}
export async function saveSnapshot(ym: string, assets: number, debt: number) {
  await ready();
  await sql`
    INSERT INTO net_worth_snapshots (user_id,ym,total_assets,total_debt,net_worth)
    VALUES (${UID},${ym},${assets},${debt},${assets - debt})
    ON CONFLICT (user_id,ym) DO UPDATE SET
      total_assets=EXCLUDED.total_assets, total_debt=EXCLUDED.total_debt, net_worth=EXCLUDED.net_worth`;
}
