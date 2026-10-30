import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CurtainReveal } from "@/components/CurtainReveal";
import { ConfettiCannon } from "@/components/ConfettiCannon";
import { InauguralWebsite } from "@/components/InauguralWebsite";
import ribbonImg from "@/assets/ribbon.png";
import scissorsImg from "@/assets/scissors.png";
import curtainTextureUrl from "@/assets/curtain-velvet-blue.jpg";
import { sound } from "@/lib/audio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Website Inauguration — Ceremonial Ribbon Cutting & 3D Flipbook Reveal" },
      {
        name: "description",
        content: "Ceremonial ribbon cutting and official 3D flipbook inauguration reveal.",
      },
      { property: "og:title", content: "Website Inauguration Ceremony & 3D Flipbook" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [textureReady, setTextureReady] = useState(false);
  const [cut, setCut] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const replayKey = 0;

  // Preload curtain texture with instant fallback
  useEffect(() => {
    const img = new Image();
    img.src = curtainTextureUrl;

    const onReady = () => setTextureReady(true);
    if (img.complete && img.naturalWidth !== 0) {
      onReady();
    } else {
      img.onload = onReady;
      img.onerror = onReady;
    }

    const timer = setTimeout(onReady, 200);
    return () => clearTimeout(timer);
  }, []);

  // Cutting the ribbon ceremony
  const cutRibbon = () => {
    if (cut) return;
    setCut(true);
    setShowConfetti(true);
    sound.playCelebrationSequence();

    // Open the velvet curtains after the scissors snip through the ribbon
    window.setTimeout(() => {
      setOpen(true);
    }, 1300);
  };

  // Replay ceremony: close the curtain, re-tie ribbon
  const replay = useCallback(() => {
    setRevealed(false);
    setOpen(false);
    setShowConfetti(false);
    window.setTimeout(() => setCut(false), 1400);
  }, []);

  // Keyboard shortcut: Press R to replay ceremony
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        replay();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [replay]);

  return (
    <main className="stage relative min-h-svh w-full overflow-hidden bg-[#070b14]">
      {/* Confetti Particle Burst on Ribbon Cut */}
      <ConfettiCannon active={showConfetti} />

      {/* Revealed content: Full Website Inauguration Page */}
      <div className="relative z-10 min-h-svh w-full">
        <InauguralWebsite open={open} revealed={revealed} onReplay={replay} />
      </div>

      {/* Full Curtain Overlay */}
      <div
        className="curtain-layer"
        style={{
          pointerEvents: revealed ? "none" : "auto",
          background: textureReady ? "transparent" : "var(--curtain-back)",
          display: revealed ? "none" : "block",
        }}
      >
        {textureReady && (
          <CurtainReveal
            open={open}
            replayKey={replayKey}
            onOpened={() => setRevealed(true)}
          />
        )}
      </div>

      {/* Full-screen click target to cut ribbon on any screen click */}
      {!cut && (
        <div
          onClick={cutRibbon}
          className="fixed inset-0 z-[80] cursor-pointer"
          title="Click anywhere to cut the ribbon"
          aria-label="Click anywhere to cut the ribbon"
        />
      )}

      {/* Ceremonial Ribbon & Scissors Layer */}
      {!revealed && (
        <div className={`ribbon-layer ${cut ? "ribbon-cut" : ""}`}>
          {/* Left Ribbon Half */}
          <img
            src={ribbonImg}
            alt="Ceremonial Inauguration Ribbon"
            className="ribbon-img ribbon-left"
            onClick={cutRibbon}
            title="Click to cut the ribbon"
          />

          {/* Right Ribbon Half */}
          <img
            src={ribbonImg}
            alt="Ceremonial Inauguration Ribbon"
            className="ribbon-img ribbon-right"
            onClick={cutRibbon}
            title="Click to cut the ribbon"
          />

          {/* Ceremonial Scissors */}
          <img
            src={scissorsImg}
            alt="Ceremonial Inauguration Scissors"
            className="ribbon-scissors cursor-pointer"
            onClick={cutRibbon}
            title="Click the scissors to cut the ribbon"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") cutRibbon();
            }}
          />

          {/* Central bow click target */}
          <div
            onClick={cutRibbon}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-32 z-30 cursor-pointer pointer-events-auto"
            title="Click to cut the ribbon"
          />

          {/* Cut Glint Flash */}
          <span className="ribbon-flash" aria-hidden="true" />
        </div>
      )}
    </main>
  );
}
