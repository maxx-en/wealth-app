"use client";
import { useEffect, useState } from "react";
import { X, Star, Pencil } from "lucide-react";
import { Card, Button, Input, MoneyInput, Field, Skeleton } from "./ui";
import { useToast } from "./Toast";
import { api, post, put, del, today } from "@/lib/api";
import { formatKRW, requiredMonthly, monthsBetween, dcaFutureValue } from "@/lib/finance";
import type { Goal } from "@/lib/queries";

// 목표 + 연결 저축 누적(saved). /api/goals가 함께 내려준다.
type GoalWithSaved = Goal & { saved: number };

export default function Goals() {
  const [goals, setGoals] = useState<GoalWithSaved[]>([]);
  const [featuredId, setFeaturedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [ret, setRet] = useState("7");

  async function load() {
    setLoading(true);
    try {
      const [g, f] = await Promise.all([
        api<GoalWithSaved[]>("/api/goals"),
        api<{ goal: Goal | null }>("/api/goals/featured"),
      ]);
      setGoals(g);
      setFeaturedId(f.goal ? Number(f.goal.id) : null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const toast = useToast();
  async function add() {
    if (!name.trim()) { toast.error("목표 이름을 입력해 주세요"); return; }
    if (!target) { toast.error("목표 금액을 입력해 주세요"); return; }
    if (!date) { toast.error("목표 날짜를 선택해 주세요"); return; }
    try {
      await post("/api/goals", { name, target_amount: target, target_date: date, expected_return: ret });
      setName(""); setTarget(""); setDate("");
      await load();
      toast.success(`목표 “${name}” 추가 완료`);
    } catch {
      toast.error("추가에 실패했어요. 다시 시도해 주세요");
    }
  }
  async function save(g: GoalWithSaved) {
    try {
      await put("/api/goals", {
        id: g.id, name: g.name, target_amount: g.target_amount,
        target_date: g.target_date, expected_return: g.expected_return,
      });
      await load();
      toast.success("목표를 수정했어요");
    } catch {
      toast.error("수정에 실패했어요");
    }
  }
  async function remove(id: number) {
    try {
      await del(`/api/goals?id=${id}`);
      if (featuredId === id) setFeaturedId(null);
      await load();
      toast.success("목표를 삭제했어요");
    } catch {
      toast.error("삭제에 실패했어요");
    }
  }
  async function toggleFeatured(id: number) {
    const next = featuredId === id ? null : id;
    setFeaturedId(next);
    try {
      await put("/api/goals/featured", { id: next });
      toast.success(next ? "대시보드 대표 목표로 설정했어요" : "대표 목표를 해제했어요");
    } catch {
      setFeaturedId(featuredId);
      toast.error("설정에 실패했어요");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 font-semibold">목표 추가</h2>
        <p className="mb-3 text-xs text-muted">
          “언제까지 얼마”를 정하면, 그 목표에 연결한 저축이 쌓이는 만큼 진행률이 올라가요. 현금흐름에서 <span className="font-medium text-text">저축</span> 입력 시 이 목표를 연결하세요.
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
          <Field label="기대수익률 %">
            <Input type="number" value={ret} onChange={setRet} />
          </Field>
        </div>
        <Button onClick={add} className="mt-4 w-full">목표 추가</Button>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <Card><Skeleton className="h-5 w-32" /><Skeleton className="mt-3 h-2 w-full" /><Skeleton className="mt-3 h-12 w-full" /></Card>
        ) : goals.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">등록된 목표가 없어요</p>
        ) : (
          goals.map((g) => (
            <GoalCard key={g.id} goal={g}
              featured={featuredId === Number(g.id)}
              onToggleFeatured={() => toggleFeatured(Number(g.id))}
              onSave={save}
              onRemove={() => remove(Number(g.id))} />
          ))
        )}
      </div>
    </div>
  );
}

function GoalCard({ goal, featured, onToggleFeatured, onSave, onRemove }: {
  goal: GoalWithSaved; featured: boolean;
  onToggleFeatured: () => void; onSave: (g: GoalWithSaved) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  // 진행률 = 이 목표에 연결한 저축 누적(saved)
  const current = goal.saved;
  const now = new Date();
  const target = new Date(goal.target_date + "T23:59:59"); // 목표일은 그날 끝까지 유효
  const months = Math.max(0, monthsBetween(now, target));
  const years = (months / 12).toFixed(1);
  const passed = target.getTime() < now.getTime(); // 실제 날짜로 '지남' 판정 (같은 달이어도 미래면 안 지남)

  const need = requiredMonthly(goal.target_amount, current, goal.expected_return, months);
  const initialOnly = dcaFutureValue(current, 0, goal.expected_return, months);
  const reachableBySaved = initialOnly >= goal.target_amount;
  const reached = current >= goal.target_amount;
  const progress = Math.min(100, goal.target_amount > 0 ? (current / goal.target_amount) * 100 : 0);

  if (editing) {
    return <GoalEditCard goal={goal} onCancel={() => setEditing(false)}
      onSubmit={(g) => { onSave(g); setEditing(false); }} />;
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{goal.name}</h3>
          <div className="text-xs text-muted">
            목표 {formatKRW(goal.target_amount)}원 · {goal.target_date} ({passed ? "기한 지남" : `약 ${years}년`} · 수익률 {goal.expected_return}%)
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggleFeatured}
            aria-label={featured ? "대표 목표 해제" : "대시보드에 표시"}
            title={featured ? "대시보드 대표 목표 (클릭 시 해제)" : "대시보드에 표시"}
            className={`transition ${featured ? "text-accent-strong" : "text-muted hover:text-text"}`}>
            <Star size={18} strokeWidth={1.8} fill={featured ? "currentColor" : "none"} />
          </button>
          <button onClick={() => setEditing(true)} aria-label="수정" className="text-muted transition hover:text-text"><Pencil size={16} strokeWidth={1.8} /></button>
          <button onClick={onRemove} aria-label="삭제" className="text-muted transition hover:text-down"><X size={18} strokeWidth={1.8} /></button>
        </div>
      </div>

      {/* 진행률 바 (연결 저축 기준) */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>모은 금액 {formatKRW(current)}원</span><span>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full rounded-full ${reached ? "bg-up" : "bg-accent"}`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
        {reached ? (
          <span className="font-medium text-up">🎉 목표 달성! 모은 금액이 목표를 넘었어요</span>
        ) : passed ? (
          <span className="text-down">목표일이 지났어요. 날짜를 조정하거나 목표를 다시 설정하세요.</span>
        ) : reachableBySaved ? (
          <span className="font-medium text-up">
            지금 모은 금액만 {goal.expected_return}%로 굴려도 목표일에 {formatKRW(initialOnly)}원 → 달성 가능
          </span>
        ) : (
          <span>
            매월 <span className="font-bold text-accent-strong">{formatKRW(need)}원</span>씩 더 저축하면
            {" "}{goal.target_date}에 목표 달성 가능
          </span>
        )}
      </div>
      {current === 0 && (
        <p className="mt-2 text-[11px] text-muted">아직 연결된 저축이 없어요. 현금흐름에서 저축을 입력할 때 이 목표를 연결하세요.</p>
      )}
    </Card>
  );
}

// 목표 인라인 수정 카드
function GoalEditCard({ goal, onCancel, onSubmit }: {
  goal: GoalWithSaved; onCancel: () => void; onSubmit: (g: GoalWithSaved) => void;
}) {
  const [name, setName] = useState(goal.name);
  const [target, setTarget] = useState(String(goal.target_amount));
  const [date, setDate] = useState(goal.target_date);
  const [ret, setRet] = useState(String(goal.expected_return));
  const toast = useToast();

  function submit() {
    if (!name.trim()) { toast.error("목표 이름을 입력해 주세요"); return; }
    if (!target) { toast.error("목표 금액을 입력해 주세요"); return; }
    if (!date) { toast.error("목표 날짜를 선택해 주세요"); return; }
    onSubmit({ ...goal, name, target_amount: Number(target) || 0, target_date: date, expected_return: Number(ret) || 7 });
  }

  return (
    <Card>
      <h3 className="mb-3 font-semibold">목표 수정</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="목표 이름"><Input value={name} onChange={setName} /></Field>
        <Field label="목표 금액(원)"><MoneyInput value={target} onChange={setTarget} /></Field>
        <Field label="목표 날짜"><Input type="date" value={date} onChange={setDate} /></Field>
        <Field label="기대수익률 %"><Input type="number" value={ret} onChange={setRet} /></Field>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} className="flex-1">저장</Button>
        <Button variant="ghost" onClick={onCancel}>취소</Button>
      </div>
    </Card>
  );
}
