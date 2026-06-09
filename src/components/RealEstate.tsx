"use client";
import { useEffect, useState } from "react";
import { Card, Button, Input, MoneyInput, StatCard } from "./ui";
import { api, post, del } from "@/lib/api";
import { formatKRW } from "@/lib/finance";
import type { Property } from "@/lib/queries";
import { X } from "lucide-react";

export default function RealEstate() {
  const [props, setProps] = useState<Property[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [loan, setLoan] = useState("");
  const [rate, setRate] = useState("");
  const [payment, setPayment] = useState("");

  async function load() {
    setProps(await api<Property[]>("/api/properties"));
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name) return;
    const p = await post("/api/properties", {
      name,
      market_value: value,
      loan_balance: loan,
      loan_rate: rate,
      monthly_payment: payment,
    });
    setProps(p as Property[]);
    setName("");
    setValue("");
    setLoan("");
    setRate("");
    setPayment("");
  }
  async function remove(id: number) {
    setProps((await del(`/api/properties?id=${id}`)) as Property[]);
  }

  const totalValue = props.reduce((s, p) => s + p.market_value, 0);
  const totalLoan = props.reduce((s, p) => s + p.loan_balance, 0);
  const totalEquity = totalValue - totalLoan;
  const totalPayment = props.reduce((s, p) => s + p.monthly_payment, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="부동산 시세 합" value={`${formatKRW(totalValue)}원`} />
        <StatCard
          label="대출 잔액"
          value={`${formatKRW(totalLoan)}원`}
          accent="down"
        />
        <StatCard
          label="순자산(에쿼티)"
          value={`${formatKRW(totalEquity)}원`}
          accent="up"
        />
        <StatCard label="월 상환액" value={`${formatKRW(totalPayment)}원`} />
      </div>

      <Card>
        <h2 className="mb-1 font-semibold">부동산 추가</h2>
        <p className="mb-3 text-xs text-muted">
          시세는 국토부 실거래가 등을 참고해 직접 입력해요. 시세-대출잔액 =
          순자산(에쿼티)이 대시보드에 반영됩니다.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Input
            value={name}
            onChange={setName}
            placeholder="이름 (예: 우리집)"
          />
          <MoneyInput
            value={value}
            onChange={setValue}
            placeholder="현재 시세(원)"
          />
          <MoneyInput
            value={loan}
            onChange={setLoan}
            placeholder="대출 잔액(원)"
          />
          <Input
            type="number"
            value={rate}
            onChange={setRate}
            placeholder="대출 금리 %"
          />
          <MoneyInput
            value={payment}
            onChange={setPayment}
            placeholder="월 원리금(원)"
          />
        </div>
        <Button onClick={add} className="mt-2 w-full">
          추가
        </Button>
      </Card>

      <div className="space-y-3">
        {props.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            등록된 부동산이 없어요
          </p>
        )}
        {props.map((p) => {
          const equity = p.market_value - p.loan_balance;
          const ltv =
            p.market_value > 0 ? (p.loan_balance / p.market_value) * 100 : 0;
          return (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <div className="text-xs text-muted">
                    금리 {p.loan_rate}% | 월 {formatKRW(p.monthly_payment)}원
                    상환
                  </div>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="text-muted hover:text-down"
                  aria-label="삭제"
                >
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-muted">시세</div>
                  <div className="font-medium">
                    {formatKRW(p.market_value)}원
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">대출</div>
                  <div className="font-medium">
                    {formatKRW(p.loan_balance)}원
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">순자산</div>
                  <div className="font-medium text-up">
                    {formatKRW(equity)}원
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">LTV</div>
                  <div className="font-medium">{ltv.toFixed(0)}%</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
