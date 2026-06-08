"use client";
import { useState } from "react";
import Dashboard from "@/components/Dashboard";
import CashFlowHub from "@/components/CashFlowHub";
import Investments from "@/components/Investments";
import Goals from "@/components/Goals";
import RealEstate from "@/components/RealEstate";
import HouseholdSettings from "@/components/HouseholdSettings";

const TABS = [
  { key: "dashboard", label: "대시보드", icon: "🏠" },
  { key: "cashflow", label: "현금흐름", icon: "💸" },
  { key: "invest", label: "투자", icon: "📈" },
  { key: "goals", label: "목표", icon: "🎯" },
  { key: "realestate", label: "부동산", icon: "🏢" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Home() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:pt-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">내 자산 관리</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
          ⚙️ 설정 · 가족
        </button>
      </header>

      {showSettings && <HouseholdSettings onClose={() => setShowSettings(false)} />}

      {/* 데스크탑 탭 */}
      <nav className="mb-6 hidden gap-1 rounded-xl border border-neutral-200 bg-white p-1 sm:flex">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === "dashboard" && <Dashboard />}
        {tab === "cashflow" && <CashFlowHub />}
        {tab === "invest" && <Investments />}
        {tab === "goals" && <Goals />}
        {tab === "realestate" && <RealEstate />}
      </main>

      {/* 모바일 하단 탭바 */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-200 bg-white/95 backdrop-blur sm:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              tab === t.key ? "text-neutral-900" : "text-neutral-400"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
