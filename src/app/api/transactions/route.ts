import { NextRequest, NextResponse } from "next/server";
import { getTransactions, addTransaction, deleteTransaction } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const ym = new URL(req.url).searchParams.get("ym") ?? undefined;
  return NextResponse.json(await getTransactions(ym || undefined));
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  await addTransaction({
    account_id: b.account_id ?? null,
    kind: b.kind,
    category: b.category ?? null,
    memo: b.memo ?? null,
    amount: Number(b.amount) || 0,
    date: b.date,
    recurring_id: null,
  });
  const ym = b.date?.slice(0, 7);
  return NextResponse.json(await getTransactions(ym));
}
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const ym = url.searchParams.get("ym") ?? undefined;
  await deleteTransaction(id);
  return NextResponse.json(await getTransactions(ym || undefined));
}
