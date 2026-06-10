// 자산 계산 엔진 — 저축률, DCA 미래가치, 목표 역산, 성장률

/** 원화 포맷: 1234567 -> "1,234,567" */
export function formatKRW(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

/**
 * 원화 만원 단위 축약 — 자산 구성처럼 "비중을 한눈에" 보는 곳에서 사용.
 *   50,196,885 -> "5,019만원" / 112,445,157 -> "1억 1,244만원" / 7,296,881 -> "729만원"
 * 만원 미만은 버려서 짧게 (정확한 금액이 필요한 곳에는 formatKRW를 쓴다).
 */
export function formatKRWShort(n: number): string {
  const won = Math.round(n);
  const sign = won < 0 ? "-" : "";
  const abs = Math.abs(won);
  if (abs < 10000) return sign + abs.toLocaleString("ko-KR") + "원";
  const manTotal = Math.floor(abs / 10000); // 만원 단위(버림)
  const eok = Math.floor(manTotal / 10000); // 억
  const man = manTotal % 10000; // 나머지 만
  if (eok > 0) {
    return sign + eok.toLocaleString("ko-KR") + "억" +
      (man > 0 ? " " + man.toLocaleString("ko-KR") + "만" : "") + "원";
  }
  return sign + man.toLocaleString("ko-KR") + "만원";
}

/**
 * 통화 기호 포함 포맷.
 * 코인처럼 1원 미만 단위로 거래되는 소액 자산은 원화라도 소수점까지 표시한다.
 *   ₩92,547,000 (BTC) / ₩0.024 (소액 코인) / $230.5 (미국 주식)
 */
export function formatMoney(n: number, currency = "KRW"): string {
  if (currency === "USD") return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const abs = Math.abs(n);
  // 1,000원 미만이면서 정수가 아니면 소액 자산으로 보고 유효 소수까지 표시
  if (abs > 0 && abs < 1000 && !Number.isInteger(n)) {
    const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 8;
    return "₩" + n.toLocaleString("ko-KR", { maximumFractionDigits: digits });
  }
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

/** 퍼센트 포맷 (+/- 부호 포함) */
export function formatPct(n: number, digits = 1): string {
  const s = n >= 0 ? "+" : "";
  return s + n.toFixed(digits) + "%";
}

/** 저축률 = (저축 + 순잉여) / 수입.  여기선 저축액 / 수입 으로 단순화 */
export function savingsRate(income: number, saving: number): number {
  if (income <= 0) return 0;
  return (saving / income) * 100;
}

/**
 * DCA(정액적립) 미래가치 계산.
 * 매월 monthly 금액을 연 annualReturnPct 수익률로 months개월 적립.
 * 초기 보유금액 initial 포함.
 * 월복리 가정.
 */
export function dcaFutureValue(
  initial: number,
  monthly: number,
  annualReturnPct: number,
  months: number
): number {
  const r = annualReturnPct / 100 / 12; // 월 수익률
  if (r === 0) return initial + monthly * months;
  // 초기금 복리 성장
  const fvInitial = initial * Math.pow(1 + r, months);
  // 매월 적립금의 미래가치 (적립식 연금 미래가치 공식, 기말납입)
  const fvMonthly = monthly * ((Math.pow(1 + r, months) - 1) / r);
  return fvInitial + fvMonthly;
}

/** DCA 적립 원금 총합 (수익 제외, 투입한 돈) */
export function dcaPrincipal(initial: number, monthly: number, months: number): number {
  return initial + monthly * months;
}

/**
 * 목표 역산: 목표금액에 도달하려면 매월 얼마를 적립해야 하는가.
 * 초기 보유 initial, 연수익률 annualReturnPct, months개월 동안.
 */
export function requiredMonthly(
  target: number,
  initial: number,
  annualReturnPct: number,
  months: number
): number {
  if (months <= 0) return Math.max(0, target - initial);
  const r = annualReturnPct / 100 / 12;
  const fvInitial = initial * Math.pow(1 + r, months);
  const remaining = target - fvInitial;
  if (remaining <= 0) return 0; // 초기금만으로 이미 도달
  if (r === 0) return remaining / months;
  const factor = (Math.pow(1 + r, months) - 1) / r;
  return remaining / factor;
}

/**
 * 목표 금액에 도달하기까지 걸리는 개월 수.
 * 초기금 initial, 매월 monthly 적립, 연 annualReturnPct 수익(월복리).
 * 도달 불가(예: 적립 0 + 수익 0)면 null.
 */
export function monthsToTarget(
  initial: number,
  monthly: number,
  annualReturnPct: number,
  target: number,
): number | null {
  if (initial >= target) return 0;
  const r = annualReturnPct / 100 / 12;
  // 최대 100년(1200개월)까지 탐색
  const MAX = 1200;
  let lo = 0, hi = MAX;
  // 1200개월 적립해도 목표 미달이면 도달 불가로 간주
  if (dcaFutureValue(initial, monthly, annualReturnPct, MAX) < target) return null;
  // 이분 탐색으로 도달 개월 수 근사
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (dcaFutureValue(initial, monthly, annualReturnPct, mid) >= target) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** 두 시점 사이 개월 수 (YYYY-MM-DD) */
export function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

/** 성장률 % = (현재 - 이전) / 이전 * 100 */
export function growthRate(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** DCA 미래가치 곡선 (연도별 포인트) — 그래프용 */
export function dcaProjectionCurve(
  initial: number,
  monthly: number,
  annualReturnPct: number,
  years: number
): { year: number; principal: number; value: number }[] {
  const out: { year: number; principal: number; value: number }[] = [];
  for (let y = 0; y <= years; y++) {
    const months = y * 12;
    out.push({
      year: y,
      principal: Math.round(dcaPrincipal(initial, monthly, months)),
      value: Math.round(dcaFutureValue(initial, monthly, annualReturnPct, months)),
    });
  }
  return out;
}
