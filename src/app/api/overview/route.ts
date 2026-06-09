import { NextResponse } from "next/server";
import { getAccounts, getHoldings, getProperties, getCachedUsdKrw } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

// 전체 자산 현황 집계 (KRW 환산). 대시보드용.
// ⚡ 외부(야후) 시세/환율을 호출하지 않고 DB 값만으로 즉시 응답한다 → 대시보드가 빠르게 뜸.
//   - 환율: 마지막으로 저장된 값(없으면 1400). "환율 새로고침" 버튼으로만 갱신.
//   - 주식 평가액: 저장된 평단가(avg_cost) 기준. 최신 시세는 투자 탭/새로고침에서 반영.
export const GET = withHousehold(async (hid) => {
  const [accounts, holdings, properties, usdKrw] = await Promise.all([
    getAccounts(hid),
    getHoldings(hid),
    getProperties(hid),
    getCachedUsdKrw(hid),
  ]);

  // 외부 시세 호출 없음 → 평단가를 현재가로 간주 (빈 객체)
  const quotes: Record<string, { price: number; changePct: number }> = {};

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
