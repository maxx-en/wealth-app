import { NextRequest, NextResponse } from "next/server";
import { getProperties, addProperty, updateProperty, deleteProperty } from "@/lib/queries";

function parse(b: any) {
  return {
    name: b.name,
    market_value: Number(b.market_value) || 0,
    loan_balance: Number(b.loan_balance) || 0,
    loan_rate: Number(b.loan_rate) || 0,
    monthly_payment: Number(b.monthly_payment) || 0,
  };
}

export async function GET() {
  return NextResponse.json(await getProperties());
}
export async function POST(req: NextRequest) {
  await addProperty(parse(await req.json()));
  return NextResponse.json(await getProperties());
}
export async function PUT(req: NextRequest) {
  const b = await req.json();
  await updateProperty(b.id, parse(b));
  return NextResponse.json(await getProperties());
}
export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteProperty(id);
  return NextResponse.json(await getProperties());
}
