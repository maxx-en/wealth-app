import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// 로그인 안 한 사용자는 /login으로. (로그인 페이지·인증 API·정적파일은 예외)
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // API 경로는 미들웨어에서 리다이렉트하지 않음 → 각 라우트가 자체적으로 401 응답
  if (pathname.startsWith("/api")) return NextResponse.next();

  // 메타 이미지(브라우저 탭 아이콘·링크 공유 미리보기)는 로그인 없이 공개돼야 동작한다
  if (/^\/(icon|apple-icon|opengraph-image|twitter-image)/.test(pathname)) {
    return NextResponse.next();
  }

  const isPublic = pathname.startsWith("/login");

  if (!isLoggedIn && !isPublic) {
    const url = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  // _next 정적파일, 파비콘 등 제외하고 전부 통과 (메타 이미지 예외는 함수 내부에서 처리)
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
