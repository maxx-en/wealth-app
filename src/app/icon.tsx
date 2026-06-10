import { ImageResponse } from "next/og";

// 브라우저 탭·북마크용 아이콘 (코드 생성 → 어떤 크기든 선명)
// 디자인: 라임 라운드 사각형 위에 진한 올리브 "W" + 상승 그래프 느낌의 포인트 점
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 16,
          fontSize: 40,
          fontWeight: 800,
          color: "#1c2b08",
          fontFamily: "sans-serif",
          letterSpacing: -2,
        }}
      >
        W
      </div>
    ),
    { ...size },
  );
}
