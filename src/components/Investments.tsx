"use client";
import { useEffect, useMemo, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { Card, Button, Input, MoneyInput, Select, StatCard, statSize, useChartTheme, StatCardSkeleton } from "./ui";
import { useToast } from "./Toast";
import { api, post, put, del } from "@/lib/api";
import {
  formatMoney,
  formatKRW,
  formatPct,
  dcaProjectionCurve,
  dcaFutureValue,
  dcaPrincipal,
} from "@/lib/finance";
import type { Holding } from "@/lib/queries";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type Quote = {
  price: number;
  currency: string;
  changePct: number;
  name?: string;
};

const MARKET_OPTS = [
  { value: "US", label: "미국" },
  { value: "KR", label: "국내" },
  { value: "CRYPTO", label: "코인" },
];

// 표시용 라벨: 코인은 "KRW-BTC → BTC", 시장은 "CRYPTO → 코인"으로 보기 좋게.
const MARKET_LABEL: Record<string, string> = { US: "미국", KR: "국내", CRYPTO: "코인" };
function displaySymbol(symbol: string, market: string) {
  return market === "CRYPTO" ? symbol.replace(/^KRW-/, "") : symbol;
}
function displayMarket(market: string) {
  return MARKET_LABEL[market] ?? market;
}

export default function Investments() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [usdKrw, setUsdKrw] = useState(1350);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // 첫 데이터 도착 전

  async function loadHoldings() {
    const h = await api<Holding[]>("/api/holdings");
    setHoldings(h);
    setInitialLoading(false);
    return h;
  }
  async function loadQuotes(h: Holding[]) {
    setLoading(true);
    // 종목이 없어도 환율은 항상 최신으로 불러온다 (symbols 비어도 OK)
    const symbols = h.map((x) => x.symbol).join(",");
    const r = await api<{ quotes: Record<string, Quote>; usdKrw: number }>(
      `/api/quotes?symbols=${symbols}`,
    );
    setQuotes(r.quotes);
    setUsdKrw(r.usdKrw);
    setLoading(false);
  }
  useEffect(() => {
    loadHoldings().then(loadQuotes);
  }, []);

  // 종목별 평가 계산
  const rows = holdings.map((h) => {
    const q = quotes[h.symbol];
    const price = q?.price ?? h.avg_cost;
    const value = price * h.shares;
    const cost = h.avg_cost * h.shares;
    const gain = value - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    const toKrw = h.currency === "USD" ? usdKrw : 1;
    return {
      h,
      q,
      price,
      value,
      cost,
      gain,
      gainPct,
      valueKrw: value * toKrw,
      costKrw: cost * toKrw,
    };
  });

  const totalValueKrw = rows.reduce((s, r) => s + r.valueKrw, 0);
  const totalCostKrw = rows.reduce((s, r) => s + r.costKrw, 0);
  const totalGainKrw = totalValueKrw - totalCostKrw;
  const totalGainPct =
    totalCostKrw > 0 ? (totalGainKrw / totalCostKrw) * 100 : 0;

  const topSize = statSize(
    `${formatKRW(totalValueKrw)}원`, `${formatKRW(totalCostKrw)}원`,
    `${formatKRW(totalGainKrw)}원`, formatPct(totalGainPct),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {initialLoading ? <StatCardSkeleton count={4} /> : (
        <>
        <StatCard
          label="총 평가액"
          value={`${formatKRW(totalValueKrw)}원`}
          valueSize={topSize}
          sub={`환율 ${usdKrw.toFixed(0)}원/$`}
        />
        <StatCard label="투자원금" value={`${formatKRW(totalCostKrw)}원`} valueSize={topSize} />
        <StatCard
          label="평가손익"
          value={`${formatKRW(totalGainKrw)}원`}
          valueSize={topSize}
          accent={totalGainKrw >= 0 ? "up" : "down"}
        />
        <StatCard
          label="수익률"
          value={formatPct(totalGainPct)}
          valueSize={topSize}
          accent={totalGainKrw >= 0 ? "up" : "down"}
        />
        </>
        )}
      </div>

      <PortfolioPanel
        rows={rows}
        loading={loading}
        onReload={() => loadHoldings().then(loadQuotes)}
      />

      <HoldingForm onSaved={() => loadHoldings().then(loadQuotes)} />

      <DcaSimulator holdings={holdings} quotes={quotes} usdKrw={usdKrw} />
    </div>
  );
}

// ---------- 보유 종목 테이블 ----------
function PortfolioPanel({
  rows,
  loading,
  onReload,
}: {
  rows: any[];
  loading: boolean;
  onReload: () => void;
}) {
  const toast = useToast();
  async function remove(id: number) {
    try {
      await del(`/api/holdings?id=${id}`);
      onReload();
      toast.success("종목을 삭제했어요");
    } catch {
      toast.error("삭제에 실패했어요");
    }
  }
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          보유 종목{" "}
          {loading && (
            <span className="text-xs text-muted">시세 불러오는 중…</span>
          )}
        </h2>
        <Button variant="ghost" onClick={onReload}>
          <RefreshCw size={15} strokeWidth={1.8} /> 시세 새로고침
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          아래에서 보유 종목을 추가하면 실시간 시세로 평가돼요.
        </p>
      ) : (
        <>
          {/* 모바일: 종목별 카드 (좁은 화면에서 글자 엉킴 방지) */}
          <div className="space-y-2.5 sm:hidden">
            {rows.map((r) => (
              <div key={r.h.id} className="rounded-2xl border border-border bg-surface-2 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {r.h.name || r.q?.name || r.h.symbol}
                    </div>
                    <div className="text-[11px] text-muted">
                      {displaySymbol(r.h.symbol, r.h.market)} · {displayMarket(r.h.market)}
                      {r.q && (
                        <span className={r.q.changePct >= 0 ? "text-up" : "text-down"}>
                          {" "}· {formatPct(r.q.changePct)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-sm font-semibold tabular-nums ${r.gain >= 0 ? "text-up" : "text-down"}`}
                    >
                      {formatPct(r.gainPct)}
                    </span>
                    <button
                      onClick={() => remove(r.h.id)}
                      aria-label="삭제"
                      className="text-muted transition hover:text-down"
                    >
                      <X size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-end justify-between gap-2">
                  <div className="text-[11px] text-muted">
                    수량 {r.h.shares} · 평단 {formatMoney(r.h.avg_cost, r.h.currency)}
                    <br />
                    현재가 {formatMoney(r.price, r.h.currency)}
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted">평가액</div>
                    <div className="font-semibold tabular-nums">
                      {formatMoney(r.value, r.h.currency)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* PC: 기존 표 유지 */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2">종목</th>
                  <th className="text-right">수량</th>
                  <th className="text-right">평단</th>
                  <th className="text-right">현재가</th>
                  <th className="text-right">평가액</th>
                  <th className="text-right">손익</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.h.id} className="border-b border-border">
                    <td className="py-2">
                      <div className="font-medium">
                        {r.h.name || r.q?.name || r.h.symbol}
                      </div>
                      <div className="text-[11px] text-muted">
                        {displaySymbol(r.h.symbol, r.h.market)} · {displayMarket(r.h.market)}
                        {r.q && (
                          <span
                            className={
                              r.q.changePct >= 0
                                ? "text-up"
                                : "text-down"
                            }
                          >
                            {" "}
                            · {formatPct(r.q.changePct)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">{r.h.shares}</td>
                    <td className="text-right">
                      {formatMoney(r.h.avg_cost, r.h.currency)}
                    </td>
                    <td className="text-right">
                      {formatMoney(r.price, r.h.currency)}
                    </td>
                    <td className="text-right">
                      {formatMoney(r.value, r.h.currency)}
                    </td>
                    <td
                      className={`text-right font-medium ${r.gain >= 0 ? "text-up" : "text-down"}`}
                    >
                      {formatPct(r.gainPct)}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => remove(r.h.id)}
                        aria-label="삭제"
                        className="text-muted transition hover:text-down"
                      >
                        <X size={16} strokeWidth={1.8} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

// ---------- 종목 추가 ----------
function HoldingForm({ onSaved }: { onSaved: () => void }) {
  const [market, setMarket] = useState("US");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");

  const toast = useToast();
  const isCrypto = market === "CRYPTO";
  async function add() {
    if (!symbol.trim()) {
      toast.error(isCrypto ? "코인 티커를 입력해 주세요 (예: BTC)" : "티커를 입력해 주세요 (예: AAPL)");
      return;
    }
    if (!shares) { toast.error("보유 수량을 입력해 주세요"); return; }
    try {
      // 코인은 업비트 원화 시세 → 심볼을 "KRW-BTC" 형식으로, 통화는 KRW로 저장.
      // (사용자가 이미 "KRW-"를 붙여 입력했어도 중복 방지)
      const finalSymbol = isCrypto
        ? `KRW-${symbol.replace(/^KRW-/, "")}`
        : symbol;
      const currency = isCrypto ? "KRW" : market === "KR" ? "KRW" : "USD";
      await post("/api/holdings", {
        symbol: finalSymbol,
        name,
        market,
        shares,
        avg_cost: avgCost,
        currency,
      });
      setSymbol("");
      setName("");
      setShares("");
      setAvgCost("");
      onSaved();
      toast.success(`${symbol} 추가 완료`);
    } catch {
      toast.error("추가에 실패했어요. 다시 시도해 주세요");
    }
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">종목 추가</h2>
      <p className="mb-3 text-xs text-muted">
        {isCrypto ? (
          <>
            보유한 코인 티커와 수량을 입력하면 업비트 원화 시세로 평가돼요. 예:{" "}
            <code>BTC</code>(비트코인), <code>ETH</code>(이더리움), <code>XRP</code>(리플).
          </>
        ) : (
          <>
            지금 보유한 종목과 수량을 입력하면 실시간 시세로 평가돼요. 미국: <code>AAPL</code>, <code>VOO</code> / 국내:{" "}
            <code>005930.KS</code>(삼성전자), <code>069500.KS</code>(KODEX200).
          </>
        )}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Select value={market} onChange={setMarket} options={MARKET_OPTS} />
        <Input
          value={symbol}
          onChange={(v) => setSymbol(v.toUpperCase())}
          placeholder={isCrypto ? "코인 티커 (BTC)" : "티커 (AAPL)"}
        />
        <Input value={name} onChange={setName} placeholder="이름(선택)" />
        <Input
          type="number"
          value={shares}
          onChange={setShares}
          placeholder="보유 수량"
        />
        <MoneyInput
          value={avgCost}
          onChange={setAvgCost}
          placeholder={`평단가 (${market === "US" ? "$" : "원"})`}
          className="col-span-2 sm:col-span-1"
        />
      </div>
      <Button onClick={add} className="mt-4 w-full">
        추가
      </Button>
    </Card>
  );
}

// ---------- DCA 시뮬레이터 ----------
function DcaSimulator({
  holdings,
  quotes,
  usdKrw,
}: {
  holdings: Holding[];
  quotes: Record<string, Quote>;
  usdKrw: number;
}) {
  // 현재 보유 평가액 합(원) — "내 자산으로 시작" 버튼이 초기금에 채워줌
  const currentValueKrw = holdings.reduce((s, h) => {
    const price = quotes[h.symbol]?.price ?? h.avg_cost;
    const toKrw = h.currency === "USD" ? usdKrw : 1;
    return s + price * h.shares * toKrw;
  }, 0);

  const [initial, setInitial] = useState("");
  const [monthly, setMonthly] = useState("");
  const [years, setYears] = useState("10");
  const [ret, setRet] = useState("7");

  // 현재 보유 평가액을 초기금으로 채우기 (적립액·수익률은 사용자가 정함)
  function useMyPortfolio() {
    setInitial(String(Math.round(currentValueKrw)));
  }

  const ct = useChartTheme();
  const init = Number(initial) || 0;
  const mo = Number(monthly) || 0;
  const yr = Number(years) || 0;
  const r = Number(ret) || 0;

  const curve = useMemo(
    () => dcaProjectionCurve(init, mo, r, yr),
    [init, mo, r, yr],
  );
  const finalValue = dcaFutureValue(init, mo, r, yr * 12);
  const finalPrincipal = dcaPrincipal(init, mo, yr * 12);
  const profit = finalValue - finalPrincipal;

  // 수익률 시나리오 비교: 보수(-2%p) / 입력값 / 낙관(+3%p)
  const scenarios = [
    { label: "보수적", rate: Math.max(0, r - 2) },
    { label: "입력값", rate: r },
    { label: "낙관적", rate: r + 3 },
  ].map((s) => ({ ...s, value: dcaFutureValue(init, mo, s.rate, yr * 12) }));

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">적립 시뮬레이션</h2>
        <Button variant="ghost" onClick={useMyPortfolio}>
          내 자산으로 시작
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted">
        매월 일정액을 꾸준히 적립(DCA)했을 때 미래 자산을 복리로 계산해요. 미래 주가는 알 수 없으니 “기대수익률”을 가정해 추정합니다.
        “내 자산으로 시작”을 누르면 현재 보유 평가액이 초기 금액에 채워집니다.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="text-xs text-muted">초기 금액(원)</label>
          <MoneyInput value={initial} onChange={setInitial} placeholder="0" />
        </div>
        <div>
          <label className="text-xs text-muted">월 적립(원)</label>
          <MoneyInput
            value={monthly}
            onChange={setMonthly}
            placeholder="500,000"
          />
        </div>
        <div>
          <label className="text-xs text-muted">기간(년)</label>
          <Input type="number" value={years} onChange={setYears} />
        </div>
        <div>
          <label className="text-xs text-muted">기대수익률(%)</label>
          <Input type="number" value={ret} onChange={setRet} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <StatCard
          label={`${yr}년 후 예상 자산`}
          value={`${formatKRW(finalValue)}원`}
          labelRight={`예상 수익 +${formatKRW(profit)}`}
          accent="up"
        />
        <StatCard label="투입 원금" value={`${formatKRW(finalPrincipal)}원`} />
      </div>

      {/* 수익률 시나리오 비교 */}
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-muted">수익률 시나리오 ({yr}년 후)</div>
        <div className="grid grid-cols-3 gap-2">
          {scenarios.map((s) => (
            <div key={s.label} className={`rounded-xl border p-2.5 text-center ${
              s.label === "입력값" ? "border-accent bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : "border-border bg-surface-2"}`}>
              <div className="text-[11px] text-muted">{s.label} {s.rate.toFixed(0)}%</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums">{formatKRW(s.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 목표 금액을 정해놓고 "매월 얼마 필요?"를 알고 싶다면 → 목표 탭에서 역산해줘요 */}
      <p className="mt-3 text-[11px] text-muted">
        “언제까지 얼마”를 정해두고 매월 필요한 적립액을 알고 싶다면 <span className="font-medium text-text">목표 탭</span>에서 거꾸로 계산해 줘요.
      </p>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={curve} margin={{ left: 8, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="gVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ct.line} stopOpacity={0.28} />
                <stop offset="100%" stopColor={ct.line} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
            <XAxis
              dataKey="year"
              tickFormatter={(y) => `${y}년`}
              fontSize={11}
              stroke={ct.axis}
            />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 10000)}만`}
              fontSize={11}
              width={48}
              stroke={ct.axis}
            />
            <Tooltip
              formatter={(v: any) => `${formatKRW(Number(v))}원`}
              labelFormatter={(y) => `${y}년 후`}
              contentStyle={{ background: ct.surface, border: `1px solid ${ct.border}`, borderRadius: 12, color: ct.text }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="value"
              name="평가액"
              stroke={ct.line}
              fill="url(#gVal)"
              strokeWidth={2.5}
            />
            <Area
              type="monotone"
              dataKey="principal"
              name="원금"
              stroke={ct.line2}
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
