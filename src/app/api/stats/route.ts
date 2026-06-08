import { NextResponse } from "next/server";
import { categoryBreakdown, monthlyTrend, monthlySummary } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

// /api/stats?ym=2026-06&months=6
export const GET = withHousehold(async (hid, req) => {
  const url = new URL(req.url);
  const ym = url.searchParams.get("ym") ?? "";
  const months = Number(url.searchParams.get("months")) || 6;

  const [summary, expenseByCategory, incomeByCategory, savingByCategory, trend] = await Promise.all([
    monthlySummary(hid, ym),
    categoryBreakdown(hid, ym, "expense"),
    categoryBreakdown(hid, ym, "income"),
    categoryBreakdown(hid, ym, "saving"),
    monthlyTrend(hid, months),
  ]);
  return NextResponse.json({ ym, summary, expenseByCategory, incomeByCategory, savingByCategory, trend });
});
