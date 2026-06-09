import { NextResponse } from "next/server";
import { fetchQuotes, fetchUsdKrw } from "@/lib/quotes";
import { setCachedUsdKrw } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

// /api/quotes?symbols=AAPL,005930.KS  → 시세 + 환율
// "환율 새로고침" 시 호출. 외부에서 환율을 가져와 DB에 저장 → 다음 접속 때 즉시 표시.
export const GET = withHousehold(async (hid, req) => {
  const symbolsParam = new URL(req.url).searchParams.get("symbols") ?? "";
  const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const [quotes, usdKrw] = await Promise.all([
    symbols.length ? fetchQuotes(symbols) : Promise.resolve({}),
    fetchUsdKrw(),
  ]);
  // 가져온 환율을 저장(실패 시 기본값 1350이 올 수 있으니 그건 저장 안 함)
  if (usdKrw && usdKrw !== 1350) {
    try { await setCachedUsdKrw(hid, usdKrw); } catch { /* 저장 실패 무시 */ }
  }
  return NextResponse.json({ quotes, usdKrw });
});
