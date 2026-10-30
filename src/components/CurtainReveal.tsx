import { useEffect, useRef } from "react";
import curtainTextureUrl from "@/assets/curtain-velvet-blue.jpg";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/**
 * Curtain glide shader. The viewport is covered by two mirrored halves of the
 * velvet texture. Each half compresses horizontally as the curtain opens
 * (fabric bunching), slides along the rail, sways with layered sine waves
 * whose amplitude grows toward the free edge, and is re-lit from the analytic
 * derivative of that sway so highlights travel across the folds.
 */
const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform float uTime;
uniform float uP;
varying vec2 vUv;

const float MINW = 0.047;

void main() {
  float x = vUv.x;                 // 0..1 across the viewport
  float v = 1.0 - vUv.y;           // 0 at top, 1 at bottom
  float side = step(0.5, x);       // 0 = left half, 1 = right half
  float xr = mix(x, 1.0 - x, side);
  float w = mix(0.504, MINW, uP);   // visible half-width of each curtain (overlap at the seam)

  float alpha = 1.0 - smoothstep(w - 0.0012, w, xr);
  if (alpha < 0.004) discard;

  float u = clamp(xr / w, 0.0, 1.0);  // 0 outer edge .. 1 free edge
  float t = uTime;

  // --- cloth sway (displacement in u units) ---
  float sway = sin(u * 9.0 - t * 1.05 + side * 2.1)
             + 0.55 * sin(u * 17.0 + t * 1.55 + v * 1.4)
             + 0.35 * sin(u * 31.0 - t * 2.4 + side);
  float env = 0.12 + 0.6 * u * u;      // amplitude grows toward the free edge
  float du = sway * env * 0.05;

  // fabric sliding along the rail as it opens
  float slide = 0.35 * uP;

  float dv = 0.012 * sin(u * 6.0 + t * 1.2 + v * 4.0) * (0.3 + u);

  vec2 tc = vec2(clamp(u + du + slide, 0.0, 1.0), clamp(v + dv, 0.001, 0.999));
  tc.x = mix(tc.x, 1.0 - tc.x, side);  // mirror the right half

  vec3 col = texture2D(uTex, tc).rgb;

  // --- dynamic lighting from the derivative of the sway ---
  float dsway = 9.0 * cos(u * 9.0 - t * 1.05 + side * 2.1)
              + 0.55 * 17.0 * cos(u * 17.0 + t * 1.55 + v * 1.4)
              + 0.35 * 31.0 * cos(u * 31.0 - t * 2.4 + side);
  float light = 1.0 + dsway * env * 0.004;
  light += 0.10 * sin(u * 13.0 + t * 1.3 + side * 3.0) * u;
  col *= clamp(light, 0.6, 1.35);

  // bunching darkens the fabric
  col *= mix(1.0, 0.82, uP * 0.55);

  // free edge: rolled dark rim, stronger once the curtain is drawn
  float rim = smoothstep(0.9, 1.0, u);
  col *= 1.0 - rim * rim * mix(0.35, 0.55, uP);

  // outer edge falls into shadow
  col *= 0.55 + 0.45 * smoothstep(0.0, 0.18, u);

  // top rail shadow and bottom hem shadow
  col *= 0.7 + 0.3 * smoothstep(0.0, 0.1, v);
  col *= 1.0 - 0.35 * smoothstep(0.93, 1.0, v);

  gl_FragColor = vec4(col, alpha);
}
`;

type Tween = { from: number; to: number; start: number; dur: number; fired: boolean };

type CurtainRevealProps = {
  /** true = curtains glide open, false = they glide closed */
  open: boolean;
  /** bump to replay: curtains close quickly, then glide open again */
  replayKey?: number;
  /** called once when the open glide finishes */
  onOpened?: () => void;
};

export function CurtainReveal({ open, replayKey = 0, onOpened }: CurtainRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef(0);
  const tweenRef = useRef<Tween>({ from: 0, to: 0, start: 0, dur: 0, fired: false });
  const pendingOpenRef = useRef(false);
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  // one-time WebGL setup + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const attrs = { alpha: true, premultipliedAlpha: false, antialias: true };
    const gl =
      (canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl", attrs) as WebGLRenderingContext | null);
    if (!gl) return;
    const isGL2 =
      typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) ?? "curtain shader compile error");
      }
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "curtain shader link error");
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);
    const uTimeLoc = gl.getUniformLocation(prog, "uTime");
    const uPLoc = gl.getUniformLocation(prog, "uP");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let textureReady = false;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const img = new Image();
    img.src = curtainTextureUrl;
    const setupTexture = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        isGL2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
      );
      if (isGL2) gl.generateMipmap(gl.TEXTURE_2D);
      textureReady = true;
    };

    if (img.complete && img.naturalWidth !== 0) {
      setupTexture();
    } else {
      img.onload = setupTexture;
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const easeInOutCubic = (k: number) =>
      k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

    const startTween = (to: number, dur: number) => {
      tweenRef.current = {
        from: progressRef.current,
        to,
        start: performance.now(),
        dur: reduced ? 0 : dur,
        fired: false,
      };
    };

    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      resize();

      const tw = tweenRef.current;
      const k = tw.dur <= 0 ? 1 : Math.min(1, (now - tw.start) / tw.dur);
      progressRef.current = tw.from + (tw.to - tw.from) * easeInOutCubic(k);
      if (k >= 1) {
        if (tw.to === 0 && pendingOpenRef.current) {
          pendingOpenRef.current = false;
          startTween(1, 4200);
        } else if (tw.to === 1 && !tw.fired) {
          tw.fired = true;
          onOpenedRef.current?.();
        }
      }

      if (!textureReady) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTimeLoc, (now - t0) / 1000);
      gl.uniform1f(uPLoc, progressRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // glide targets driven by props
  useEffect(() => {
    if (replayKey > 0 && open) {
      pendingOpenRef.current = true;
      tweenRef.current = {
        from: progressRef.current,
        to: 0,
        start: performance.now(),
        dur: 1100,
        fired: false,
      };
    } else {
      pendingOpenRef.current = false;
      tweenRef.current = {
        from: progressRef.current,
        to: open ? 1 : 0,
        start: performance.now(),
        dur: open ? 4200 : 2600,
        fired: false,
      };
    }
  }, [open, replayKey]);

  return <canvas ref={canvasRef} aria-hidden="true" className="curtain-canvas" />;
}
