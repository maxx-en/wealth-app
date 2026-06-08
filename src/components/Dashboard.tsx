"use client";
import { useEffect, useState } from "react";
import { Card, Button, StatCard } from "./ui";
import { api, post, currentYM } from "@/lib/api";
import { formatKRW, formatPct, growthRate } from "@/lib/finance";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type Overview = {
  usdKrw: number;
  breakdown: { cash: number; savings: number; stock: number; property: number };
  totalAssets: number; totalDebt: number; netWorth: number;
  stockValue: number; stockGainPct: number;
};
type Snapshot = { ym: string; total_assets: number; total_debt: number; net_worth: number };

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];
const PIE_LABELS = ["현금", "저축", "주식", "부동산"];

export default function Dashboard() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [trendMode, setTrendMode] = useState<"month" | "year">("month"); // 추이 그래프 단위

  async function load() {
    setLoading(true);
    const [o, s] = await Promise.all([
      api<Overview>("/api/overview"),
      api<Snapshot[]>("/api/snapshots"),
    ]);
    let snapList = s;
    // 자동 기록: 이번 달 스냅샷이 아직 없으면 현재 순자산으로 1회 자동 저장.
    // 이미 있으면 건드리지 않음(수동으로 누른 최신값 보존).
    const ym = currentYM();
    const hasThisMonth = s.some((x) => x.ym === ym);
    if (!hasThisMonth && o.totalAssets > 0) {
      snapList = (await post("/api/snapshots", {
        ym, total_assets: o.totalAssets, total_debt: o.totalDebt,
      })) as Snapshot[];
      setMsg("이번 달 순자산을 자동 기록했어요");
      setTimeout(() => setMsg(""), 2500);
    }
    setOv(o); setSnaps(snapList); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function snapshot() {
    if (!ov) return;
    const s = await post("/api/snapshots", {
      ym: currentYM(), total_assets: ov.totalAssets, total_debt: ov.totalDebt,
    });
    setSnaps(s as Snapshot[]);
    setMsg("이번 달 순자산을 최신값으로 갱신했어요");
    setTimeout(() => setMsg(""), 2500);
  }

  if (loading || !ov) return <p className="py-12 text-center text-sm text-neutral-400">불러오는 중…</p>;

  const pieData = [
    { name: "현금", value: ov.breakdown.cash },
    { name: "저축", value: ov.breakdown.savings },
    { name: "주식", value: ov.breakdown.stock },
    { name: "부동산", value: ov.breakdown.property },
  ].filter((d) => d.value > 0);

  // 성장률 계산
  const sorted = [...snaps].sort((a, b) => a.ym.localeCompare(b.ym));
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const momGrowth = last && prev ? growthRate(last.net_worth, prev.net_worth) : null;
  // 올해 첫 스냅샷 대비
  const thisYear = currentYM().slice(0, 4);
  const yearStart = sorted.find((s) => s.ym.startsWith(thisYear));
  const ytdGrowth = yearStart && last ? growthRate(last.net_worth, yearStart.net_worth) : null;

  // 월별 데이터 (그대로)
  const monthData = sorted.map((s) => ({ label: s.ym, nw: s.net_worth }));
  // 연도별 순자산(각 연도 마지막 스냅샷 = 그 해 연말 순자산)
  const byYear: Record<string, number> = {};
  sorted.forEach((s) => { byYear[s.ym.slice(0, 4)] = s.net_worth; });
  const yearData = Object.entries(byYear).map(([year, nw]) => ({ label: year, nw }));

  return (
    <div className="space-y-6">
      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="순자산" value={`${formatKRW(ov.netWorth)}원`}
          sub={momGrowth != null ? `전월 대비 ${formatPct(momGrowth)}` : "스냅샷 2개월부터 표시"}
          accent={momGrowth != null && momGrowth >= 0 ? "up" : momGrowth != null ? "down" : "neutral"} />
        <StatCard label="총자산" value={`${formatKRW(ov.totalAssets)}원`} />
        <StatCard label="부채" value={`${formatKRW(ov.totalDebt)}원`} accent="down" />
        <StatCard label="올해 누적 성장"
          value={ytdGrowth != null ? formatPct(ytdGrowth) : "—"}
          sub={`주식 수익률 ${formatPct(ov.stockGainPct)}`}
          accent={ytdGrowth != null && ytdGrowth >= 0 ? "up" : "down"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={snapshot}>📸 지금 값으로 갱신</Button>
        <Button variant="ghost" onClick={load}>🔄 시세 새로고침</Button>
        <span className="text-xs text-neutral-400">환율 {ov.usdKrw.toLocaleString("en-US", { maximumFractionDigits: 0 })}원/$ · 이번 달 기록은 접속 시 자동, 버튼으로 최신화</span>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 자산 구성 */}
        <Card>
          <h2 className="mb-3 font-semibold">자산 구성</h2>
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">계좌·주식·부동산을 등록하면 구성이 표시돼요</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[PIE_LABELS.indexOf(pieData[i].name)]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${formatKRW(Number(v))}원`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[PIE_LABELS.indexOf(d.name)] }} />
                      {d.name}
                    </span>
                    <span className="font-medium">{formatKRW(d.value)}원
                      <span className="ml-1 text-xs text-neutral-400">
                        {((d.value / ov.totalAssets) * 100).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* 순자산 추이 (월/연 토글) */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">순자산 추이</h2>
            {/* 월/연 토글 */}
            <div className="flex rounded-lg border border-neutral-200 p-0.5 text-xs">
              <button
                onClick={() => setTrendMode("month")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  trendMode === "month" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}>
                월별
              </button>
              <button
                onClick={() => setTrendMode("year")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  trendMode === "year" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"}`}>
                연별
              </button>
            </div>
          </div>

          {sorted.length < 2 ? (
            <p className="py-8 text-center text-sm text-neutral-400">
              매월 “순자산 기록”을 눌러 데이터를 쌓으면 추이 그래프가 그려져요 (현재 {sorted.length}개)
            </p>
          ) : trendMode === "month" ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthData} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} fontSize={11} width={48} />
                  <Tooltip formatter={(v: any) => `${formatKRW(Number(v))}원`} labelFormatter={(l) => `${l}`} />
                  <Line type="monotone" dataKey="nw" name="순자산" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearData} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tickFormatter={(y) => `${y}년`} fontSize={11} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} fontSize={11} width={48} />
                  <Tooltip formatter={(v: any) => `${formatKRW(Number(v))}원`} labelFormatter={(l) => `${l}년 말`} />
                  <Bar dataKey="nw" name="순자산" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-[11px] text-neutral-400">
            {trendMode === "month" ? "월별: 기록한 모든 달의 순자산" : "연별: 각 연도 마지막 기록(연말 기준) 순자산"}
          </p>
        </Card>
      </div>
    </div>
  );
}
