import { ImageResponse } from "next/og";

// 링크 공유(카카오톡·슬랙·트위터 등) 시 뜨는 미리보기 이미지.
// 다크 배경 + 라임 포인트로 앱 무드 그대로. 상승 그래프 모티프로 "자산 성장"을 은유.
export const alt = "WeWorth — 우리의 자산, 함께 키우다";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0b",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        {/* 상단: 심볼 + 워드마크 */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 96,
              height: 96,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#c6f24e",
              borderRadius: 24,
              fontSize: 64,
              fontWeight: 800,
              color: "#1c2b08",
              letterSpacing: -3,
            }}
          >
            W
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#f5f5f5", letterSpacing: -2 }}>
            WeWorth
          </div>
        </div>

        {/* 중앙: 슬로건 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 84, fontWeight: 800, color: "#f5f5f5", letterSpacing: -3, lineHeight: 1.1 }}>
            우리의 자산,
          </div>
          <div style={{ fontSize: 84, fontWeight: 800, color: "#c6f24e", letterSpacing: -3, lineHeight: 1.1 }}>
            함께 키우다
          </div>
        </div>

        {/* 하단: 기능 라인 */}
        <div style={{ display: "flex", fontSize: 32, color: "#8b8d93", fontWeight: 500 }}>
          현금흐름 · 투자 · 자산 · 목표를 한 곳에서
        </div>
      </div>
    ),
    { ...size },
  );
}
