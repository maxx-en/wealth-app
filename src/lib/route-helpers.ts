import { NextResponse } from "next/server";
import { currentHouseholdId, UnauthorizedError } from "./session";

/**
 * API 핸들러를 감싸서 (1) 로그인 확인 → household_id 주입, (2) 미로그인 시 401 처리.
 * 사용: export const GET = withHousehold(async (hid, req) => { ... return NextResponse.json(...) })
 */
export function withHousehold(
  fn: (hid: number, req: Request) => Promise<NextResponse>
) {
  return async (req: Request) => {
    let hid: number;
    try {
      hid = await currentHouseholdId();
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      throw e;
    }
    return fn(hid, req);
  };
}
