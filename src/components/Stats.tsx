"use client";
import { useEffect, useState } from "react";
import { Card, Input, StatCard } from "./ui";
import { api, currentYM } from "@/lib/api";
import { formatKRW, formatPct, growthRate } from "@/lib/finance";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type CatRow = { category: string; total: number; cnt: number };
type Trend = { ym: string; income: number; expense: number; saving: number };
type StatsData = {
  ym: string;
  summary: { income: number; expense: number; saving: number };
  expenseByCategory: CatRow[];
  incomeByCategory: CatRow[];
  savingByCategory: CatRow[];
  trend: Trend[];
};

const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#a3a3a3", "#d4d4d4"];

const KIND_TABS = [
  { key: "expense", label: "지출" },
  { key: "income", label: "수입" },
  { key: "saving", label: "저축" },
] as const;

export default function Stats() {
  const [ym, setYm] = useState(currentYM());
  const [data, setData] = useState<StatsData | null>(null);
  const [kindTab, setKindTab] = useState<"expense" | "income" | "saving">("expense");

  async function load() {
    const d = await api<StatsData>(`/api/stats?ym=${ym}&months=6`);
    setData(d);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ym]);

  if (!data) return <p className="py-12 text-center text-sm text-neutral-400">불러오는 중…</p>;

  const cats =
    kindTab === "expense" ? data.expenseByCategory :
    kindTab === "income" ? data.incomeByCategory : data.savingByCategory;
  const catTotal = cats.reduce((s, c) => s + c.total, 0);

  // 월별 비교: 이번 달 vs 직전 달 (trend 마지막 2개)
  const t = data.trend;
  const cur = t.find((x) => x.ym === ym);
  const prevIdx = t.findIndex((x) => x.ym === ym) - 1;
  const prev = prevIdx >= 0 ? t[prevIdx] : undefined;

  function mom(field: "income" | "expense" | "saving") {
    if (!cur || !prev) return null;
    return growthRate(cur[field], prev[field]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Input type="month" value={ym} onChange={setYm} className="max-w-[180px]" />
        <span className="text-xs text-neutral-400">월을 바꾸면 그달 기준으로 분석돼요</span>
      </div>

      {/* 이번 달 요약 + 전월 대비 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="수입" value={`${formatKRW(data.summary.income)}원`}
          sub={mom("income") != null ? `전월 대비 ${formatPct(mom("income")!)}` : undefined}
          accent={mom("income") != null && mom("income")! >= 0 ? "up" : "down"} />
        <StatCard label="지출" value={`${formatKRW(data.summary.expense)}원`}
          sub={mom("expense") != null ? `전월 대비 ${formatPct(mom("expense")!)}` : undefined}
          accent={mom("expense") != null && mom("expense")! <= 0 ? "up" : "down"} />
        <StatCard label="저축" value={`${formatKRW(data.summary.saving)}원`}
          sub={mom("saving") != null ? `전월 대비 ${formatPct(mom("saving")!)}` : undefined}
          accent={mom("saving") != null && mom("saving")! >= 0 ? "up" : "down"} />
      </div>

      {/* 카테고리별 분석 */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">카테고리별 분석</h2>
          <div className="flex rounded-lg border border-neutral-200 p-0.5 text-xs">
            {KIND_TABS.map((kt) => (
              <button key={kt.key} onClick={() => setKindTab(kt.key)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  kindTab === kt.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}>
                {kt.label}
              </button>
            ))}
          </div>
        </div>

        {cats.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">이 달에 해당 거래가 없어요</p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cats} dataKey="total" nameKey="category" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${formatKRW(Number(v))}원`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full flex-1 space-y-1.5">
              {cats.map((c, i) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {c.category}
                    <span className="text-[11px] text-neutral-400">{c.cnt}건</span>
                  </span>
                  <span className="font-medium">
                    {formatKRW(c.total)}원
                    <span className="ml-1 text-xs text-neutral-400">{((c.total / catTotal) * 100).toFixed(0)}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 월별 비교 (최근 6개월) */}
      <Card>
        <h2 className="mb-3 font-semibold">월별 비교 (최근 6개월)</h2>
        {t.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">거래를 입력하면 월별 추이가 그려져요</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={t} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ym" fontSize={11} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} fontSize={11} width={48} />
                <Tooltip formatter={(v: any) => `${formatKRW(Number(v))}원`} />
                <Legend />
                <Bar dataKey="income" name="수입" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="지출" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saving" name="저축" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
