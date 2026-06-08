// 클라이언트용 fetch 헬퍼
export async function api<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  // 세션 만료 등으로 인증 끊기면 로그인 페이지로
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const post = (url: string, body: any) =>
  api(url, { method: "POST", body: JSON.stringify(body) });
export const put = (url: string, body: any) =>
  api(url, { method: "PUT", body: JSON.stringify(body) });
export const del = (url: string) => api(url, { method: "DELETE" });

/** 이번 달 YYYY-MM */
export function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** 오늘 YYYY-MM-DD */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
