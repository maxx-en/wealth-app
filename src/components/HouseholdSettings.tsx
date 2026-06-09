"use client";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Card, Button, Input } from "./ui";
import { api, post } from "@/lib/api";
import { X } from "lucide-react";

// 프로필 아바타 — 구글 이미지가 깨지면 이름 이니셜로 폴백
function Avatar({
  src,
  name,
  size = 24,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  const [ok, setOk] = useState(true);
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const style = { width: size, height: size, fontSize: size * 0.45 };
  if (src && ok) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setOk(false)}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={style}
      className="flex items-center justify-center rounded-full bg-surface-2 font-semibold text-muted"
    >
      {initial}
    </div>
  );
}

type Member = { email: string; name: string | null; image: string | null };
type HouseholdData = {
  household: { id: number; name: string; invite_code: string | null } | null;
  members: Member[];
};

export default function HouseholdSettings({
  onClose,
}: {
  onClose: () => void;
}) {
  const { data: session, update } = useSession();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setData(await api<HouseholdData>("/api/household"));
  }
  useEffect(() => {
    load();
  }, []);

  async function makeCode() {
    const r = await post("/api/household", {});
    setCode((r as any).code);
    load();
  }

  async function join() {
    if (!joinCode.trim()) return;
    const res = await fetch("/api/household/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode.trim() }),
    });
    if (res.ok) {
      setMsg("합류 완료! 데이터를 새로 불러옵니다…");
      await update(); // 세션의 householdId 갱신
      setTimeout(() => window.location.reload(), 800);
    } else {
      const e = await res.json();
      setMsg(e.error || "합류 실패");
    }
  }

  const inviteCode = code || data?.household?.invite_code || "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">설정 및 가족 공유</h2>
            <button
              onClick={onClose}
              className="text-muted hover:text-text"
              aria-label="닫기"
            >
              <X size={20} strokeWidth={1.8} />
            </button>
          </div>

          {/* 내 계정 */}
          <div className="mb-5 flex items-center gap-3 rounded-lg bg-surface-2 p-3">
            <Avatar
              src={session?.user?.image}
              name={session?.user?.name}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {session?.user?.name}
              </div>
              <div className="truncate text-xs text-muted">
                {session?.user?.email}
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              로그아웃
            </Button>
          </div>

          {/* 가구 구성원 */}
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold">
              우리 가계부 구성원 ({data?.members.length ?? 0}명)
            </h3>
            <div className="space-y-1">
              {data?.members.map((m) => (
                <div key={m.email} className="flex items-center gap-2 text-sm">
                  <Avatar src={m.image} name={m.name} size={24} />
                  <span>{m.name || m.email}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 초대하기 */}
          <div className="mb-5 border-t border-border pt-4">
            <h3 className="mb-1 text-sm font-semibold">가족 초대하기</h3>
            <p className="mb-2 text-xs text-muted">
              아래 코드를 가족에게 알려주세요. 가족이 로그인 후 코드로 합류에
              입력하면 같은 가계부를 함께 봐요.
            </p>
            {inviteCode ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-center font-mono text-lg font-bold tracking-widest">
                  {inviteCode}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteCode);
                    setMsg("코드 복사됨");
                  }}
                >
                  복사
                </Button>
              </div>
            ) : (
              <Button onClick={makeCode} className="w-full">
                초대 코드 만들기
              </Button>
            )}
          </div>

          {/* 합류하기 */}
          <div className="border-t border-border pt-4">
            <h3 className="mb-1 text-sm font-semibold">코드로 합류하기</h3>
            <p className="mb-2 text-xs text-muted">
              가족에게 받은 초대 코드를 입력하면 그 가계부로 합류해요. (지금 내
              데이터는 더 이상 안 보이게 됩니다)
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={joinCode}
                onChange={(v) => setJoinCode(v.toUpperCase())}
                placeholder="초대 코드 입력"
              />
              <Button onClick={join}>합류</Button>
            </div>
          </div>

          {msg && <p className="mt-3 text-center text-sm text-up">{msg}</p>}
        </Card>
      </div>
    </div>
  );
}
