import { NextResponse } from "next/server";
import { getCategories, setCategories } from "@/lib/queries";
import { normalizeCategories } from "@/lib/categories";
import { withHousehold } from "@/lib/route-helpers";

// 가구별 카테고리 목록 조회/저장. 거래입력·정기항목·통계 드롭다운 공용.
export const GET = withHousehold(async (hid) => {
  return NextResponse.json(await getCategories(hid));
});
export const PUT = withHousehold(async (hid, req) => {
  const body = await req.json();
  await setCategories(hid, normalizeCategories(body));
  return NextResponse.json(await getCategories(hid));
});
