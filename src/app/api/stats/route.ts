import { NextRequest, NextResponse } from "next/server";
import { categoryBreakdown, monthlyTrend, monthlySummary } from "@/lib/queries";

// /api/stats?ym=2026-06&months=6
// 카테고리별 분석(지출/수입/저축) + 최근 N개월 추이
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const ym = url.searchParams.get("ym") ?? "";
  const months = Number(url.searchParams.get("months")) || 6;

  const [summary, expenseByCategory, incomeByCategory, savingByCategory, trend] = await Promise.all([
    monthlySummary(ym),
    categoryBreakdown(ym, "expense"),
    categoryBreakdown(ym, "income"),
    categoryBreakdown(ym, "saving"),
    monthlyTrend(months),
  ]);
  return NextResponse.json({ ym, summary, expenseByCategory, incomeByCategory, savingByCategory, trend });
}
