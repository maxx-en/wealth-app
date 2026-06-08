import { NextRequest, NextResponse } from "next/server";
import { getGoals, addGoal, deleteGoal } from "@/lib/queries";

export async function GET() {
  return NextResponse.json(await getGoals());
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  await addGoal({
    name: b.name,
    target_amount: Number(b.target_amount) || 0,
    target_date: b.target_date,
    expected_return: Number(b.expected_return) || 7,
  });
  return NextResponse.json(await getGoals());
}
export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteGoal(id);
  return NextResponse.json(await getGoals());
}
