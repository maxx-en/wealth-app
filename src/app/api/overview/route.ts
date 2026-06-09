import { NextResponse } from "next/server";
import { getAccounts, getHoldings, getProperties } from "@/lib/queries";
import { fetchQuotes, fetchUsdKrw } from "@/lib/quotes";
import { withHousehold } from "@/lib/route-helpers";

// 전체 자산 현황 집계 (KRW 환산). 대시보드용.
export const GET = withHousehold(async (hid) => {
  const [accounts, holdings, properties] = await Promise.all([
    getAccounts(hid),
    getHoldings(hid),
    getProperties(hid),
  ]);

  // 환율과 종목 시세를 병렬로 조회 (직렬 대기 제거 → 응답 속도 개선)
  const symbols = holdings.map((h) => h.symbol);
  const [usdKrw, quotes] = await Promise.all([
    fetchUsdKrw(),
    symbols.length ? fetchQuotes(symbols) : Promise.resolve({} as Awaited<ReturnType<typeof fetchQuotes>>),
  ]);

  // 현금/저축 (계좌 잔액 합)
  const cash = accounts.filter((a) => a.type === "checking" || a.type === "cash")
    .reduce((s, a) => s + a.balance, 0);
  const savings = accounts.filter((a) => a.type === "savings")
    .reduce((s, a) => s + a.balance, 0);
  const brokerageCash = accounts.filter((a) => a.type === "brokerage")
    .reduce((s, a) => s + a.balance, 0);

  // 주식 평가액 (KRW 환산)
  let stockValue = 0;
  let stockCost = 0;
  const holdingDetails = holdings.map((h) => {
    const q = quotes[h.symbol];
    const price = q?.price ?? h.avg_cost;
    const toKrw = h.currency === "USD" ? usdKrw : 1;
    const value = price * h.shares * toKrw;
    const cost = h.avg_cost * h.shares * toKrw;
    stockValue += value;
    stockCost += cost;
    return {
      ...h, price, value, cost,
      changePct: q?.changePct ?? 0,
      gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    };
  });

  // 부동산
  const propertyValue = properties.reduce((s, p) => s + p.market_value, 0);
  const propertyDebt = properties.reduce((s, p) => s + p.loan_balance, 0);

  const totalAssets = cash + savings + brokerageCash + stockValue + propertyValue;
  const totalDebt = propertyDebt;
  const netWorth = totalAssets - totalDebt;

  return NextResponse.json({
    usdKrw,
    breakdown: {
      cash,
      savings,
      stock: stockValue + brokerageCash,
      property: propertyValue,
    },
    totalAssets,
    totalDebt,
    netWorth,
    stockValue,
    stockCost,
    stockGainPct: stockCost > 0 ? ((stockValue - stockCost) / stockCost) * 100 : 0,
    holdings: holdingDetails,
    properties,
  });
});
