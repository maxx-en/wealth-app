# 내 자산 관리 앱 — 프로젝트 문서

> 일반 직장인의 재무 관리 + 자산 증식(저축·주식·부동산)을 한 곳에서 관리·시뮬레이션하는 웹앱.
> 가족이 함께 쓰는 공유 가계부.

- **배포 주소**: https://wealth-app-tan.vercel.app
- **GitHub**: https://github.com/maxx-en/wealth-app
- **로컬 경로**: `~/Dropbox/Claude/Projects/wealth-app`

---

## 1. 기술 스택

| 구분 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Turbopack) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS |
| 차트 | Recharts |
| DB | Supabase (Postgres), `postgres` 라이브러리 |
| 인증 | NextAuth v5 (구글 로그인) |
| 배포 | Vercel (GitHub 연동 → push 시 자동 배포) |
| 시세 | Yahoo Finance 비공식 API (국내+미국, 환율) |

---

## 2. 화면 구성 (5개 탭)

| 탭 | 내용 |
|---|---|
| 🏠 대시보드 | 순자산·총자산·부채, 자산구성 원그래프, 순자산 추이(월/연 토글), 월별 자동 스냅샷 |
| 💸 현금흐름 | (입력) 수입/지출/저축, 카테고리, 정기항목 자동반복, 계좌 잔액 / (통계) 카테고리별 분석·월별 비교 |
| 📈 투자 | 보유 주식 실시간 시세·평단·수익률, DCA 적립 시뮬레이션 |
| 🎯 목표 | "언제까지 얼마" → 매월 필요 적립액 역산 |
| 🏢 부동산 | 시세·대출·순자산(에쿼티)·LTV (시세 자동조회는 미구현, 수동 입력) |

상단 우측 **⚙️ 설정·가족**: 내 계정/로그아웃, 가구 구성원, 초대 코드 생성·합류.

---

## 3. 데이터 모델 (Postgres)

핵심 개념: **household(가구)** 단위로 데이터 공유. 여러 `app_users`가 하나의 household를 공유.

```
households        가구(가계부). invite_code 보유. 한 가구 = 코드 1개(고정)
app_users         구글 로그인 사용자. email, household_id (소속 가구)
                  ※ Supabase 시스템의 auth.users와 충돌 방지 위해 app_users 명명

── 아래는 전부 household_id 기준 ──
accounts          계좌 (입출금/저축/증권/현금) + 잔액
transactions      거래 (income/expense/saving) + category + date(YYYY-MM-DD)
recurring_items   정기항목 (매월 자동반복) + day_of_month
holdings          보유 주식 (symbol/shares/avg_cost/currency + DCA 설정)
properties        부동산 (시세/대출/금리/월상환)
goals             목표 (목표액/기한/기대수익률)
net_worth_snapshots  월별 순자산 스냅샷 (ym 기준, UNIQUE(household_id, ym))
```

스키마는 `src/lib/db.ts`의 `migrate()`가 첫 쿼리 시 자동 생성/보강(`ADD COLUMN IF NOT EXISTS`).

---

## 4. 폴더 구조

```
src/
├── app/
│   ├── layout.tsx           루트 레이아웃 (SessionProvider)
│   ├── page.tsx             메인 (5개 탭 + 설정 버튼)
│   ├── login/page.tsx       로그인 페이지 (구글)
│   └── api/
│       ├── auth/[...nextauth]/  NextAuth 핸들러
│       ├── accounts, transactions, recurring, recurring/materialize,
│       │   holdings, properties, goals, snapshots, stats, overview, quotes
│       └── household, household/join   가구/초대
├── components/
│   ├── Dashboard, CashFlowHub(→CashFlow+Stats), Investments, Goals, RealEstate
│   ├── HouseholdSettings    설정·가족 모달
│   ├── Providers            SessionProvider 래퍼
│   └── ui.tsx               공통 UI (Card/Button/Input/MoneyInput/Select/StatCard)
├── lib/
│   ├── db.ts                Supabase 연결 + 스키마 + household 헬퍼
│   ├── queries.ts           모든 DB 쿼리 (household_id 기준)
│   ├── auth.ts              NextAuth 설정 (구글, jwt에 householdId 주입)
│   ├── session.ts           currentHouseholdId() — 세션→household_id
│   ├── route-helpers.ts     withHousehold() — API 인증 래퍼(미인증 401)
│   ├── finance.ts           계산 엔진 (저축률/DCA/목표역산/성장률)
│   ├── quotes.ts            Yahoo 시세·환율 (쿠키 받아 호출)
│   └── api.ts               클라이언트 fetch 헬퍼 (401→/login)
└── middleware.ts            미로그인 시 페이지→/login (API는 통과, 각자 401)
```

---

## 5. 환경변수

`.env.local` (로컬) / Vercel 환경변수 (배포). **git에는 올리지 않음.**

| 키 | 설명 |
|---|---|
| `DATABASE_URL` | Supabase 연결 문자열 (Transaction pooler, 포트 6543) |
| `AUTH_SECRET` | NextAuth 세션 암호화 키 (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | 구글 OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | 구글 OAuth Client Secret |

※ `AUTH_URL`은 Vercel에선 넣지 않음(자동 인식). 로컬에선 `http://localhost:3000`.

구글 OAuth redirect URI (구글 클라우드 콘솔에 등록됨):
- `http://localhost:3000/api/auth/callback/google`
- `https://wealth-app-tan.vercel.app/api/auth/callback/google`

구글 OAuth 동의화면: 현재 **Production(게시)** 상태 → 누구나 로그인 가능
(검수 미진행이라 "확인되지 않은 앱" 경고는 뜰 수 있음).

---

## 6. 로컬 개발 / 배포

```bash
# 로컬 실행
cd ~/Dropbox/Claude/Projects/wealth-app
npm install        # 최초 1회
npm run dev        # http://localhost:3000

# 빌드 점검
npm run build
npx tsc --noEmit

# 배포 = git push (Vercel 자동 배포)
git push origin main
```

---

## 7. 핵심 로직 메모

- **시세 자동연동**: Yahoo Finance. 쿠키 없이 호출하면 429 → `fc.yahoo.com`에서 쿠키 받아 재사용. 1분 캐시. 티커: 미국 `AAPL`, 국내 `005930.KS`.
- **환율**: `KRW=X` 시세로 USD→KRW 환산. 종목 없어도 항상 조회.
- **정기항목**: "이번 달 반영" 누르면 그달 거래로 생성, 중복 자동 방지(recurring_id+월 체크).
- **순자산 스냅샷**: 대시보드 접속 시 그달 기록 없으면 자동 1회 저장, 있으면 보존. 수동 버튼으로 갱신. 월 1개(덮어쓰기).
- **금액 입력**: `MoneyInput` — 화면엔 천단위 쉼표, 저장/계산엔 숫자만.
- **초대 코드**: household당 1개 고정. 한 번 생성 후 불변. 같은 코드로 여러 명 합류. 합류자도 같은 코드 봄.

---

## 8. 향후 과제 (미구현 / 디벨롭 후보)

- [ ] **가족 나가기/구성원 내보내기/코드 재발급** — 데이터 귀속 정책 결정 필요
- [ ] **부동산 시세 자동조회** — 국토부 실거래가 공개 API 연동
- [ ] **순자산 자동 기록** — 앱 안 열어도 매월 자동(서버 cron 필요)
- [ ] **외부 서비스화 시**: 개인정보처리방침·이용약관, 구글 브랜드 검수, 보안 강화(RLS 등), Supabase/Vercel 유료 플랜 검토
- [ ] 거래 수정(현재 추가/삭제만), 다중 통화 정교화, 예산 설정

---

## 9. 진행 이력 (요약)

1. Next.js 앱 + SQLite로 5개 탭 MVP (현금흐름·투자·대시보드·목표·부동산)
2. 실시간 시세 연동, DCA 시뮬, 카테고리 통계, 월/연 성장률 토글
3. 현금흐름+통계 통합 (입력/통계 토글)
4. SQLite → Supabase Postgres 전환 + Vercel 배포
5. 구글 로그인 + household 공유 + 초대 코드 + 프로필 폴백
