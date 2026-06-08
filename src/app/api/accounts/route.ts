import { NextRequest, NextResponse } from "next/server";
import { getAccounts, addAccount, updateAccount, deleteAccount } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(await getAccounts());
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  await addAccount(b.name, b.type ?? "checking", Number(b.balance) || 0);
  return NextResponse.json(await getAccounts());
}
export async function PUT(req: NextRequest) {
  const b = await req.json();
  await updateAccount(b.id, b.name, b.type, Number(b.balance) || 0);
  return NextResponse.json(await getAccounts());
}
export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteAccount(id);
  return NextResponse.json(await getAccounts());
}
