"use client";
import { useState } from "react";
import { PencilLine, PieChart } from "lucide-react";
import CashFlow from "./CashFlow";
import Stats from "./Stats";

// 현금흐름 = 입력 + 통계를 하나로 묶은 페이지. 상단 하위 토글로 전환.
export default function CashFlowHub() {
  const [view, setView] = useState<"input" | "stats">("input");

  return (
    <div className="space-y-5">
      <div className="flex rounded-2xl border border-border bg-surface p-1">
        <button
          onClick={() => setView("input")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
            view === "input" ? "bg-accent text-[var(--accent-text)]" : "text-muted hover:text-text"}`}>
          <PencilLine size={16} strokeWidth={1.8} /> 입력
        </button>
        <button
          onClick={() => setView("stats")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
            view === "stats" ? "bg-accent text-[var(--accent-text)]" : "text-muted hover:text-text"}`}>
          <PieChart size={16} strokeWidth={1.8} /> 통계
        </button>
      </div>

      {view === "input" ? <CashFlow /> : <Stats />}
    </div>
  );
}
