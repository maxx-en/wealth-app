import { ImageResponse } from "next/og";

// iOS 홈화면 추가 시 아이콘. 애플은 자체적으로 모서리를 둥글게 처리하므로
// 꽉 찬 라임 배경 + 큰 "W". (180x180 권장 사이즈)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c6f24e",
          fontSize: 116,
          fontWeight: 800,
          color: "#1c2b08",
          fontFamily: "sans-serif",
          letterSpacing: -6,
        }}
      >
        W
      </div>
    ),
    { ...size },
  );
}
