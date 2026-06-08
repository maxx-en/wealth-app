import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { joinHouseholdByCode } from "@/lib/queries";

// 초대 코드로 다른 가구에 합류
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json();
  const code = String(b.code || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "코드를 입력하세요" }, { status: 400 });

  const hid = await joinHouseholdByCode(email, code);
  if (!hid) return NextResponse.json({ error: "유효하지 않은 코드예요" }, { status: 404 });

  // 합류 후엔 세션 토큰의 householdId가 갱신돼야 함 → 클라이언트에서 재로그인 유도
  return NextResponse.json({ ok: true, joined: true });
}
