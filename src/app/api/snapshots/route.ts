import { NextResponse } from "next/server";
import { getSnapshots, saveSnapshot } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

export const GET = withHousehold(async (hid) => {
  return NextResponse.json(await getSnapshots(hid));
});
// 현재 순자산을 이번 달 스냅샷으로 저장 (성장률 추이 누적)
export const POST = withHousehold(async (hid, req) => {
  const b = await req.json();
  await saveSnapshot(hid, b.ym, Number(b.total_assets) || 0, Number(b.total_debt) || 0);
  return NextResponse.json(await getSnapshots(hid));
});
