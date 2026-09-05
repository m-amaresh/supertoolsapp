import { ImageResponse } from "next/og";

export const alt = "SuperTools - Privacy-first browser developer tools";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function TwitterImage() {
  const iconSize = Math.round(size.height * 0.52);
  const iconRadius = Math.round(iconSize * 0.22);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#ffffff",
        padding: "0 72px",
      }}
    >
      {/* Icon block */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: iconSize,
          height: iconSize,
          borderRadius: iconRadius,
          backgroundColor: "#111111",
          flexShrink: 0,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 544 544"
          width={Math.round(iconSize * 0.6)}
          height={Math.round(iconSize * 0.6)}
          fill="#ffffff"
          role="img"
          aria-label="Wrench icon"
        >
          <title>Wrench icon</title>
          <path d="M509.4 98.6c7.6-7.6 20.3-5.7 24.1 4.3 6.8 17.7 10.5 37 10.5 57.1 0 88.4-71.6 160-160 160-17.5 0-34.4-2.8-50.2-8L146.9 498.9c-28.1 28.1-73.7 28.1-101.8 0s-28.1-73.7 0-101.8L232 210.2c-5.2-15.8-8-32.6-8-50.2 0-88.4 71.6-160 160-160 20.1 0 39.4 3.7 57.1 10.5 10 3.8 11.8 16.5 4.3 24.1l-88.7 88.7c-3 3-4.7 7.1-4.7 11.3l0 41.4c0 8.8 7.2 16 16 16l41.4 0c4.2 0 8.3-1.7 11.3-4.7l88.7-88.7z" />
        </svg>
      </div>

      {/* Text block */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginLeft: 48,
        }}
      >
        <div
          style={{
            fontSize: 100,
            fontWeight: 700,
            color: "#111111",
            lineHeight: 1.1,
          }}
        >
          SuperTools
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 500,
            color: "#111111",
            marginTop: 16,
          }}
        >
          Privacy-first browser developer tools
        </div>
      </div>
    </div>,
    { ...size },
  );
}
