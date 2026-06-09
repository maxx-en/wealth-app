"use client";
import { ReactNode, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * 차트 색상 훅 — recharts는 색을 SVG '속성'으로 넣어서 CSS 변수(var())가 안 먹는다.
 * 그래서 현재 라이트/다크에 맞는 실제 색값을 computed style에서 읽어와 hex로 넘긴다.
 * 시스템 모드가 바뀌면 자동으로 다시 읽는다.
 */
const CHART_VARS = {
  line: "--chart-line", line2: "--chart-line-2", grid: "--chart-grid",
  axis: "--chart-axis", surface: "--surface", border: "--border", text: "--text",
  accent: "--accent", violet: "--violet", up: "--up", down: "--down",
} as const;
type ChartTheme = Record<keyof typeof CHART_VARS, string>;
const CHART_FALLBACK: ChartTheme = {
  line: "#6b8f1d", line2: "#7c3aed", grid: "#e5e4e1", axis: "#9ca3af",
  surface: "#ffffff", border: "#e5e4e1", text: "#18181b",
  accent: "#c6f24e", violet: "#7c3aed", up: "#16a34a", down: "#dc2626",
};

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(CHART_FALLBACK);
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const next = {} as ChartTheme;
      (Object.keys(CHART_VARS) as (keyof typeof CHART_VARS)[]).forEach((k) => {
        next[k] = cs.getPropertyValue(CHART_VARS[k]).trim() || CHART_FALLBACK[k];
      });
      setTheme(next);
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return theme;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

// 값 길이에 따른 글자 크기 클래스. 큰 금액이 카드 밖으로 넘치지 않게 줄인다.
function sizeForLen(len: number) {
  return len > 16 ? "text-base sm:text-lg" :
    len > 12 ? "text-lg sm:text-xl" :
    "text-xl sm:text-2xl";
}

/**
 * 한 줄에 나란히 놓인 StatCard들의 글자 크기를 통일하기 위한 헬퍼.
 * 그룹에서 가장 긴 값에 맞춰 하나의 크기 클래스를 돌려준다.
 * 사용: const vs = statSize(a, b, c); <StatCard valueSize={vs} ... />
 */
export function statSize(...values: ReactNode[]) {
  const maxLen = Math.max(
    0,
    ...values.map((v) => (typeof v === "string" ? v.length : 0)),
  );
  return sizeForLen(maxLen);
}

export function StatCard({
  label, value, sub, labelRight, accent = "neutral", valueSize,
}: {
  label: string; value: ReactNode; sub?: ReactNode;
  labelRight?: ReactNode; // 라벨 줄 오른쪽에 붙는 보조 정보 (예: 예상 수익)
  accent?: "neutral" | "up" | "down" | "accent";
  valueSize?: string; // 그룹 통일 크기. 없으면 자체 값 길이로 계산.
}) {
  const subColor =
    accent === "up" ? "text-up" :
    accent === "down" ? "text-down" :
    accent === "accent" ? "text-accent-strong" : "text-muted";
  const size = valueSize ?? sizeForLen(typeof value === "string" ? value.length : 0);
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        {labelRight != null && (
          <span className={`shrink-0 text-sm font-semibold ${subColor}`}>{labelRight}</span>
        )}
      </div>
      <div className={`mt-1 break-keep font-bold tracking-tight text-text tabular-nums ${size}`}>{value}</div>
      {sub != null && <div className={`mt-1 break-keep text-sm font-medium ${subColor}`}>{sub}</div>}
    </Card>
  );
}

export function Button({
  children, onClick, variant = "primary", type = "button", className = "", disabled,
}: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" | "danger"; type?: "button" | "submit";
  className?: string; disabled?: boolean;
}) {
  const styles = {
    primary: "bg-accent text-[var(--accent-text)] hover:brightness-95",
    ghost: "bg-surface-2 text-text hover:bg-border",
    danger: "bg-[color-mix(in_srgb,var(--down)_18%,transparent)] text-down hover:bg-[color-mix(in_srgb,var(--down)_28%,transparent)]",
  }[variant];
  // 전폭(w-full) 버튼은 폼의 메인 액션 → 더 크고 굵게 위계를 준다.
  const isFullWidth = className.includes("w-full");
  const sizing = isFullWidth
    ? "px-5 py-3.5 text-base font-bold"
    : "px-4 py-2.5 text-sm font-semibold";
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full transition disabled:opacity-40 ${sizing} ${styles} ${className}`}>
      {children}
    </button>
  );
}

/** 켜짐/꺼짐 토글 스위치. 정기항목 사용중/일시중지 등에 사용. */
export function Toggle({
  on, onChange, label,
}: {
  on: boolean; onChange: () => void; label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        on ? "bg-accent" : "bg-border"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function Field({
  label, children, className = "",
}: {
  label: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full min-w-0 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent";

export function Input({
  value, onChange, placeholder, type = "text", className = "",
}: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${className}`}
    />
  );
}

/**
 * 금액 입력 — 화면에는 천단위 쉼표(1,000,000)로 보이고,
 * onChange로는 쉼표 없는 숫자 문자열("1000000")이 넘어간다.
 * 소수점(평단가 $307.34 등)도 허용.
 */
export function MoneyInput({
  value, onChange, placeholder, className = "",
}: {
  value: string | number; onChange: (raw: string) => void;
  placeholder?: string; className?: string;
}) {
  const raw = String(value ?? "");
  // 표시용: 정수부에만 쉼표, 소수부는 그대로
  const display = (() => {
    if (raw === "" || raw === "-") return raw;
    const neg = raw.startsWith("-");
    const [intPart, decPart] = raw.replace("-", "").split(".");
    const withComma = intPart ? Number(intPart).toLocaleString("en-US") : "";
    return (neg ? "-" : "") + withComma + (decPart !== undefined ? "." + decPart : "");
  })();

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        // 숫자·소수점·마이너스만 남김
        let v = e.target.value.replace(/[^\d.-]/g, "");
        // 소수점 1개만 허용
        const firstDot = v.indexOf(".");
        if (firstDot !== -1) {
          v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
        }
        onChange(v);
      }}
      className={`${inputClass} ${className}`}
    />
  );
}

export function Select({
  value, onChange, options, className = "",
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none pr-9`}>
        {options.map((o) => <option key={o.value} value={o.value} className="bg-surface-2 text-text">{o.label}</option>)}
      </select>
      <ChevronDown
        size={16} strokeWidth={1.8}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  );
}
