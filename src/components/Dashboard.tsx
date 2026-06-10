"use client";
import { useEffect, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { Card, Button, StatCard, statSize, useChartTheme, Skeleton } from "./ui";
import { api, post, currentYM } from "@/lib/api";
import { formatKRW, formatKRWShort, formatPct, growthRate } from "@/lib/finance";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type Overview = {
  usdKrw: number;
  breakdown: { cash: number; savings: number; stock: number; crypto: number; property: number };
  totalAssets: number; totalDebt: number; netWorth: number;
  stockValue: number; stockGainPct: number;
  cryptoValue: number; cryptoGainPct: number;
};
type Snapshot = { ym: string; total_assets: number; total_debt: number; net_worth: number };

const PIE_COLORS = ["#a3d635", "#9d7bff", "#f5b84e", "#f57ea0", "#5ec8e8"];
const PIE_LABELS = ["현금", "저축", "주식", "코인", "부동산"];

export default function Dashboard() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [trendMode, setTrendMode] = useState<"month" | "year">("month"); // 추이 그래프 단위
  const ct = useChartTheme();

  async function load() {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        api<Overview>("/api/overview"),
        api<Snapshot[]>("/api/snapshots"),
      ]);
      let snapList = s;
      // 자동 기록: 이번 달 스냅샷이 아직 없으면 현재 순자산으로 1회 자동 저장.
      // 이미 있으면 건드리지 않음(수동으로 누른 최신값 보존).
      // 저장 실패해도 화면은 떠야 하므로 별도 try로 감싼다(무한 로딩 방지).
      const ym = currentYM();
      const hasThisMonth = s.some((x) => x.ym === ym);
      if (!hasThisMonth && o.totalAssets > 0) {
        try {
          snapList = (await post("/api/snapshots", {
            ym, total_assets: o.totalAssets, total_debt: o.totalDebt,
          })) as Snapshot[];
          setMsg("이번 달 순자산을 자동 기록했어요");
          setTimeout(() => setMsg(""), 2500);
        } catch { /* 스냅샷 저장 실패는 무시 — 화면은 정상 표시 */ }
      }
      setOv(o); setSnaps(snapList);
      // 주식 보유 시: 화면은 캐시값으로 즉시 띄우되, 뒤에서 최신 시세를 받아 평가액을 갱신한다.
      // (캐시가 없거나 오래됐어도 자동으로 현재가 기준으로 자가 보정됨 — 화면은 안 막음)
      if (o.stockValue > 0 || (o.breakdown?.stock ?? 0) > 0) {
        refreshRates(true);
      }
    } finally {
      setLoading(false); // 어떤 경우에도 로딩 해제 (무한 로딩 방지)
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // 환율·주가 업데이트: 외부에서 최신 시세·환율을 가져와 저장(서버) 후 화면 갱신.
  //  - 버튼 클릭(silent=false): 스피너 + 완료 토스트
  //  - 자동 호출(silent=true): 조용히 평가액만 갱신 (대시보드 진입 시 주식 자가 보정용)
  const [refreshing, setRefreshing] = useState(false);
  async function refreshRates(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      // 서버가 보유 종목 시세를 받아 캐시에 저장 → overview가 그 값으로 평가
      await api("/api/quotes?symbols=");
      const o = await api<Overview>("/api/overview");
      setOv(o);
      if (!silent) {
        setMsg("환율·주가를 업데이트했어요");
        setTimeout(() => setMsg(""), 2500);
      }
    } catch {
      if (!silent) {
        setMsg("업데이트에 실패했어요");
        setTimeout(() => setMsg(""), 2500);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  async function snapshot() {
    if (!ov) return;
    const s = await post("/api/snapshots", {
      ym: currentYM(), total_assets: ov.totalAssets, total_debt: ov.totalDebt,
    });
    setSnaps(s as Snapshot[]);
    setMsg("이번 달 순자산을 최신값으로 갱신했어요");
    setTimeout(() => setMsg(""), 2500);
  }

  if (loading || !ov) return <DashboardSkeleton />;

  const pieData = [
    { name: "현금", value: ov.breakdown.cash },
    { name: "저축", value: ov.breakdown.savings },
    { name: "주식", value: ov.breakdown.stock },
    { name: "코인", value: ov.breakdown.crypto },
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

  // 핵심 지표 4칸의 글자 크기를 가장 긴 값에 맞춰 통일
  const statRowSize = statSize(
    `${formatKRW(ov.netWorth)}원`,
    `${formatKRW(ov.totalAssets)}원`,
    `${formatKRW(ov.totalDebt)}원`,
    ytdGrowth != null ? formatPct(ytdGrowth) : "—",
  );

  return (
    <div className="space-y-6">
      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="순자산"
          note={momGrowth != null ? `전월 ${formatPct(momGrowth)}` : "총자산 − 부채"}
          value={`${formatKRW(ov.netWorth)}원`} valueSize={statRowSize}
          accent={momGrowth != null && momGrowth >= 0 ? "up" : momGrowth != null ? "down" : "neutral"} />
        <StatCard label="총자산" value={`${formatKRW(ov.totalAssets)}원`} valueSize={statRowSize} />
        <StatCard label="부채" value={`${formatKRW(ov.totalDebt)}원`} valueSize={statRowSize} accent="down" />
        <StatCard label="올해 성장"
          note={yearStart ? `${yearStart.ym.slice(2, 4)}.${yearStart.ym.slice(5, 7)} 기준` : undefined}
          valueSize={statRowSize}
          value={ytdGrowth != null ? formatPct(ytdGrowth) : "—"}
          accent={ytdGrowth != null && ytdGrowth >= 0 ? "up" : "down"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={snapshot}><Camera size={15} strokeWidth={1.8} /> 지금 값으로 갱신</Button>
        <Button variant="ghost" onClick={() => refreshRates(false)} disabled={refreshing}>
          <RefreshCw size={15} strokeWidth={1.8} className={refreshing ? "animate-spin" : ""} /> 환율·주가 업데이트
        </Button>
        <span className="text-xs text-muted">환율 {ov.usdKrw.toLocaleString("en-US", { maximumFractionDigits: 0 })}원/$ · 이번 달 기록은 접속 시 자동</span>
        {msg && <span className="text-sm text-up">{msg}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 자산 구성 */}
        <Card>
          <h2 className="mb-3 font-semibold">자산 구성</h2>
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">계좌·주식·부동산을 등록하면 구성이 표시돼요</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[PIE_LABELS.indexOf(pieData[i].name)]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${formatKRW(Number(v))}원`} contentStyle={{ background: ct.surface, border: `1px solid ${ct.border}`, borderRadius: 12, color: ct.text }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                {pieData.map((d) => (
                  <div key={d.name} className="text-sm">
                    {/* 윗줄: 색상·이름 + 비중 / 아랫줄: 금액 — 금액이 길어도 이름이 안 쪼개지게 분리 */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 break-keep">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[PIE_LABELS.indexOf(d.name)] }} />
                        {d.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {((d.value / ov.totalAssets) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-0.5 pl-[1.125rem] font-medium tabular-nums">
                      {formatKRWShort(d.value)}
                    </div>
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
            <div className="flex rounded-full border border-border p-0.5 text-xs">
              <button
                onClick={() => setTrendMode("month")}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  trendMode === "month" ? "bg-accent text-[var(--accent-text)]" : "text-muted hover:text-text"}`}>
                월별
              </button>
              <button
                onClick={() => setTrendMode("year")}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  trendMode === "year" ? "bg-accent text-[var(--accent-text)]" : "text-muted hover:text-text"}`}>
                연별
              </button>
            </div>
          </div>

          {sorted.length < 2 ? (
            <p className="py-8 text-center text-sm text-muted">
              매월 “순자산 기록”을 눌러 데이터를 쌓으면 추이 그래프가 그려져요 (현재 {sorted.length}개)
            </p>
          ) : trendMode === "month" ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthData} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="label" fontSize={11} stroke={ct.axis} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} fontSize={11} width={48} stroke={ct.axis} />
                  <Tooltip formatter={(v: any) => `${formatKRW(Number(v))}원`} labelFormatter={(l) => `${l}`} contentStyle={{ background: ct.surface, border: `1px solid ${ct.border}`, borderRadius: 12, color: ct.text }} />
                  <Line type="monotone" dataKey="nw" name="순자산" stroke={ct.line} strokeWidth={2.5} dot={{ r: 3, fill: ct.line }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearData} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="label" tickFormatter={(y) => `${y}년`} fontSize={11} stroke={ct.axis} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} fontSize={11} width={48} stroke={ct.axis} />
                  <Tooltip formatter={(v: any) => `${formatKRW(Number(v))}원`} labelFormatter={(l) => `${l}년 말`} contentStyle={{ background: ct.surface, border: `1px solid ${ct.border}`, borderRadius: 12, color: ct.text }} cursor={{ fill: "#80808020" }} />
                  <Bar dataKey="nw" name="순자산" fill={ct.line} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted">
            {trendMode === "month" ? "월별: 기록한 모든 달의 순자산" : "연별: 각 연도 마지막 기록(연말 기준) 순자산"}
          </p>
        </Card>
      </div>
    </div>
  );
}

// 로딩 중 실제 레이아웃과 같은 자리에 깜빡이는 스켈레톤을 보여준다.
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-7 w-28" />
          </Card>
        ))}
      </div>
      <Skeleton className="h-10 w-72 max-w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><Skeleton className="h-4 w-20" /><Skeleton className="mt-4 h-48 w-full" /></Card>
        <Card><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-56 w-full" /></Card>
      </div>
    </div>
  );
}
