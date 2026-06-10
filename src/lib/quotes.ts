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

// 외부(야후) 호출이 느리거나 막혀도 대시보드가 무한 로딩에 빠지지 않도록
// 모든 fetch에 타임아웃을 건다. 초과하면 reject → 호출부에서 null/기본값 처리.
async function fetchWithTimeout(url: string, init: RequestInit & { next?: any }, ms = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 받은 쿠키를 메모리에 캐시 (서버 프로세스 단위로 재사용)
let cachedCookie: string | null = null;
let cookieFetchedAt = 0;
const COOKIE_TTL = 1000 * 60 * 30; // 30분

async function getYahooCookie(): Promise<string | null> {
  const now = Date.now();
  if (cachedCookie && now - cookieFetchedAt < COOKIE_TTL) return cachedCookie;
  try {
    const res = await fetchWithTimeout("https://fc.yahoo.com", {
      headers: { "User-Agent": UA },
      redirect: "manual",
    }, 3000);
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
    const res = await fetchWithTimeout(url, {
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

// ── 업비트(국내 거래소) 코인 시세 — 원화 기준, 인증 불필요 ──
// 심볼 형식: "KRW-BTC", "KRW-ETH" 등. 업비트 실제 거래가(원)를 그대로 사용하므로
// 달러→원 환율 변환 없이 정확하다.
const UPBIT_TICKER = "https://api.upbit.com/v1/ticker?markets=";
const UPBIT_MARKETS = "https://api.upbit.com/v1/market/all";

// 코인 한글명 캐시 (BTC→비트코인 등). 프로세스 단위 재사용.
let coinNames: Record<string, string> | null = null;
async function getCoinNames(): Promise<Record<string, string>> {
  if (coinNames) return coinNames;
  try {
    const res = await fetchWithTimeout(UPBIT_MARKETS, { headers: { "User-Agent": UA } }, 3000);
    if (!res.ok) return {};
    const list = (await res.json()) as { market: string; korean_name: string }[];
    coinNames = {};
    for (const m of list) coinNames[m.market] = m.korean_name;
    return coinNames;
  } catch {
    return {};
  }
}

/** 업비트 코인 시세 (원화). 심볼들은 모두 "KRW-XXX" 형식이어야 한다. */
async function fetchUpbitQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const map: Record<string, Quote> = {};
  if (symbols.length === 0) return map;
  try {
    const [res, names] = await Promise.all([
      fetchWithTimeout(UPBIT_TICKER + symbols.map(encodeURIComponent).join(","), {
        headers: { "User-Agent": UA },
        next: { revalidate: 60 },
      }),
      getCoinNames(),
    ]);
    if (!res.ok) return map;
    const arr = (await res.json()) as any[];
    for (const t of arr) {
      const sym = t.market as string;
      const price = Number(t.trade_price);
      const prev = Number(t.prev_closing_price) || price;
      map[sym] = {
        symbol: sym,
        price,
        currency: "KRW",
        previousClose: prev,
        changePct: prev ? ((price - prev) / prev) * 100 : 0,
        name: names[sym] ?? sym.replace("KRW-", ""),
      };
    }
  } catch {
    /* 실패 시 빈 맵 — 호출부에서 평단가로 폴백 */
  }
  return map;
}

/** 여러 종목 동시 조회 — "KRW-"로 시작하면 업비트(코인), 그 외엔 야후(주식). */
export async function fetchQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const upbitSyms = unique.filter((s) => s.startsWith("KRW-"));
  const yahooSyms = unique.filter((s) => !s.startsWith("KRW-"));

  const [yahooResults, upbitMap] = await Promise.all([
    Promise.all(yahooSyms.map((s) => fetchQuote(s))),
    fetchUpbitQuotes(upbitSyms),
  ]);

  const map: Record<string, Quote> = { ...upbitMap };
  yahooResults.forEach((q, i) => {
    if (q) map[yahooSyms[i]] = q;
  });
  return map;
}

/** USD/KRW 환율 (환율은 자주 안 변하므로 더 길게 캐시) */
export async function fetchUsdKrw(): Promise<number> {
  try {
    const cookie = await getYahooCookie();
    const url = `${YF_BASE}${encodeURIComponent("KRW=X")}?interval=1d&range=1d`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": UA, ...(cookie ? { Cookie: cookie } : {}) },
      next: { revalidate: 300 }, // 환율 5분 캐시
    });
    if (!res.ok) return 1350;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    return meta?.regularMarketPrice ?? meta?.previousClose ?? 1350;
  } catch {
    return 1350; // 실패 시 대략값
  }
}
