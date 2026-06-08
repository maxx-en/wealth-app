import { NextRequest, NextResponse } from "next/server";
import { materializeRecurring } from "@/lib/queries";

// 특정 월의 정기항목을 거래로 일괄 생성 (중복 자동 방지)
export async function POST(req: NextRequest) {
  const b = await req.json();
  const ym: string = b.ym;
  const created = await materializeRecurring(ym);
  return NextResponse.json({ created });
}
