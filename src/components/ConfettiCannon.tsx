import { useEffect, useRef } from "react";

interface ConfettiCannonProps {
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle" | "star";
  opacity: number;
  decay: number;
}

const COLORS = [
  "#FFD700", // Gold
  "#2563EB", // Royal Blue
  "#60A5FA", // Sky Blue
  "#93C5FD", // Light Blue
  "#FFA500", // Amber
  "#FFDF00", // Bright gold
  "#FFFFFF", // Sparkle white
  "#F5E6AB", // Pale champagne gold
];

export function ConfettiCannon({ active }: ConfettiCannonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const particles: Particle[] = [];
    const count = 180;

    // Burst from center-left and center-right and center
    for (let i = 0; i < count; i++) {
      const isLeft = Math.random() < 0.45;
      const isRight = !isLeft && Math.random() < 0.8;

      let startX = width * 0.5;
      let startY = height * 0.5;
      let angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;

      if (isLeft) {
        startX = width * 0.2;
        startY = height * 0.55;
        angle = -Math.PI / 3 + (Math.random() - 0.5) * 0.8;
      } else if (isRight) {
        startX = width * 0.8;
        startY = height * 0.55;
        angle = (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.8;
      }

      const speed = 7 + Math.random() * 15;
      const shapes: ("rect" | "circle" | "star")[] = ["rect", "rect", "circle", "star"];

      particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 6 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        opacity: 1,
        decay: 0.003 + Math.random() * 0.004,
      });
    }

    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      let activeParticles = 0;
      for (const p of particles) {
        if (p.opacity <= 0) continue;
        activeParticles++;

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity
        p.vx *= 0.985; // air resistance
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 4-point golden sparkle star
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.25, -p.size * 0.25);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(p.size * 0.25, p.size * 0.25);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.25, p.size * 0.25);
          ctx.lineTo(-p.size, 0);
          ctx.lineTo(-p.size * 0.25, -p.size * 0.25);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }

      if (activeParticles > 0) {
        animationId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[80]"
      aria-hidden="true"
    />
  );
}
