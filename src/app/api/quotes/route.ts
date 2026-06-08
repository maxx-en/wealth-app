import { NextRequest, NextResponse } from "next/server";
import { fetchQuotes, fetchUsdKrw } from "@/lib/quotes";

// /api/quotes?symbols=AAPL,005930.KS  → 시세 + 환율
export async function GET(req: NextRequest) {
  const symbolsParam = new URL(req.url).searchParams.get("symbols") ?? "";
  const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const [quotes, usdKrw] = await Promise.all([
    symbols.length ? fetchQuotes(symbols) : Promise.resolve({}),
    fetchUsdKrw(),
  ]);
  return NextResponse.json({ quotes, usdKrw });
}
