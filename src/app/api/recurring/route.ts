import { NextResponse } from "next/server";
import { getRecurringItems, addRecurringItem, deleteRecurringItem, toggleRecurringItem } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

export const GET = withHousehold(async (hid) => {
  return NextResponse.json(await getRecurringItems(hid));
});
export const POST = withHousehold(async (hid, req) => {
  const b = await req.json();
  await addRecurringItem(hid, {
    account_id: b.account_id ?? null,
    kind: b.kind,
    category: b.category ?? null,
    memo: b.memo ?? null,
    amount: Number(b.amount) || 0,
    day_of_month: Number(b.day_of_month) || 1,
    goal_id: b.kind === "saving" && b.goal_id ? Number(b.goal_id) : null,
  });
  return NextResponse.json(await getRecurringItems(hid));
});
export const PUT = withHousehold(async (hid, req) => {
  const b = await req.json();
  await toggleRecurringItem(hid, b.id, b.active ? 1 : 0);
  return NextResponse.json(await getRecurringItems(hid));
});
export const DELETE = withHousehold(async (hid, req) => {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteRecurringItem(hid, id);
  return NextResponse.json(await getRecurringItems(hid));
});
