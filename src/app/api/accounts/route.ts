import { NextResponse } from "next/server";
import { getAccounts, addAccount, updateAccount, deleteAccount } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

export const GET = withHousehold(async (hid) => {
  return NextResponse.json(await getAccounts(hid));
});
export const POST = withHousehold(async (hid, req) => {
  const b = await req.json();
  await addAccount(hid, b.name, b.type ?? "checking", Number(b.balance) || 0);
  return NextResponse.json(await getAccounts(hid));
});
export const PUT = withHousehold(async (hid, req) => {
  const b = await req.json();
  await updateAccount(hid, b.id, b.name, b.type, Number(b.balance) || 0);
  return NextResponse.json(await getAccounts(hid));
});
export const DELETE = withHousehold(async (hid, req) => {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteAccount(hid, id);
  return NextResponse.json(await getAccounts(hid));
});
