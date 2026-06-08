import { NextResponse } from "next/server";
import { getHousehold, getHouseholdMembers, ensureInviteCode } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

// 가구 정보 + 구성원 조회
export const GET = withHousehold(async (hid) => {
  const [household, members] = await Promise.all([
    getHousehold(hid),
    getHouseholdMembers(hid),
  ]);
  return NextResponse.json({ household, members });
});

// 초대 코드 생성(없으면 만들고 반환)
export const POST = withHousehold(async (hid) => {
  const code = await ensureInviteCode(hid);
  return NextResponse.json({ code });
});
