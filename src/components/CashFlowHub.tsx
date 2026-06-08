"use client";
import { useState } from "react";
import CashFlow from "./CashFlow";
import Stats from "./Stats";

// 현금흐름 = 입력 + 통계를 하나로 묶은 페이지. 상단 하위 토글로 전환.
export default function CashFlowHub() {
  const [view, setView] = useState<"input" | "stats">("input");

  return (
    <div className="space-y-5">
      <div className="flex rounded-xl border border-neutral-200 bg-white p-1">
        <button
          onClick={() => setView("input")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            view === "input" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
          📝 입력
        </button>
        <button
          onClick={() => setView("stats")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            view === "stats" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
          📊 통계
        </button>
      </div>

      {view === "input" ? <CashFlow /> : <Stats />}
    </div>
  );
}
