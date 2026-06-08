import { NextRequest, NextResponse } from "next/server";
import { getSnapshots, saveSnapshot } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(await getSnapshots());
}
// 현재 순자산을 이번 달 스냅샷으로 저장 (성장률 추이 누적)
export async function POST(req: NextRequest) {
  const b = await req.json();
  await saveSnapshot(b.ym, Number(b.total_assets) || 0, Number(b.total_debt) || 0);
  return NextResponse.json(await getSnapshots());
}
