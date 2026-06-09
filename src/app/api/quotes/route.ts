import { NextResponse } from "next/server";
import { fetchQuotes, fetchUsdKrw } from "@/lib/quotes";
import { setCachedUsdKrw, setCachedQuotes, getHoldings } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

// /api/quotes?symbols=AAPL,005930.KS  → 시세 + 환율
// "환율·주가 업데이트" 시 호출. 외부에서 시세·환율을 가져와 DB에 저장 → 대시보드가 즉시 그 값으로 평가.
// symbols 파라미터가 비어도, 이 가구의 보유 종목 시세는 항상 함께 갱신한다.
export const GET = withHousehold(async (hid, req) => {
  const symbolsParam = new URL(req.url).searchParams.get("symbols") ?? "";
  const paramSymbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  // 요청 심볼 + 보유 종목 심볼 합집합
  const heldSymbols = (await getHoldings(hid)).map((h) => h.symbol);
  const symbols = Array.from(new Set([...paramSymbols, ...heldSymbols]));
  const [quotes, usdKrw] = await Promise.all([
    symbols.length ? fetchQuotes(symbols) : Promise.resolve({}),
    fetchUsdKrw(),
  ]);
  // 가져온 환율을 저장(실패 시 기본값 1350이 올 수 있으니 그건 저장 안 함)
  if (usdKrw && usdKrw !== 1350) {
    try { await setCachedUsdKrw(hid, usdKrw); } catch { /* 저장 실패 무시 */ }
  }
  // 가져온 종목 시세를 { 심볼: 현재가 } 맵으로 저장 → 대시보드 평가액에 반영
  const prices: Record<string, number> = {};
  for (const [sym, q] of Object.entries(quotes)) {
    if (q && typeof (q as any).price === "number") prices[sym] = (q as any).price;
  }
  if (Object.keys(prices).length) {
    try { await setCachedQuotes(hid, prices); } catch { /* 저장 실패 무시 */ }
  }
  return NextResponse.json({ quotes, usdKrw });
});
