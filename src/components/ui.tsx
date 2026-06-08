"use client";
import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label, value, sub, accent = "neutral",
}: {
  label: string; value: ReactNode; sub?: ReactNode;
  accent?: "neutral" | "up" | "down" | "blue";
}) {
  const subColor =
    accent === "up" ? "text-emerald-600" :
    accent === "down" ? "text-rose-600" :
    accent === "blue" ? "text-blue-600" : "text-neutral-500";
  return (
    <Card>
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">{value}</div>
      {sub != null && <div className={`mt-1 text-sm font-medium ${subColor}`}>{sub}</div>}
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
    primary: "bg-neutral-900 text-white hover:bg-neutral-700",
    ghost: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-40 ${styles} ${className}`}>
      {children}
    </button>
  );
}

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
      className={`w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 ${className}`}
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
      className={`w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 ${className}`}
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
      className={`w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 ${className}`}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
