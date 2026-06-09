"use client";
import { useEffect, useMemo, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { Card, Button, Input, MoneyInput, Select, StatCard, useChartTheme } from "./ui";
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
];

export default function Investments() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [usdKrw, setUsdKrw] = useState(1350);
  const [loading, setLoading] = useState(false);

  async function loadHoldings() {
    const h = await api<Holding[]>("/api/holdings");
    setHoldings(h);
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="총 평가액"
          value={`${formatKRW(totalValueKrw)}원`}
          sub={`환율 ${usdKrw.toFixed(0)}원/$`}
        />
        <StatCard label="투자원금" value={`${formatKRW(totalCostKrw)}원`} />
        <StatCard
          label="평가손익"
          value={`${formatKRW(totalGainKrw)}원`}
          accent={totalGainKrw >= 0 ? "up" : "down"}
        />
        <StatCard
          label="수익률"
          value={formatPct(totalGainPct)}
          accent={totalGainKrw >= 0 ? "up" : "down"}
        />
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
  async function remove(id: number) {
    await del(`/api/holdings?id=${id}`);
    onReload();
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
        <div className="overflow-x-auto">
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
                      {r.h.symbol} · {r.h.market}
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
  const [dcaMonthly, setDcaMonthly] = useState("");
  const [dcaReturn, setDcaReturn] = useState("7");

  async function add() {
    if (!symbol) return;
    await post("/api/holdings", {
      symbol,
      name,
      market,
      shares,
      avg_cost: avgCost,
      currency: market === "KR" ? "KRW" : "USD",
      dca_monthly: dcaMonthly,
      dca_expected_return: dcaReturn,
    });
    setSymbol("");
    setName("");
    setShares("");
    setAvgCost("");
    setDcaMonthly("");
    onSaved();
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">종목 추가</h2>
      <p className="mb-3 text-xs text-muted">
        티커로 입력 — 미국: <code>AAPL</code>, <code>VOO</code> / 국내:{" "}
        <code>005930.KS</code>(삼성전자), <code>069500.KS</code>(KODEX200).
        평단·수량은 직접 입력, 현재가는 자동 조회돼요.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Select value={market} onChange={setMarket} options={MARKET_OPTS} />
        <Input
          value={symbol}
          onChange={(v) => setSymbol(v.toUpperCase())}
          placeholder="티커 (AAPL)"
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
          placeholder={`평단가 (${market === "KR" ? "원" : "$"})`}
        />
        <div />
        <MoneyInput
          value={dcaMonthly}
          onChange={setDcaMonthly}
          placeholder="월 적립액(원)"
        />
        <Input
          type="number"
          value={dcaReturn}
          onChange={setDcaReturn}
          placeholder="기대수익률 %"
        />
      </div>
      <Button onClick={add} className="mt-2 w-full">
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
  // 현재 보유 평가액 합(원) = 시뮬 시작 초기금
  const currentValueKrw = holdings.reduce((s, h) => {
    const price = quotes[h.symbol]?.price ?? h.avg_cost;
    const toKrw = h.currency === "USD" ? usdKrw : 1;
    return s + price * h.shares * toKrw;
  }, 0);
  // 등록된 월 적립액 합
  const portfolioMonthly = holdings.reduce((s, h) => s + h.dca_monthly, 0);
  const avgReturn = holdings.length
    ? holdings.reduce((s, h) => s + h.dca_expected_return, 0) / holdings.length
    : 7;

  const [initial, setInitial] = useState("");
  const [monthly, setMonthly] = useState("");
  const [years, setYears] = useState("10");
  const [ret, setRet] = useState("7");

  // 보유 데이터를 시뮬에 반영하는 버튼
  function useMyPortfolio() {
    setInitial(String(Math.round(currentValueKrw)));
    setMonthly(String(Math.round(portfolioMonthly)));
    setRet(String(Math.round(avgReturn)));
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

  // 수익률 시나리오 비교
  const scenarios = [Math.max(0, r - 2), r, r + 3].map((sr) => ({
    rate: sr,
    value: dcaFutureValue(init, mo, sr, yr * 12),
  }));

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">DCA 적립 시뮬레이션</h2>
        <Button variant="ghost" onClick={useMyPortfolio}>
          내 포트폴리오로 채우기
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted">
        매월 일정액을 꾸준히 적립(DCA)했을 때 미래 자산을 복리로 계산해요. “내
        포트폴리오로 채우기”를 누르면 현재 평가액·월적립액이 자동 입력됩니다.
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

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard
          label="예상 자산"
          value={`${formatKRW(finalValue)}원`}
          sub={`예상 수익 +${formatKRW(profit)}원`}
          accent="up"
        />
        <StatCard label="투입 원금" value={`${formatKRW(finalPrincipal)}원`} />
      </div>

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

      {/* 수익률 시나리오 */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        {scenarios.map((s, i) => (
          <div key={i} className="rounded-lg bg-surface-2 p-2">
            <div className="text-xs text-muted">
              수익률 {s.rate.toFixed(0)}%
            </div>
            <div className="font-semibold">{formatKRW(s.value)}원</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
