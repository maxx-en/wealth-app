"use client";
import { useEffect, useState } from "react";
import { Card, Button, Input, MoneyInput, Select, StatCard } from "./ui";
import { api, post, del, put, currentYM, today } from "@/lib/api";
import { formatKRW, savingsRate } from "@/lib/finance";
import type { Account, Transaction, RecurringItem } from "@/lib/queries";

const KIND_LABEL: Record<string, string> = { income: "수입", expense: "지출", saving: "저축" };
const KIND_OPTS = [
  { value: "income", label: "수입" },
  { value: "expense", label: "지출" },
  { value: "saving", label: "저축" },
];
const ACCT_TYPE_OPTS = [
  { value: "checking", label: "입출금" },
  { value: "savings", label: "저축/예적금" },
  { value: "brokerage", label: "증권(현금)" },
  { value: "cash", label: "현금" },
];

// 종류별 기본 카테고리 (직접 입력도 가능)
const CATEGORIES: Record<string, string[]> = {
  income: ["월급", "상여/보너스", "사업소득", "이자/배당", "기타수입"],
  expense: ["주거/월세", "관리/공과금", "통신", "식비", "교통/차량", "쇼핑", "문화/여가", "의료/건강", "보험", "교육", "경조사", "기타지출"],
  saving: ["비상금", "예적금", "투자이체", "연금", "기타저축"],
};

export default function CashFlow() {
  const [ym, setYm] = useState(currentYM());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [msg, setMsg] = useState("");

  async function loadAll() {
    const [a, t, r] = await Promise.all([
      api<Account[]>("/api/accounts"),
      api<Transaction[]>(`/api/transactions?ym=${ym}`),
      api<RecurringItem[]>("/api/recurring"),
    ]);
    setAccounts(a); setTxns(t); setRecurring(r);
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [ym]);

  const income = txns.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
  const saving = txns.filter((t) => t.kind === "saving").reduce((s, t) => s + t.amount, 0);
  const leftover = income - expense - saving;
  const rate = savingsRate(income, saving);
  const acctName = (id: number | null) => accounts.find((a) => a.id === id)?.name ?? "-";

  async function applyRecurring() {
    const r = await post("/api/recurring/materialize", { ym });
    setMsg(`정기항목 ${(r as any).created}건 반영됨`);
    const t = await api<Transaction[]>(`/api/transactions?ym=${ym}`);
    setTxns(t);
    setTimeout(() => setMsg(""), 2500);
  }

  return (
    <div className="space-y-6">
      {/* 월 선택 + 요약 */}
      <div className="flex items-center gap-2">
        <Input type="month" value={ym} onChange={setYm} className="max-w-[180px]" />
        <Button variant="ghost" onClick={applyRecurring}>이번 달 정기항목 반영</Button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="수입" value={`${formatKRW(income)}원`} accent="up" />
        <StatCard label="지출" value={`${formatKRW(expense)}원`} accent="down" />
        <StatCard label="저축" value={`${formatKRW(saving)}원`} accent="blue" />
        <StatCard label="저축률" value={`${rate.toFixed(1)}%`}
          sub={`잉여 ${formatKRW(leftover)}원`} accent={leftover >= 0 ? "up" : "down"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TxnPanel ym={ym} accounts={accounts} txns={txns} acctName={acctName} onChange={setTxns} />
        <div className="space-y-6">
          <RecurringPanel accounts={accounts} recurring={recurring} acctName={acctName} onChange={setRecurring} />
          <AccountPanel accounts={accounts} onChange={setAccounts} />
        </div>
      </div>
    </div>
  );
}

// ---------- 거래 입력/목록 ----------
function TxnPanel({ ym, accounts, txns, acctName, onChange }: {
  ym: string; accounts: Account[]; txns: Transaction[];
  acctName: (id: number | null) => string; onChange: (t: Transaction[]) => void;
}) {
  const [kind, setKind] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState<string>("");

  // 종류가 바뀌면 카테고리 기본값을 그 종류의 첫 항목으로
  function changeKind(k: string) {
    setKind(k);
    setCategory(CATEGORIES[k]?.[0] ?? "");
  }
  // 첫 렌더 시 카테고리 비어있으면 채움
  if (category === "" && CATEGORIES[kind]) {
    setCategory(CATEGORIES[kind][0]);
  }

  async function add() {
    if (!amount) return;
    const r = await post("/api/transactions", {
      kind, amount, category, memo, date, account_id: accountId ? Number(accountId) : null,
    });
    onChange(r as Transaction[]);
    setAmount(""); setMemo("");
  }
  async function remove(id: number) {
    const r = await del(`/api/transactions?id=${id}&ym=${ym}`);
    onChange(r as Transaction[]);
  }

  return (
    <Card>
      <h2 className="mb-3 font-semibold">거래 입력</h2>
      <div className="grid grid-cols-2 gap-2">
        <Select value={kind} onChange={changeKind} options={KIND_OPTS} />
        <Input type="date" value={date} onChange={setDate} />
        <MoneyInput value={amount} onChange={setAmount} placeholder="금액" />
        <Select value={category} onChange={setCategory}
          options={(CATEGORIES[kind] ?? []).map((c) => ({ value: c, label: c }))} />
        <Select value={accountId} onChange={setAccountId}
          options={[{ value: "", label: "계좌 선택(선택)" }, ...accounts.map((a) => ({ value: String(a.id), label: a.name }))]} />
        <Input value={memo} onChange={setMemo} placeholder="메모(선택)" />
      </div>
      <Button onClick={add} className="mt-2 w-full">추가</Button>

      <div className="mt-4 max-h-[360px] space-y-1 overflow-auto">
        {txns.length === 0 && <p className="py-6 text-center text-sm text-neutral-400">이번 달 거래가 없어요</p>}
        {txns.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  t.kind === "income" ? "bg-emerald-100 text-emerald-700" :
                  t.kind === "saving" ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"}`}>
                  {KIND_LABEL[t.kind]}
                </span>
                <span className="truncate text-sm">{t.category || t.memo || "-"}</span>
                {t.recurring_id && <span className="text-[10px] text-neutral-400">🔁</span>}
              </div>
              <div className="text-[11px] text-neutral-400">{t.date} · {acctName(t.account_id)}{t.memo && t.category ? ` · ${t.memo}` : ""}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${t.kind === "income" ? "text-emerald-600" : "text-neutral-700"}`}>
                {t.kind === "income" ? "+" : "-"}{formatKRW(t.amount)}
              </span>
              <button onClick={() => remove(t.id)} className="text-neutral-300 hover:text-rose-500">✕</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- 정기항목 ----------
function RecurringPanel({ accounts, recurring, acctName, onChange }: {
  accounts: Account[]; recurring: RecurringItem[];
  acctName: (id: number | null) => string; onChange: (r: RecurringItem[]) => void;
}) {
  const [kind, setKind] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("주거/월세");
  const [memo, setMemo] = useState("");
  const [day, setDay] = useState("1");
  const [accountId, setAccountId] = useState<string>("");

  function changeKind(k: string) {
    setKind(k);
    setCategory(CATEGORIES[k]?.[0] ?? "");
  }

  async function add() {
    if (!amount) return;
    const r = await post("/api/recurring", {
      kind, amount, category, memo, day_of_month: Number(day),
      account_id: accountId ? Number(accountId) : null,
    });
    onChange(r as RecurringItem[]);
    setAmount(""); setMemo("");
  }
  async function remove(id: number) { onChange((await del(`/api/recurring?id=${id}`)) as RecurringItem[]); }
  async function toggle(it: RecurringItem) {
    onChange((await put("/api/recurring", { id: it.id, active: it.active ? 0 : 1 })) as RecurringItem[]);
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">정기항목 (매월 자동 반복)</h2>
      <p className="mb-3 text-xs text-neutral-400">월세·통신비·구독료·정기저축 등. 등록 후 위에서 “정기항목 반영” 누르면 그 달 거래로 생성돼요.</p>
      <div className="grid grid-cols-2 gap-2">
        <Select value={kind} onChange={changeKind} options={KIND_OPTS} />
        <Input type="number" value={day} onChange={setDay} placeholder="매월 며칠" />
        <MoneyInput value={amount} onChange={setAmount} placeholder="금액" />
        <Select value={category} onChange={setCategory}
          options={(CATEGORIES[kind] ?? []).map((c) => ({ value: c, label: c }))} />
        <Select value={accountId} onChange={setAccountId}
          options={[{ value: "", label: "계좌(선택)" }, ...accounts.map((a) => ({ value: String(a.id), label: a.name }))]} />
        <Input value={memo} onChange={setMemo} placeholder="이름 (예: 월세)" className="col-span-2" />
      </div>
      <Button onClick={add} className="mt-2 w-full">정기항목 추가</Button>

      <div className="mt-3 space-y-1">
        {recurring.map((it) => (
          <div key={it.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={!!it.active} onChange={() => toggle(it)} />
              <span className="text-sm">{it.memo || KIND_LABEL[it.kind]}</span>
              <span className="text-[11px] text-neutral-400">매월 {it.day_of_month}일</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-700">{KIND_LABEL[it.kind]} {formatKRW(it.amount)}</span>
              <button onClick={() => remove(it.id)} className="text-neutral-300 hover:text-rose-500">✕</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// 계좌 잔액 인라인 수정칸 — 쉼표 표시, 포커스 벗어나면 저장
function InlineBalance({ value, onSave }: { value: number; onSave: (raw: string) => void }) {
  const [v, setV] = useState(String(value));
  // 외부 값이 바뀌면 동기화
  useEffect(() => { setV(String(value)); }, [value]);
  return (
    <input
      inputMode="numeric"
      value={v === "" ? "" : Number(v).toLocaleString("en-US")}
      onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={() => onSave(v)}
      className="w-28 rounded border border-neutral-200 px-2 py-1 text-right text-sm" />
  );
}

// ---------- 계좌 ----------
function AccountPanel({ accounts, onChange }: { accounts: Account[]; onChange: (a: Account[]) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [balance, setBalance] = useState("");

  async function add() {
    if (!name) return;
    onChange((await post("/api/accounts", { name, type, balance })) as Account[]);
    setName(""); setBalance("");
  }
  async function remove(id: number) { onChange((await del(`/api/accounts?id=${id}`)) as Account[]); }
  async function updateBal(a: Account, v: string) {
    onChange((await put("/api/accounts", { id: a.id, name: a.name, type: a.type, balance: Number(v) || 0 })) as Account[]);
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">계좌 / 잔액</h2>
      <p className="mb-3 text-xs text-neutral-400">은행 자동연동은 없어요. 잔액은 직접 입력·수정하면 대시보드 자산에 반영됩니다.</p>
      <div className="grid grid-cols-2 gap-2">
        <Input value={name} onChange={setName} placeholder="계좌 이름" />
        <Select value={type} onChange={setType} options={ACCT_TYPE_OPTS} />
        <MoneyInput value={balance} onChange={setBalance} placeholder="현재 잔액" className="col-span-2" />
      </div>
      <Button onClick={add} className="mt-2 w-full">계좌 추가</Button>

      <div className="mt-3 space-y-1">
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50">
            <div className="min-w-0">
              <div className="truncate text-sm">{a.name}</div>
              <div className="text-[11px] text-neutral-400">{ACCT_TYPE_OPTS.find((o) => o.value === a.type)?.label}</div>
            </div>
            <div className="flex items-center gap-1">
              <InlineBalance value={a.balance} onSave={(v) => updateBal(a, v)} />
              <button onClick={() => remove(a.id)} className="text-neutral-300 hover:text-rose-500">✕</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
