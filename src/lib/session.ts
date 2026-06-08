import { auth } from "./auth";

/**
 * 현재 로그인 사용자의 household_id를 반환.
 * 로그인 안 했으면 에러 → API에서 401 처리.
 */
export async function currentHouseholdId(): Promise<number> {
  const session = await auth();
  const hid = (session as any)?.householdId;
  if (!hid) throw new UnauthorizedError();
  return hid;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
    this.name = "UnauthorizedError";
  }
}
