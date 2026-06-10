// 은행/카드 결제 알림 문자를 붙여넣으면 거래 입력 폼을 자동으로 채우기 위한 파서.
//
// 설계 원칙: 은행마다 줄 순서·키워드가 제각각이라 "줄 위치"가 아니라
// "신호(키워드/패턴)"로 각 필드를 추출한다. 새 은행은 키워드만 보강하면 됨.
//
// 반환값은 CashFlow의 거래 입력 폼 state와 같은 형식(MoneyInput은 콤마 없는 문자열).
import type { Account } from "./queries";

export type ParsedTxn = {
  kind: "income" | "expense" | "saving";
  amount: string; // 콤마 없는 숫자 문자열 ("18900"). 못 찾으면 ""
  date: string; // "YYYY-MM-DD"
  memo: string; // 가맹점명
  category: string; // 추측된 카테고리(CATEGORIES.expense 라벨 중 하나). 실패 시 ""
  bank?: string; // 감지된 은행명(있으면 UI 안내용)
  accountHint?: string; // 계좌 매칭용 원본 힌트("생활통장(0221)")
  ok: boolean; // 금액을 찾아 거래로 인식했는지
};

// 가맹점명 키워드 → 카테고리. 라벨은 CashFlow의 CATEGORIES.expense와 정확히 일치해야 한다.
const CATEGORY_KEYWORDS: { category: string; keywords: string[] }[] = [
  { category: "식비", keywords: ["CU", "GS25", "세븐일레븐", "이마트24", "편의점", "베이크", "카페", "스타벅스", "스벅", "투썸", "이디야", "메가커피", "배달", "배민", "요기요", "쿠팡이츠", "김밥", "치킨", "피자", "버거", "맥도날드", "롯데리아", "식당", "분식", "국밥", "떡볶이", "스시", "파리바게뜨", "뚜레쥬르"] },
  { category: "교통/차량", keywords: ["지하철", "버스", "택시", "카카오T", "카카오모빌리티", "주유", "GS칼텍스", "SK에너지", "S-OIL", "현대오일", "하이패스", "코레일", "SRT", "철도", "주차"] },
  { category: "쇼핑", keywords: ["쿠팡", "11번가", "지마켓", "옥션", "무신사", "다이소", "올리브영", "이마트", "홈플러스", "롯데마트", "마트", "네이버페이", "29CM", "W컨셉"] },
  { category: "문화/여가", keywords: ["CGV", "메가박스", "롯데시네마", "넷플릭스", "유튜브", "왓챠", "티빙", "웨이브", "노래", "PC방", "스팀", "STEAM"] },
  { category: "의료/건강", keywords: ["약국", "병원", "의원", "한의원", "치과", "피부과", "헬스", "필라테스", "요가"] },
  { category: "통신", keywords: ["SKT", "KT", "LG U+", "LGU+", "유플러스", "통신", "알뜰폰"] },
];

// 은행 감지용(있으면 안내 문구에 사용). 본질 동작엔 영향 없음.
const BANK_NAMES = ["케이뱅크", "토스뱅크", "토스", "카카오뱅크", "국민", "KB", "신한", "우리", "하나", "농협", "NH", "기업", "IBK", "새마을", "신협", "우체국", "SC제일", "씨티"];

const INCOME_WORDS = ["입금", "급여", "월급", "상여", "이자", "배당", "환급", "환불", "지원금"];
const EXPENSE_WORDS = ["출금", "결제", "송금", "지불", "이체", "납부", "자동이체"];

/** 콤마 포함 금액 문자열을 숫자로. "18,900" -> 18900 */
function toNumber(s: string): number {
  return Number(s.replace(/[^\d]/g, "")) || 0;
}

/** 거래 내역 텍스트를 파싱해 폼 채울 값으로 변환 */
export function parseTxnText(text: string, todayStr: string): ParsedTxn {
  const raw = text.trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // ── 1. 금액: "숫자,숫자원" 모두 수집하되 '잔액/잔고'가 있는 줄의 금액은 제외(거래후 잔액) ──
  const amountCandidates: number[] = [];
  for (const line of lines) {
    const isBalanceLine = /(잔액|잔고|남은)/.test(line);
    const matches = line.match(/([\d,]+)\s*원/g) ?? [];
    for (const m of matches) {
      const n = toNumber(m);
      if (n > 0 && !isBalanceLine) amountCandidates.push(n);
    }
  }
  const amountNum = amountCandidates[0] ?? 0;

  // ── 2. kind: 수입/지출 키워드 (수입 우선 검사, 없으면 지출 기본) ──
  let kind: ParsedTxn["kind"] = "expense";
  if (INCOME_WORDS.some((w) => raw.includes(w))) kind = "income";
  else if (EXPENSE_WORDS.some((w) => raw.includes(w))) kind = "expense";

  // ── 3. 날짜: YYYY.MM.DD / YYYY-MM-DD 우선, 없으면 MM.DD(올해), 둘 다 없으면 오늘 ──
  let date = todayStr;
  const ymd = raw.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (ymd) {
    date = `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  } else {
    const md = raw.match(/(?:^|[^\d])(\d{1,2})[.\-/](\d{1,2})(?:[^\d]|$)/);
    if (md) {
      const year = todayStr.slice(0, 4);
      date = `${year}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
    }
  }

  // ── 4. 가맹점(memo): "| " 뒤 텍스트 우선(토스형), 없으면 잡음 줄 제외하고 남는 줄 ──
  let memo = "";
  const pipeIdx = raw.indexOf("|");
  if (pipeIdx !== -1) {
    memo = raw
      .slice(pipeIdx + 1)
      .split(/\r?\n/)[0]
      .trim();
  }
  if (!memo) {
    const noise = lines.filter((line) => {
      if (/^\[.*\]/.test(line)) return false; // [은행] 헤더
      if (/([\d,]+)\s*원/.test(line)) return false; // 금액 줄
      if (/\d{4}[.\-/]\d{1,2}/.test(line) || /\d{1,2}:\d{2}/.test(line)) return false; // 날짜/시간 줄
      if (/.+\(\d{4}\)/.test(line)) return false; // 계좌힌트 "생활통장(0221)"
      if (/님의|카드$|카드\s|체크카드|신용카드/.test(line)) return false; // 카드 별칭 줄
      if (/(잔액|잔고)/.test(line)) return false;
      return true;
    });
    memo = noise[0] ?? "";
  }

  // ── 5. 계좌 힌트: "한글+(숫자4자리)" 또는 통장/계좌 단어 줄 ──
  let accountHint: string | undefined;
  const acctLine = lines.find((l) => /.+\(\d{4}\)/.test(l)) ?? lines.find((l) => /(통장|계좌)/.test(l));
  if (acctLine) accountHint = acctLine;

  // ── 6. 카테고리 추측: 가맹점명 키워드 부분일치 (지출일 때만) ──
  let category = "";
  if (kind === "expense" && memo) {
    const upperMemo = memo.toUpperCase();
    for (const { category: cat, keywords } of CATEGORY_KEYWORDS) {
      if (keywords.some((kw) => upperMemo.includes(kw.toUpperCase()))) {
        category = cat;
        break;
      }
    }
  }

  // ── 7. 은행명 감지(안내용) ──
  const bank = BANK_NAMES.find((b) => raw.includes(b));

  return {
    kind,
    amount: amountNum > 0 ? String(amountNum) : "",
    date,
    memo,
    category,
    bank,
    accountHint,
    ok: amountNum > 0,
  };
}

/**
 * 계좌 힌트로 등록된 계좌를 매칭. 못 찾으면 null(사용자 수동 선택).
 *  1) 계좌명이 힌트의 한글 토큰을 포함  (계좌명 "케이뱅크 생활통장" ⊇ "생활통장")
 *  2) 또는 힌트의 끝 4자리가 계좌명에 포함
 */
export function matchAccount(hint: string | undefined, accounts: Account[]): number | null {
  if (!hint || accounts.length === 0) return null;

  // 끝 4자리(계좌번호 일부) 추출
  const digits = hint.match(/\((\d{4})\)/)?.[1] ?? hint.match(/(\d{4})/)?.[1];
  // 한글 토큰(2자 이상) 추출: "생활통장(0221)" -> ["생활통장"]
  const koreanTokens = (hint.match(/[가-힣]{2,}/g) ?? []).filter((t) => t.length >= 2);

  for (const a of accounts) {
    const name = a.name ?? "";
    if (digits && name.includes(digits)) return a.id;
    if (koreanTokens.some((tok) => name.includes(tok) || tok.includes(name))) return a.id;
  }
  return null;
}
