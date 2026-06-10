// 거래/정기항목/통계에서 공용으로 쓰는 카테고리 목록.
// 기본값은 여기에 두고, 가구별로 추가/삭제한 값은 household_settings(key='categories')에 저장한다.
// (CashFlow·Stats·txn-parser 모두 이 기본값과 일치시킨다)

export type CategorySet = {
  income: string[];
  expense: string[];
  saving: string[];
};

export const DEFAULT_CATEGORIES: CategorySet = {
  income: ["월급", "상여/보너스", "사업소득", "이자/배당", "기타수입"],
  expense: ["주거/월세", "관리/공과금", "통신", "식비", "교통/차량", "쇼핑", "문화/여가", "의료/건강", "보험", "교육", "경조사", "기타지출"],
  saving: ["비상금", "예적금", "투자이체", "연금", "기타저축"],
};

// 저장/불러온 값이 망가졌을 때를 대비해 안전하게 정규화한다.
// 각 종류가 배열이 아니거나 비어 있으면 기본값으로 폴백.
export function normalizeCategories(raw: unknown): CategorySet {
  const r = (raw ?? {}) as Partial<Record<keyof CategorySet, unknown>>;
  const pick = (key: keyof CategorySet): string[] => {
    const arr = r[key];
    if (Array.isArray(arr)) {
      const cleaned = arr.map((x) => String(x).trim()).filter(Boolean);
      // 중복 제거
      return Array.from(new Set(cleaned));
    }
    return DEFAULT_CATEGORIES[key];
  };
  return {
    income: pick("income"),
    expense: pick("expense"),
    saving: pick("saving"),
  };
}
