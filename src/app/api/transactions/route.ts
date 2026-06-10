import { NextResponse } from "next/server";
import { getTransactions, addTransaction, deleteTransaction } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

export const GET = withHousehold(async (hid, req) => {
  const ym = new URL(req.url).searchParams.get("ym") ?? undefined;
  return NextResponse.json(await getTransactions(hid, ym || undefined));
});
export const POST = withHousehold(async (hid, req) => {
  const b = await req.json();
  await addTransaction(hid, {
    account_id: b.account_id ?? null,
    kind: b.kind,
    category: b.category ?? null,
    memo: b.memo ?? null,
    amount: Number(b.amount) || 0,
    date: b.date,
    recurring_id: null,
    // 저축 거래만 목표 연결 의미 있음
    goal_id: b.kind === "saving" && b.goal_id ? Number(b.goal_id) : null,
  });
  const ym = b.date?.slice(0, 7);
  return NextResponse.json(await getTransactions(hid, ym));
});
export const DELETE = withHousehold(async (hid, req) => {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const ym = url.searchParams.get("ym") ?? undefined;
  await deleteTransaction(hid, id);
  return NextResponse.json(await getTransactions(hid, ym || undefined));
});
