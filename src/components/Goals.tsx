"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Card, Button, Input, MoneyInput, Field } from "./ui";
import { useToast } from "./Toast";
import { api, post, del } from "@/lib/api";
import { formatKRW, requiredMonthly, monthsBetween, dcaFutureValue } from "@/lib/finance";
import type { Goal } from "@/lib/queries";

type Overview = { netWorth: number };

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [netWorth, setNetWorth] = useState(0);

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [ret, setRet] = useState("7");
  // 역산 시 "지금 가진 돈"으로 쓸 초기금 (기본=순자산)
  const [initial, setInitial] = useState("");

  async function load() {
    const [g, o] = await Promise.all([
      api<Goal[]>("/api/goals"),
      api<Overview>("/api/overview"),
    ]);
    setGoals(g);
    setNetWorth(o.netWorth);
    if (!initial) setInitial(String(Math.round(o.netWorth)));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const toast = useToast();
  async function add() {
    if (!name.trim()) { toast.error("목표 이름을 입력해 주세요"); return; }
    if (!target) { toast.error("목표 금액을 입력해 주세요"); return; }
    if (!date) { toast.error("목표 날짜를 선택해 주세요"); return; }
    try {
      const g = await post("/api/goals", {
        name, target_amount: target, target_date: date, expected_return: ret,
      });
      setGoals(g as Goal[]);
      setName(""); setTarget(""); setDate("");
      toast.success(`목표 “${name}” 추가 완료`);
    } catch {
      toast.error("추가에 실패했어요. 다시 시도해 주세요");
    }
  }
  async function remove(id: number) {
    try {
      setGoals((await del(`/api/goals?id=${id}`)) as Goal[]);
      toast.success("목표를 삭제했어요");
    } catch {
      toast.error("삭제에 실패했어요");
    }
  }

  const initNum = Number(initial) || 0;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 font-semibold">목표 추가</h2>
        <p className="mb-3 text-xs text-muted">
          “언제까지 얼마”를 넣으면 지금 자산({formatKRW(netWorth)}원)에서 매월 얼마를 더 모아야 하는지 거꾸로 계산해줘요.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="목표 이름">
            <Input value={name} onChange={setName} placeholder="예: 내집마련" />
          </Field>
          <Field label="목표 금액(원)">
            <MoneyInput value={target} onChange={setTarget} placeholder="0" />
          </Field>
          <Field label="목표 날짜">
            <Input type="date" value={date} onChange={setDate} />
          </Field>
          <Field label="현재 보유(초기금)">
            <MoneyInput value={initial} onChange={setInitial} placeholder="0" />
          </Field>
          <Field label="기대수익률 %">
            <Input type="number" value={ret} onChange={setRet} />
          </Field>
        </div>
        <Button onClick={add} className="mt-4 w-full">목표 추가</Button>
      </Card>

      <div className="space-y-3">
        {goals.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">등록된 목표가 없어요</p>
        )}
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} initial={initNum} onRemove={() => remove(g.id)} />
        ))}
      </div>
    </div>
  );
}

function GoalCard({ goal, initial, onRemove }: { goal: Goal; initial: number; onRemove: () => void }) {
  const now = new Date();
  const target = new Date(goal.target_date);
  const months = Math.max(0, monthsBetween(now, target));
  const years = (months / 12).toFixed(1);

  // 매월 필요 적립액 (역산)
  const need = requiredMonthly(goal.target_amount, initial, goal.expected_return, months);
  // 초기금만 굴렸을 때 도달 가치 (적립 0)
  const initialOnly = dcaFutureValue(initial, 0, goal.expected_return, months);
  const reachableByInitial = initialOnly >= goal.target_amount;
  const progress = Math.min(100, (initial / goal.target_amount) * 100);

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{goal.name}</h3>
          <div className="text-xs text-muted">
            목표 {formatKRW(goal.target_amount)}원 · {goal.target_date} (약 {years}년 · 수익률 {goal.expected_return}%)
          </div>
        </div>
        <button onClick={onRemove} aria-label="삭제" className="text-muted transition hover:text-down"><X size={18} strokeWidth={1.8} /></button>
      </div>

      {/* 진행률 바 (현재 보유 기준) */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>현재 {formatKRW(initial)}원</span><span>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
        {months <= 0 ? (
          <span className="text-down">목표일이 지났어요. 날짜를 조정하세요.</span>
        ) : reachableByInitial ? (
          <span className="text-up font-medium">
            지금 보유액만 {goal.expected_return}%로 굴려도 목표일에 {formatKRW(initialOnly)}원 → 달성 가능
          </span>
        ) : (
          <span>
            매월 <span className="font-bold text-accent-strong">{formatKRW(need)}원</span>씩 적립하면
            {" "}{goal.target_date}에 목표 달성 가능
          </span>
        )}
      </div>
    </Card>
  );
}
