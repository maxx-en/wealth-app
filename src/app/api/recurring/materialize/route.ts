import { NextResponse } from "next/server";
import { materializeRecurring } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

// 특정 월의 정기항목을 거래로 일괄 생성 (중복 자동 방지)
export const POST = withHousehold(async (hid, req) => {
  const b = await req.json();
  const created = await materializeRecurring(hid, b.ym);
  return NextResponse.json({ created });
});
