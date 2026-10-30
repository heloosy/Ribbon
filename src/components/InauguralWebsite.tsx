import { useEffect, useRef } from "react";

export function InauguralWebsite({
  open = false,
  revealed = false,
  onReplay,
}: {
  open?: boolean;
  revealed?: boolean;
  onReplay?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Synchronize flipbook auto-turn: ONLY start flipping after the curtain is completely opened!
  useEffect(() => {
    if (revealed) {
      iframeRef.current?.contentWindow?.postMessage({ type: "START_FLIPBOOK" }, "*");
    } else {
      iframeRef.current?.contentWindow?.postMessage({ type: "RESET_FLIPBOOK" }, "*");
    }
  }, [revealed]);

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[#070b14]">
      {/* Pure Full-Screen 3D PDF Flipbook */}
      <iframe
        ref={iframeRef}
        src="/flipbook/index.html"
        title="NCASTEM 2026 Proceedings — 3D Flipbook"
        className="h-full w-full border-0 bg-[#070b14]"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        loading="eager"
      />

      {/* 100% Pure Full-Screen Flipbook - Zero overlay buttons */}
    </div>
  );
}

