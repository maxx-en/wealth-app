// 주식 시세 + 환율 자동조회 (Yahoo Finance 공개 엔드포인트, API 키 불필요)
// 국내: 005930.KS / 035720.KS, 미국: AAPL / TSLA 등
//
// 주의: Yahoo는 쿠키 없이 호출하면 429(Too Many Requests)로 막는다.
// 먼저 fc.yahoo.com에서 쿠키를 받아 두고, 그 쿠키로 시세를 호출해야 한다.

export type Quote = {
  symbol: string;
  price: number;
  currency: string;
  previousClose: number;
  changePct: number;
  name?: string;
};

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

// 받은 쿠키를 메모리에 캐시 (서버 프로세스 단위로 재사용)
let cachedCookie: string | null = null;
let cookieFetchedAt = 0;
const COOKIE_TTL = 1000 * 60 * 30; // 30분

async function getYahooCookie(): Promise<string | null> {
  const now = Date.now();
  if (cachedCookie && now - cookieFetchedAt < COOKIE_TTL) return cachedCookie;
  try {
    const res = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": UA },
      redirect: "manual",
    });
    // set-cookie 헤더에서 쿠키 추출
    const raw = res.headers.get("set-cookie");
    if (raw) {
      cachedCookie = raw.split(";")[0]; // "A3=xxx" 형태만
      cookieFetchedAt = now;
    }
  } catch {
    /* 쿠키 실패해도 일단 진행 (가끔 쿠키 없이도 됨) */
  }
  return cachedCookie;
}

/** 단일 종목 시세 조회 */
export async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const cookie = await getYahooCookie();
    const url = `${YF_BASE}${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      next: { revalidate: 60 }, // 시세 1분 캐시 (과도한 호출 방지)
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const price = meta.regularMarketPrice ?? meta.previousClose;
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
    return {
      symbol: meta.symbol ?? symbol,
      price,
      currency: meta.currency ?? "USD",
      previousClose: prev,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      name: meta.shortName ?? meta.longName,
    };
  } catch {
    return null;
  }
}

/** 여러 종목 동시 조회 */
export async function fetchQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const results = await Promise.all(unique.map((s) => fetchQuote(s)));
  const map: Record<string, Quote> = {};
  results.forEach((q, i) => {
    if (q) map[unique[i]] = q;
  });
  return map;
}

/** USD/KRW 환율 */
export async function fetchUsdKrw(): Promise<number> {
  const q = await fetchQuote("KRW=X");
  return q?.price ?? 1350; // 실패 시 대략값
}
