"use client";
import { useEffect, useState } from "react";
import { X, Repeat } from "lucide-react";
import { Card, Button, Input, MoneyInput, Select, StatCard, statSize, Toggle, StatCardSkeleton, ListSkeleton } from "./ui";
import { useToast } from "./Toast";
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
  { value: "overdraft", label: "마이너스통장" },
  { value: "loan", label: "대출/기타부채" },
];
// 부채 여부는 계좌 유형이 아니라 '잔액 부호'로 판단한다.
// (마이너스통장이라도 잔액이 +면 자산, −면 부채)
const isDebtBalance = (balance: number) => balance < 0;

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
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      // 이 월에 등록된 정기항목을 먼저 자동 반영(중복은 서버에서 방지) 후 거래를 불러온다.
      // → 사용자가 별도 버튼을 누를 필요 없이, 매달 페이지를 열기만 하면 고정비가 자동 기록됨.
      await post("/api/recurring/materialize", { ym });
      const [a, t, r] = await Promise.all([
        api<Account[]>("/api/accounts"),
        api<Transaction[]>(`/api/transactions?ym=${ym}`),
        api<RecurringItem[]>("/api/recurring"),
      ]);
      setAccounts(a); setTxns(t); setRecurring(r);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [ym]);

  const income = txns.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
  const saving = txns.filter((t) => t.kind === "saving").reduce((s, t) => s + t.amount, 0);
  const leftover = income - expense - saving;
  const rate = savingsRate(income, saving);
  const acctName = (id: number | null) => accounts.find((a) => a.id === id)?.name ?? "-";

  // 거래가 바뀌면 계좌 표시 잔액도 달라지므로 계좌만 다시 불러온다
  async function reloadAccounts() {
    setAccounts(await api<Account[]>("/api/accounts"));
  }

  // 요약 4칸 글자 크기 통일 (가장 긴 값 기준)
  const summarySize = statSize(
    `${formatKRW(income)}원`, `${formatKRW(expense)}원`,
    `${formatKRW(saving)}원`, `${rate.toFixed(1)}%`,
  );

  return (
    <div className="space-y-6">
      {/* 월 선택 */}
      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={ym} onChange={setYm} className="w-40" />
        <span className="text-xs text-muted">정기항목은 이 달에 자동 반영돼요</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading ? <StatCardSkeleton count={4} /> : <>
        <StatCard label="수입" value={`${formatKRW(income)}원`} valueSize={summarySize} accent="up" />
        <StatCard label="지출" value={`${formatKRW(expense)}원`} valueSize={summarySize} accent="down" />
        <StatCard label="저축" value={`${formatKRW(saving)}원`} valueSize={summarySize} accent="accent" />
        <StatCard label="저축률" value={`${rate.toFixed(1)}%`} valueSize={summarySize}
          sub={`잉여 ${formatKRW(leftover)}원`} accent={leftover >= 0 ? "up" : "down"} />
        </>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TxnPanel ym={ym} accounts={accounts} txns={txns} acctName={acctName} onChange={setTxns} onAccountsChange={reloadAccounts} loading={loading} />
        <div className="space-y-6">
          <RecurringPanel accounts={accounts} recurring={recurring} acctName={acctName} onChange={setRecurring} onApplied={loadAll} loading={loading} />
          <AccountPanel accounts={accounts} onChange={setAccounts} loading={loading} />
        </div>
      </div>
    </div>
  );
}

// ---------- 거래 입력/목록 ----------
function TxnPanel({ ym, accounts, txns, acctName, onChange, onAccountsChange, loading }: {
  ym: string; accounts: Account[]; txns: Transaction[];
  acctName: (id: number | null) => string; onChange: (t: Transaction[]) => void;
  onAccountsChange: () => void; // 거래 변경 시 계좌 표시 잔액 갱신용
  loading: boolean;
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

  const toast = useToast();
  async function add() {
    if (!amount) { toast.error("금액을 입력해 주세요"); return; }
    try {
      const r = await post("/api/transactions", {
        kind, amount, category, memo, date, account_id: accountId ? Number(accountId) : null,
      });
      onChange(r as Transaction[]);
      setAmount(""); setMemo("");
      onAccountsChange(); // 계좌 잔액에 반영
      toast.success(`${KIND_LABEL[kind]} ${formatKRW(Number(amount))}원 추가 완료`);
    } catch {
      toast.error("추가에 실패했어요. 다시 시도해 주세요");
    }
  }
  async function remove(id: number) {
    try {
      const r = await del(`/api/transactions?id=${id}&ym=${ym}`);
      onChange(r as Transaction[]);
      onAccountsChange(); // 계좌 잔액에 반영
      toast.success("거래를 삭제했어요");
    } catch {
      toast.error("삭제에 실패했어요");
    }
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
      <Button onClick={add} className="mt-4 w-full">추가</Button>

      <div className="mt-4 max-h-[360px] space-y-1 overflow-auto">
        {loading && <ListSkeleton rows={3} />}
        {!loading && txns.length === 0 && <p className="py-6 text-center text-sm text-muted">이번 달 거래가 없어요</p>}
        {!loading && txns.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  t.kind === "income" ? "bg-[color-mix(in_srgb,var(--up)_18%,transparent)] text-up" :
                  t.kind === "saving" ? "bg-[color-mix(in_srgb,var(--violet)_18%,transparent)] text-violet" : "bg-[color-mix(in_srgb,var(--down)_18%,transparent)] text-down"}`}>
                  {KIND_LABEL[t.kind]}
                </span>
                <span className="truncate text-sm">{t.category || t.memo || "-"}</span>
                {t.recurring_id && <Repeat size={11} strokeWidth={1.8} className="text-muted" />}
              </div>
              <div className="text-[11px] text-muted">{t.date} · {acctName(t.account_id)}{t.memo && t.category ? ` · ${t.memo}` : ""}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${t.kind === "income" ? "text-up" : "text-text"}`}>
                {t.kind === "income" ? "+" : "-"}{formatKRW(t.amount)}
              </span>
              <button onClick={() => remove(t.id)} aria-label="삭제" className="text-muted transition hover:text-down"><X size={16} strokeWidth={1.8} /></button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- 정기항목 ----------
function RecurringPanel({ accounts, recurring, acctName, onChange, onApplied, loading }: {
  accounts: Account[]; recurring: RecurringItem[];
  acctName: (id: number | null) => string; onChange: (r: RecurringItem[]) => void;
  onApplied: () => void; // 정기항목 변경 후 이번 달 거래에 즉시 반영시키기 위한 콜백
  loading: boolean;
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

  const toast = useToast();
  async function add() {
    if (!memo.trim()) { toast.error("이름을 입력해 주세요 (예: 월세)"); return; }
    if (!amount) { toast.error("금액을 입력해 주세요"); return; }
    try {
      const r = await post("/api/recurring", {
        kind, amount, category, memo, day_of_month: Number(day),
        account_id: accountId ? Number(accountId) : null,
      });
      onChange(r as RecurringItem[]);
      setAmount(""); setMemo("");
      onApplied(); // 방금 추가한 정기항목을 이번 달 거래에 바로 반영
      toast.success(`정기항목 “${memo}” 추가 완료`);
    } catch {
      toast.error("추가에 실패했어요. 다시 시도해 주세요");
    }
  }
  async function remove(id: number) {
    try {
      onChange((await del(`/api/recurring?id=${id}`)) as RecurringItem[]);
      toast.success("정기항목을 삭제했어요");
    } catch {
      toast.error("삭제에 실패했어요");
    }
  }
  async function toggle(it: RecurringItem) {
    try {
      onChange((await put("/api/recurring", { id: it.id, active: it.active ? 0 : 1 })) as RecurringItem[]);
      toast.info(it.active ? "일시중지했어요" : "다시 사용해요");
    } catch {
      toast.error("변경에 실패했어요");
    }
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">정기항목 (매월 자동 반복)</h2>
      <p className="mb-3 text-xs text-muted">월세·통신비·구독료·정기저축 등. 등록하면 매월 자동으로 거래에 반영돼요.</p>
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
      <Button onClick={add} className="mt-4 w-full">정기항목 추가</Button>

      <div className="mt-3 space-y-1.5">
        {loading && <ListSkeleton rows={2} />}
        {!loading && recurring.length === 0 && <p className="py-4 text-center text-sm text-muted">등록된 정기항목이 없어요</p>}
        {!loading && recurring.map((it) => {
          const paused = !it.active;
          return (
            <div key={it.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
              <Toggle on={!paused} onChange={() => toggle(it)} label="사용 중 여부" />
              {/* 이름 + 주기·종류·상태 (2줄) */}
              <div className={`min-w-0 flex-1 ${paused ? "opacity-45" : ""}`}>
                <div className="truncate text-sm font-medium">{it.memo || KIND_LABEL[it.kind]}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                  <span>매월 {it.day_of_month}일</span>
                  <span>·</span>
                  <span>{KIND_LABEL[it.kind]}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    paused ? "bg-surface-2 text-muted" : "bg-[color-mix(in_srgb,var(--up)_18%,transparent)] text-up"}`}>
                    {paused ? "일시중지" : "사용 중"}
                  </span>
                </div>
              </div>
              {/* 금액 — 행 전체 기준 세로 가운데 정렬 */}
              <span className={`shrink-0 text-sm font-semibold ${paused ? "text-muted line-through" : "text-text"}`}>{formatKRW(it.amount)}</span>
              <button onClick={() => remove(it.id)} aria-label="삭제" className="shrink-0 text-muted transition hover:text-down"><X size={16} strokeWidth={1.8} /></button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// 계좌 잔액 인라인 수정칸 — 쉼표 표시, 포커스 벗어나면 저장. 음수(−)면 빨강.
// 맨 앞에 −를 붙이면 부채(마이너스), 안 붙이면 자산(양수)로 인식한다.
function InlineBalance({ value, onSave, isDebt = false }: { value: number; onSave: (raw: string) => void; isDebt?: boolean }) {
  const [v, setV] = useState(String(value));
  // 외부 값이 바뀌면 동기화
  useEffect(() => { setV(String(value)); }, [value]);
  // 표시용: 쉼표 포함(음수면 -1,000,000). 입력 중 "-"나 "" 같은 미완성 상태는 그대로 보여준다.
  const display = v === "" || v === "-" ? v
    : Number(v).toLocaleString("en-US");
  return (
    <input
      inputMode="text"
      value={display}
      // 숫자와 맨 앞 −만 허용
      onChange={(e) => {
        let raw = e.target.value.replace(/[^\d-]/g, "");
        const neg = raw.startsWith("-");
        raw = raw.replace(/-/g, "");
        setV((neg ? "-" : "") + raw);
      }}
      // 값이 실제로 바뀐 경우에만 저장한다.
      // (안 건드리고 포커스만 빠지면 저장 안 함 → 거래로 누적된 잔액 기준점이 리셋되지 않음)
      onBlur={() => { if ((Number(v) || 0) !== value) onSave(v); }}
      className={`w-28 rounded-lg border border-border bg-surface-2 px-2 py-1 text-right text-sm ${isDebt ? "text-down" : "text-text"}`} />
  );
}

// ---------- 계좌 ----------
function AccountPanel({ accounts, onChange, loading }: { accounts: Account[]; onChange: (a: Account[]) => void; loading: boolean }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [balance, setBalance] = useState("");

  const toast = useToast();
  async function add() {
    if (!name.trim()) { toast.error("계좌 이름을 입력해 주세요"); return; }
    try {
      onChange((await post("/api/accounts", { name, type, balance })) as Account[]);
      setName(""); setBalance("");
      toast.success(`계좌 “${name}” 추가 완료`);
    } catch {
      toast.error("추가에 실패했어요. 다시 시도해 주세요");
    }
  }
  async function remove(id: number) {
    try {
      onChange((await del(`/api/accounts?id=${id}`)) as Account[]);
      toast.success("계좌를 삭제했어요");
    } catch {
      toast.error("삭제에 실패했어요");
    }
  }
  async function updateBal(a: Account, v: string) {
    try {
      onChange((await put("/api/accounts", { id: a.id, name: a.name, type: a.type, balance: Number(v) || 0 })) as Account[]);
    } catch {
      toast.error("잔액 저장에 실패했어요");
    }
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">계좌 / 잔액</h2>
      <p className="mb-3 text-xs text-muted">거래를 입력하면 잔액에 자동 반영돼요. 실제 잔액과 다르면 직접 수정하면 그 값이 기준이 됩니다.</p>
      <div className="grid grid-cols-2 gap-2">
        <Input value={name} onChange={setName} placeholder="계좌 이름" />
        <Select value={type} onChange={setType} options={ACCT_TYPE_OPTS} />
        <MoneyInput value={balance} onChange={setBalance} placeholder="현재 잔액" className="col-span-2" />
      </div>
      <Button onClick={add} className="mt-4 w-full">계좌 추가</Button>

      <div className="mt-3 space-y-1">
        {loading && <ListSkeleton rows={2} />}
        {!loading && accounts.length === 0 && <p className="py-4 text-center text-sm text-muted">등록된 계좌가 없어요</p>}
        {!loading && accounts.map((a) => {
          const debt = isDebtBalance(a.balance);
          return (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <div className="min-w-0">
              <div className="truncate text-sm">{a.name}</div>
              <div className="text-[11px] text-muted">
                {ACCT_TYPE_OPTS.find((o) => o.value === a.type)?.label}
                {debt && <span className="ml-1 text-down">· 부채</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <InlineBalance value={a.balance} onSave={(v) => updateBal(a, v)} isDebt={debt} />
              <button onClick={() => remove(a.id)} aria-label="삭제" className="text-muted transition hover:text-down"><X size={16} strokeWidth={1.8} /></button>
            </div>
          </div>
          );
        })}
      </div>
    </Card>
  );
}
