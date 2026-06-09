"use client";
import { ReactNode, useEffect, useState } from "react";

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

export function StatCard({
  label, value, sub, accent = "neutral",
}: {
  label: string; value: ReactNode; sub?: ReactNode;
  accent?: "neutral" | "up" | "down" | "accent";
}) {
  const subColor =
    accent === "up" ? "text-up" :
    accent === "down" ? "text-down" :
    accent === "accent" ? "text-accent-strong" : "text-muted";
  // 값이 길수록(큰 금액) 글자 크기를 자동으로 줄여 카드 밖으로 넘치지 않게 한다.
  const len = typeof value === "string" ? value.length : 0;
  const valueSize =
    len > 16 ? "text-base sm:text-lg" :
    len > 12 ? "text-lg sm:text-xl" :
    "text-xl sm:text-2xl";
  return (
    <Card>
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 break-keep font-bold tracking-tight text-text tabular-nums ${valueSize}`}>{value}</div>
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
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 ${styles} ${className}`}>
      {children}
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
  "w-full min-w-0 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-muted outline-none transition focus:border-accent";

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
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${className}`}>
      {options.map((o) => <option key={o.value} value={o.value} className="bg-surface-2 text-text">{o.label}</option>)}
    </select>
  );
}
