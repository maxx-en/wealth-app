"use client";
import { useState } from "react";
import { LayoutDashboard, ArrowLeftRight, TrendingUp, Target, Building2, Settings } from "lucide-react";
import Dashboard from "@/components/Dashboard";
import CashFlowHub from "@/components/CashFlowHub";
import Investments from "@/components/Investments";
import Goals from "@/components/Goals";
import RealEstate from "@/components/RealEstate";
import HouseholdSettings from "@/components/HouseholdSettings";

const TABS = [
  { key: "dashboard", label: "대시보드", Icon: LayoutDashboard },
  { key: "cashflow", label: "현금흐름", Icon: ArrowLeftRight },
  { key: "invest", label: "투자", Icon: TrendingUp },
  { key: "goals", label: "목표", Icon: Target },
  { key: "realestate", label: "부동산", Icon: Building2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Home() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:pt-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">내 자산 관리</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-medium text-muted transition hover:text-text">
          <Settings size={15} strokeWidth={1.8} /> 설정 · 가족
        </button>
      </header>

      {showSettings && <HouseholdSettings onClose={() => setShowSettings(false)} />}

      {/* 데스크탑 탭 */}
      <nav className="mb-6 hidden gap-1 rounded-2xl border border-border bg-surface p-1 sm:flex">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              tab === key ? "bg-accent text-[var(--accent-text)]" : "text-muted hover:text-text"
            }`}
          >
            <Icon size={17} strokeWidth={1.8} />
            {label}
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
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-center pb-5 sm:hidden">
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface/95 px-2 py-2 backdrop-blur">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-label={label}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                  active ? "bg-accent text-[var(--accent-text)]" : "text-muted hover:text-text"
                }`}
              >
                <Icon size={20} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
