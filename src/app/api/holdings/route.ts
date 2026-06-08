import { NextResponse } from "next/server";
import { getHoldings, addHolding, updateHolding, deleteHolding } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

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

export const GET = withHousehold(async (hid) => {
  return NextResponse.json(await getHoldings(hid));
});
export const POST = withHousehold(async (hid, req) => {
  await addHolding(hid, parse(await req.json()));
  return NextResponse.json(await getHoldings(hid));
});
export const PUT = withHousehold(async (hid, req) => {
  const b = await req.json();
  await updateHolding(hid, b.id, parse(b));
  return NextResponse.json(await getHoldings(hid));
});
export const DELETE = withHousehold(async (hid, req) => {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteHolding(hid, id);
  return NextResponse.json(await getHoldings(hid));
});
