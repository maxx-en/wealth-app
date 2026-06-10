import { NextResponse } from "next/server";
import { getAccounts, getHoldings, getProperties, getCachedUsdKrw, getCachedQuotes } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

// 전체 자산 현황 집계 (KRW 환산). 대시보드용.
// ⚡ 외부(야후) 시세/환율을 호출하지 않고 DB 캐시값만으로 즉시 응답한다 → 대시보드가 빠르게 뜸.
//   - 환율·시세: 마지막으로 "환율·주가 업데이트" 때 저장된 값 사용. 캐시 없으면 평단가로 폴백.
export const GET = withHousehold(async (hid) => {
  const [accounts, holdings, properties, usdKrw, cachedPrices] = await Promise.all([
    getAccounts(hid),
    getHoldings(hid),
    getProperties(hid),
    getCachedUsdKrw(hid),
    getCachedQuotes(hid),
  ]);

  // 캐시된 현재가 맵 { 심볼: 현재가 }. 없는 종목은 평단가로 폴백.
  const quotes: Record<string, { price: number; changePct: number }> = {};
  for (const [sym, price] of Object.entries(cachedPrices)) {
    quotes[sym] = { price, changePct: 0 };
  }

  // 부채는 '계좌 유형'이 아니라 '잔액 부호'로 판단한다.
  //  - 잔액 +  → 자산 (유형별 카테고리로 합산)
  //  - 잔액 −  → 부채 (유형 불문, 절댓값을 부채로 합산)  예: 마이너스통장이 −300만이면 부채 300만
  const assetSum = (types: string[]) =>
    accounts.filter((a) => types.includes(a.type) && a.balance > 0)
      .reduce((s, a) => s + a.balance, 0);
  const savings = assetSum(["savings"]);
  const brokerageCash = assetSum(["brokerage"]);
  // 저축·증권 외 양수 잔액 계좌는 모두 현금성 자산으로 (입출금·현금·마이너스통장(+) 등)
  const cash = accounts
    .filter((a) => a.balance > 0 && !["savings", "brokerage"].includes(a.type))
    .reduce((s, a) => s + a.balance, 0);
  // 음수 잔액 계좌 전체를 부채로 (유형 무관)
  const accountDebt = accounts.filter((a) => a.balance < 0)
    .reduce((s, a) => s + Math.abs(a.balance), 0);

  // 평가액 (KRW 환산) — 주식(미국+한국)과 코인을 분리 집계.
  let stockValue = 0;   // 주식만 (미국+국내)
  let stockCost = 0;
  let cryptoValue = 0;  // 코인만 (업비트 원화)
  let cryptoCost = 0;
  const holdingDetails = holdings.map((h) => {
    const q = quotes[h.symbol];
    const price = q?.price ?? h.avg_cost;
    const toKrw = h.currency === "USD" ? usdKrw : 1;
    const value = price * h.shares * toKrw;
    const cost = h.avg_cost * h.shares * toKrw;
    if (h.market === "CRYPTO") {
      cryptoValue += value;
      cryptoCost += cost;
    } else {
      stockValue += value;
      stockCost += cost;
    }
    return {
      ...h, price, value, cost,
      changePct: q?.changePct ?? 0,
      gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    };
  });

  // 부동산
  const propertyValue = properties.reduce((s, p) => s + p.market_value, 0);
  const propertyDebt = properties.reduce((s, p) => s + p.loan_balance, 0);

  // ── 자산 계산 (순자산을 기준으로, 총자산은 파생) ──
  //  순자산 = 실제 내가 보유한 몫
  //    = 현금성 자산 + 부동산 에쿼티(시세 − 대출)
  //    ※ 부동산 대출은 그 부동산의 에쿼티에서만 차감 (자산에 묶인 빚)
  //    ※ 마이너스통장·신용대출은 순자산에서 빼지 않음 (빌린 돈 = 개인 역량으로 보고 총자산에 포함)
  const netWorth = cash + savings + brokerageCash + stockValue + cryptoValue + (propertyValue - propertyDebt);
  //  부채 = 갚을 것 전부 (부동산 대출 + 계좌 부채)
  const totalDebt = propertyDebt + accountDebt;
  //  총자산 = 순자산 + 부채 (빌린 돈까지 더한 '굴리는 자금 전체')
  const totalAssets = netWorth + totalDebt;

  return NextResponse.json({
    usdKrw,
    breakdown: {
      cash,
      savings,
      stock: stockValue + brokerageCash,
      crypto: cryptoValue,
      property: propertyValue,
    },
    totalAssets,
    totalDebt,
    netWorth,
    stockValue,
    stockCost,
    stockGainPct: stockCost > 0 ? ((stockValue - stockCost) / stockCost) * 100 : 0,
    cryptoValue,
    cryptoCost,
    cryptoGainPct: cryptoCost > 0 ? ((cryptoValue - cryptoCost) / cryptoCost) * 100 : 0,
    holdings: holdingDetails,
    properties,
  });
});
