import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getOrCreateHouseholdForEmail } from "./db";

// NextAuth v5 설정. 구글 로그인 → 로그인 시 household_id를 세션 토큰에 심는다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    // 로그인 시 이메일로 household를 찾거나 생성해서 토큰에 저장.
    // trigger==="update"(클라이언트 update() 호출) 때도 household를 다시 조회 → 합류 후 갱신.
    async jwt({ token, user, trigger }) {
      const email = user?.email ?? (token.email as string | undefined);
      if (email && (user || trigger === "update" || !token.householdId)) {
        token.householdId = await getOrCreateHouseholdForEmail(
          email, user?.name ?? (token.name as string), user?.image ?? (token.picture as string)
        );
      }
      return token;
    },
    // 세션에 householdId 노출
    async session({ session, token }) {
      if (token.householdId) {
        (session as any).householdId = token.householdId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
