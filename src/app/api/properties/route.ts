import { NextResponse } from "next/server";
import { getProperties, addProperty, updateProperty, deleteProperty } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

function parse(b: any) {
  return {
    name: b.name,
    market_value: Number(b.market_value) || 0,
    loan_balance: Number(b.loan_balance) || 0,
    loan_rate: Number(b.loan_rate) || 0,
    monthly_payment: Number(b.monthly_payment) || 0,
  };
}

export const GET = withHousehold(async (hid) => {
  return NextResponse.json(await getProperties(hid));
});
export const POST = withHousehold(async (hid, req) => {
  await addProperty(hid, parse(await req.json()));
  return NextResponse.json(await getProperties(hid));
});
export const PUT = withHousehold(async (hid, req) => {
  const b = await req.json();
  await updateProperty(hid, b.id, parse(b));
  return NextResponse.json(await getProperties(hid));
});
export const DELETE = withHousehold(async (hid, req) => {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteProperty(hid, id);
  return NextResponse.json(await getProperties(hid));
});
