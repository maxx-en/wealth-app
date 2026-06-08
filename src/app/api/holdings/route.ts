import { NextRequest, NextResponse } from "next/server";
import { getHoldings, addHolding, updateHolding, deleteHolding } from "@/lib/queries";

function parse(b: any) {
  return {
    symbol: String(b.symbol || "").trim().toUpperCase(),
    name: b.name ?? null,
    market: b.market ?? "US",
    shares: Number(b.shares) || 0,
    avg_cost: Number(b.avg_cost) || 0,
    currency: b.currency ?? (b.market === "KR" ? "KRW" : "USD"),
    dca_monthly: Number(b.dca_monthly) || 0,
    dca_expected_return: Number(b.dca_expected_return) || 7,
  };
}

export async function GET() {
  return NextResponse.json(await getHoldings());
}
export async function POST(req: NextRequest) {
  await addHolding(parse(await req.json()));
  return NextResponse.json(await getHoldings());
}
export async function PUT(req: NextRequest) {
  const b = await req.json();
  await updateHolding(b.id, parse(b));
  return NextResponse.json(await getHoldings());
}
export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteHolding(id);
  return NextResponse.json(await getHoldings());
}
