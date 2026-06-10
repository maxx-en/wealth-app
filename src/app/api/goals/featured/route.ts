import { NextResponse } from "next/server";
import {
  getFeaturedGoalId, setFeaturedGoalId, getGoals, savedTowardGoal,
} from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

// 대시보드에 표시할 대표 목표 + 그 목표의 적립 누적액.
// GET → { goal: Goal|null, saved: number }
// PUT { id: number|null } → 대표 목표 설정/해제
export const GET = withHousehold(async (hid) => {
  const id = await getFeaturedGoalId(hid);
  if (id == null) return NextResponse.json({ goal: null, saved: 0 });
  const goals = await getGoals(hid);
  const goal = goals.find((g) => Number(g.id) === Number(id)) ?? null;
  if (!goal) return NextResponse.json({ goal: null, saved: 0 }); // 삭제된 목표
  const saved = await savedTowardGoal(hid, id);
  return NextResponse.json({ goal, saved });
});

export const PUT = withHousehold(async (hid, req) => {
  const b = await req.json();
  const id = b.id == null || b.id === "" ? null : Number(b.id);
  await setFeaturedGoalId(hid, id);
  return NextResponse.json({ ok: true });
});
