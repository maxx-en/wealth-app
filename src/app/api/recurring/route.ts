import { NextRequest, NextResponse } from "next/server";
import { getRecurringItems, addRecurringItem, deleteRecurringItem, toggleRecurringItem } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(await getRecurringItems());
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  await addRecurringItem({
    account_id: b.account_id ?? null,
    kind: b.kind,
    category: b.category ?? null,
    memo: b.memo ?? null,
    amount: Number(b.amount) || 0,
    day_of_month: Number(b.day_of_month) || 1,
  });
  return NextResponse.json(await getRecurringItems());
}
export async function PUT(req: NextRequest) {
  const b = await req.json();
  await toggleRecurringItem(b.id, b.active ? 1 : 0);
  return NextResponse.json(await getRecurringItems());
}
export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteRecurringItem(id);
  return NextResponse.json(await getRecurringItems());
}
