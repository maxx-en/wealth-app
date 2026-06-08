import { NextResponse } from "next/server";
import { getGoals, addGoal, deleteGoal } from "@/lib/queries";
import { withHousehold } from "@/lib/route-helpers";

export const GET = withHousehold(async (hid) => {
  return NextResponse.json(await getGoals(hid));
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
export const DELETE = withHousehold(async (hid, req) => {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteGoal(hid, id);
  return NextResponse.json(await getGoals(hid));
});
