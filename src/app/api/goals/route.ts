import { NextResponse } from "next/server";
import { getGoals, addGoal, updateGoal, deleteGoal, savedByGoal } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

// 목표 목록 + 각 목표의 연결 저축 누적(saved) 함께 반환 → 목표탭이 개별 진행률 표시.
export const GET = withHousehold(async (hid) => {
  const [goals, saved] = await Promise.all([getGoals(hid), savedByGoal(hid)]);
  const withSaved = goals.map((g) => ({ ...g, saved: saved[Number(g.id)] ?? 0 }));
  return NextResponse.json(withSaved);
});
export const POST = withHousehold(async (hid, req) => {
  const b = await req.json();
  await addGoal(hid, {
    name: b.name,
    target_amount: Number(b.target_amount) || 0,
    target_date: b.target_date,
    expected_return: Number(b.expected_return) || 7,
  });
  return NextResponse.json(await getGoals(hid));
});
export const PUT = withHousehold(async (hid, req) => {
  const b = await req.json();
  await updateGoal(hid, Number(b.id), {
    name: b.name,
    target_amount: Number(b.target_amount) || 0,
    target_date: b.target_date,
    expected_return: Number(b.expected_return) || 7,
  });
  return NextResponse.json(await getGoals(hid));
});
export const DELETE = withHousehold(async (hid, req) => {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteGoal(hid, id);
  return NextResponse.json(await getGoals(hid));
});
