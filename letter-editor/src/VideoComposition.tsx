import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import {
  VideoConfig,
  PhotoEntry,
  ActTitle,
  EndingConfig,
  Effect,
  SpotlightConfig,
  TransitionMode,
  TimelineItem,
  OverlayType,
  ParticleType,
  FrameType,
  SplitStyle,
  TitleVariant,
  BackgroundStyle,
  JourneyMap as JourneyMapConfig,
  LetterInterlude as LetterInterludeConfig,
  Collage as CollageConfig,
  FILTER_CSS,
  buildTimeline,
} from "./data";
import { ERA_ICONS } from "./eraIcons";

// ─────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────

const SERIF = "'Cormorant Garamond', 'Nanum Myeongjo', 'Gowun Batang', 'Noto Serif KR', serif";
const SERIF_KR = "'Nanum Myeongjo', 'Gowun Batang', 'Noto Serif KR', serif";
const SCRIPT_KR = "'Gaegu', 'Nanum Pen Script', cursive";
const GOLD = "rgba(168, 136, 72, 0.92)";
const GOLD_SOFT = "rgba(168, 136, 72, 0.5)";
const INK = "#3a2a18";          // warm dark brown (letters on paper)
const INK_SOFT = "rgba(58,42,24,0.55)";
const PAPER = "#f6efde";        // cream paper base
const PAPER_DARK = "#e8dcc0";   // cream paper edges
const BG_DARK = "#0a0a0a";

// ─────────────────────────────────────────────
// Ken Burns with focal point (zoom amount configurable)
// ─────────────────────────────────────────────

const kenBurns = (effect: Effect, t: number, fx = 0.5, fy = 0.5, zoomAmount = 0.08) => {
  const Z = zoomAmount;
  const P = zoomAmount * 0.5;
  const dx = (0.5 - fx) * Z * 2;
  const dy = (0.5 - fy) * Z * 2;
  switch (effect) {
    case "zoomIn":
      return { scale: 1 + Z * t, tx: dx * t, ty: dy * t };
    case "zoomOut":
      return { scale: 1 + Z - Z * t, tx: dx * (1 - t), ty: dy * (1 - t) };
    case "panRight":
      return { scale: 1 + Z * 0.5, tx: -P + P * 2 * t + dx * 0.5, ty: dy * 0.5 };
    case "panLeft":
      return { scale: 1 + Z * 0.5, tx: P - P * 2 * t + dx * 0.5, ty: dy * 0.5 };
    default:
      return { scale: 1, tx: 0, ty: 0 };
  }
};

// ─────────────────────────────────────────────
// Paper background (cream with subtle grain)
// ─────────────────────────────────────────────

// Paper with optional seed variation so each scene has subtly unique grain.
// Also includes a very faint corner stain (rotates per seed) for handmade feel.
const PaperBackground: React.FC<{ seed?: number }> = ({ seed = 2 }) => {
  const s = Math.abs(seed) % 20;
  const freq = 0.82 + (s % 4) * 0.02; // 0.82 - 0.88
  // Corner stain position rotates through 4 corners based on seed
  const stainCorner = s % 4; // 0: TL, 1: TR, 2: BL, 3: BR
  const stainPos =
    stainCorner === 0 ? { top: "8%",    left: "6%"    } :
    stainCorner === 1 ? { top: "10%",   right: "8%"   } :
    stainCorner === 2 ? { bottom: "12%", left: "9%"   } :
                        { bottom: "7%",  right: "11%" };
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, ${PAPER} 0%, ${PAPER_DARK} 100%)` }}>
      <AbsoluteFill style={{
        opacity: 0.12,
        mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' seed='${s}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "400px 400px",
      }} />
      {/* Very faint tea/ink stain in rotated corner — handmade feel */}
      <div style={{
        position: "absolute", ...stainPos,
        width: 260, height: 220,
        background: "radial-gradient(ellipse, rgba(120,85,40,0.10) 0%, rgba(120,85,40,0.04) 40%, transparent 70%)",
        transform: `rotate(${(s * 17) % 360}deg)`,
        pointerEvents: "none",
        mixBlendMode: "multiply",
        opacity: 0.5,
      }} />
    </AbsoluteFill>
  );
};

const BlurBackground: React.FC<{ src: string; extraFilter?: string }> = ({ src, extraFilter }) => (
  <AbsoluteFill>
    <Img src={src} style={{
      width: "100%", height: "100%", objectFit: "cover",
      filter: `blur(40px) brightness(0.55)${extraFilter ? ` ${extraFilter}` : ""}`,
      transform: "scale(1.15)",
    }} />
  </AbsoluteFill>
);

// Simple string hash → number for deterministic seed (sum of char codes).
const hashSeed = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
};

const BackgroundFor: React.FC<{ bg: BackgroundStyle; src?: string; extraFilter?: string; seed?: number }> = ({ bg, src, extraFilter, seed }) => {
  if (bg === "paper") return <PaperBackground seed={seed} />;
  if (bg === "black") return <AbsoluteFill style={{ background: BG_DARK }} />;
  return src ? <BlurBackground src={src} extraFilter={extraFilter} /> : <AbsoluteFill style={{ background: BG_DARK }} />;
};

// ─────────────────────────────────────────────
// Transition helpers
// ─────────────────────────────────────────────

// Computes enter opacity/clipPath/transform for the first CF frames
function enterEffect(mode: TransitionMode, frame: number, cf: number, dur: number) {
  const t = interpolate(frame, [0, cf], [0, 1], { extrapolateRight: "clamp" });
  switch (mode) {
    case "iris-in":
      return { opacity: 1, clipPath: `circle(${t * 120}% at 50% 50%)`, transform: "" };
    case "slide-left":
      return { opacity: 1, clipPath: undefined, transform: `translateX(${(1 - t) * 100}%)` };
    case "slide-right":
      return { opacity: 1, clipPath: undefined, transform: `translateX(${-(1 - t) * 100}%)` };
    case "wipe-down":
      return { opacity: 1, clipPath: `inset(0 0 ${(1 - t) * 100}% 0)`, transform: "" };
    case "none":
      return { opacity: 1, clipPath: undefined, transform: "" };
    default: // fade
      return { opacity: t, clipPath: undefined, transform: "" };
  }
}

function exitEffect(mode: TransitionMode, frame: number, cf: number, dur: number) {
  const t = interpolate(frame, [dur - cf, dur], [0, 1], { extrapolateLeft: "clamp" });
  switch (mode) {
    case "iris-out":
      return { opacity: 1, clipPath: `circle(${(1 - t) * 120}% at 50% 50%)`, transform: "" };
    case "slide-left":
      return { opacity: 1, clipPath: undefined, transform: `translateX(${-t * 100}%)` };
    case "slide-right":
      return { opacity: 1, clipPath: undefined, transform: `translateX(${t * 100}%)` };
    case "wipe-down":
      return { opacity: 1, clipPath: `inset(0 0 0 0)`, transform: "" };
    case "none":
      return { opacity: 1, clipPath: undefined, transform: "" };
    default: // fade
      return { opacity: 1 - t, clipPath: undefined, transform: "" };
  }
}

// ─────────────────────────────────────────────
// Caption overlay
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Overlay / Particle / Frame helpers (declared before scenes that use them)
// ─────────────────────────────────────────────

const OverlayLayer: React.FC<{ type: OverlayType }> = ({ type }) => {
  const frame = useCurrentFrame();
  if (type === "none") return null;

  if (type === "vignette") {
    return <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)" }} />;
  }
  if (type === "film-grain") {
    const seed = frame * 1.618;
    return (
      <AbsoluteFill style={{
        pointerEvents: "none", opacity: 0.08, mixBlendMode: "overlay",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${Math.floor(seed)}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: "256px 256px",
      }} />
    );
  }
  if (type === "light-leak") {
    const t = (frame % 300) / 300;
    const x = 20 + t * 60;
    const hue = (frame * 0.5) % 60;
    return <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at ${x}% 30%, hsla(${hue}, 80%, 70%, 0.18) 0%, transparent 60%)` }} />;
  }
  if (type === "bokeh") {
    const circles = Array.from({ length: 12 }, (_, i) => {
      const s = i * 83.7;
      const x = (s * 3.1 + Math.sin(frame * 0.008 + i) * 15 + 50) % 100;
      const y = (s * 2.3 + Math.cos(frame * 0.006 + i * 2) * 10 + 50) % 100;
      const size = 30 + (i % 4) * 25;
      const opacity = 0.04 + Math.sin(frame * 0.01 + i * 1.5) * 0.02;
      return { x, y, size, opacity };
    });
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {circles.map((c, i) => (
          <div key={i} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: c.size, height: c.size, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,255,255,${c.opacity}) 0%, transparent 70%)`, transform: "translate(-50%, -50%)" }} />
        ))}
      </AbsoluteFill>
    );
  }
  return null;
};

const ParticleLayer: React.FC<{ type: ParticleType }> = ({ type }) => {
  const frame = useCurrentFrame();
  if (type === "none") return null;

  const count = type === "snow" ? 30 : type === "sparkle" ? 25 : type === "hearts" ? 12 : 18;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }, (_, i) => {
        const seed = i * 137.508;
        const speed = 0.3 + (i % 4) * 0.2;
        const x = (seed * 3.1 + Math.sin(frame * 0.015 + i * 2) * 8) % 100;
        const y = ((frame * speed + seed * 2.7) % 130) - 15;
        const vis = y >= -10 && y <= 110;

        if (type === "sparkle") {
          const tw = Math.sin(frame * 0.08 + i * 1.7) * 0.5 + 0.5;
          const sz = 2 + (i % 3) * 2;
          return <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: sz, height: sz, borderRadius: "50%", background: "white", opacity: vis ? tw * 0.8 : 0, boxShadow: `0 0 ${sz * 2}px ${sz}px rgba(255,255,255,0.4)`, transform: "translate(-50%,-50%)" }} />;
        }
        if (type === "petals") {
          const rot = frame * (1 + i % 3) * 0.8 + seed;
          const sz = 8 + (i % 3) * 4;
          return <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: sz, height: sz * 1.2, borderRadius: "50% 0 50% 50%", background: `hsl(${340 + i % 5 * 6}, 65%, 78%)`, opacity: vis ? 0.65 : 0, transform: `translate(-50%,-50%) rotate(${rot}deg)` }} />;
        }
        if (type === "hearts") {
          const sc = 0.6 + Math.sin(frame * 0.04 + i * 3) * 0.2;
          const sy = ((frame * 0.15 + seed * 2.7) % 130) - 15;
          return <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${sy}%`, fontSize: 12 + (i % 3) * 6, opacity: sy >= -10 && sy <= 110 ? 0.35 : 0, transform: `translate(-50%,-50%) scale(${sc})`, color: `hsl(${345 + i % 4 * 5}, 70%, 70%)` }}>&#x2665;</div>;
        }
        const drift = Math.sin(frame * 0.02 + i * 1.3) * 3;
        const sz = 2 + (i % 3) * 2;
        return <div key={i} style={{ position: "absolute", left: `${x + drift}%`, top: `${y}%`, width: sz, height: sz, borderRadius: "50%", background: "white", opacity: vis ? 0.6 : 0, transform: "translate(-50%,-50%)" }} />;
      })}
    </AbsoluteFill>
  );
};

const getFrameStyle = (type: FrameType): React.CSSProperties => {
  switch (type) {
    case "polaroid":
      return { background: "white", padding: "12px 12px 40px 12px", borderRadius: 2, boxShadow: "0 4px 24px rgba(0,0,0,0.4)", transform: "rotate(-1deg)", maxWidth: "78%", maxHeight: "78%" };
    case "film-strip":
      return { background: "#1a1a1a", padding: "28px 12px", borderRadius: 2, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", maxWidth: "83%", maxHeight: "83%", borderTop: "4px solid #333", borderBottom: "4px solid #333" };
    case "rounded":
      return { borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", maxWidth: "88%", maxHeight: "88%" };
    case "classic":
      return { border: "6px solid rgba(232,208,155,0.5)", borderRadius: 2, boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 0 0 2px rgba(232,208,155,0.2)", padding: 4, background: "rgba(232,208,155,0.05)", maxWidth: "86%", maxHeight: "86%" };
    default:
      return { maxWidth: "92%", maxHeight: "92%" };
  }
};

const SpotlightOverlay: React.FC<{ spotlights: SpotlightConfig[] }> = ({ spotlights }) => {
  if (spotlights.length === 0) return null;
  const gradients = spotlights.map(
    (s) => `radial-gradient(ellipse ${s.radius * 120}% ${s.radius * 120}% at ${s.x * 100}% ${s.y * 100}%, transparent 0%, transparent 40%, rgba(0,0,0,1) 100%)`
  );
  // Respect user-set strength — no forced minimum floor (was 0.55, too aggressive)
  const strength = spotlights.reduce((max, s) => Math.max(max, s.strength), 0);
  return (
    <AbsoluteFill style={{
      pointerEvents: "none",
      background: `rgba(0,0,0,${strength})`,
      WebkitMaskImage: gradients.join(", "),
      WebkitMaskComposite: spotlights.length > 1 ? "source-in" : undefined,
      maskImage: gradients.join(", "),
    } as React.CSSProperties} />
  );
};

const CaptionOverlay: React.FC<{
  text: string;
  position: "top" | "bottom" | "center";
  dur: number;
}> = ({ text, position, dur }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [8, 30], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [dur - 22, dur], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  // Subtle vertical drift for elegance
  const translateY = interpolate(frame, [8, 30], [6, 0], { extrapolateRight: "clamp" });

  const posStyle: React.CSSProperties =
    position === "top" ? { top: 72 } :
    position === "center" ? { top: "50%", transform: `translate(0, calc(-50% + ${translateY}px))` } :
    { bottom: 72 };

  return (
    <div style={{
      position: "absolute", left: 0, right: 0, ...posStyle,
      display: "flex", justifyContent: "center", pointerEvents: "none",
      opacity,
    }}>
      <div style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6,
        transform: position !== "center" ? `translateY(${translateY}px)` : undefined,
      }}>
        {/* Thin gold hairline above (appears with text) */}
        <div style={{ width: 32, height: 1, background: GOLD_SOFT, opacity: 0.6 }} />
        {/* Caption text — cream paper label aesthetic */}
        <div style={{
          fontFamily: "'EB Garamond', 'Cormorant Garamond', serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: 32,
          letterSpacing: "0.12em",
          color: "#f5ecd7",
          textShadow: "0 2px 10px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.55)",
          padding: "8px 26px",
          background: "linear-gradient(180deg, rgba(15,12,8,0.28) 0%, rgba(15,12,8,0.42) 100%)",
          backdropFilter: "blur(1.5px)",
          WebkitBackdropFilter: "blur(1.5px)",
          border: "1px solid rgba(232,208,155,0.18)",
          borderRadius: 2,
        }}>
          {text}
        </div>
        {/* Thin gold hairline below */}
        <div style={{ width: 32, height: 1, background: GOLD_SOFT, opacity: 0.6 }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Title Card
// ─────────────────────────────────────────────

const TitleCardScene: React.FC<{
  act: number; titles: Record<number, ActTitle>; dur: number; cf: number;
  variant: TitleVariant;
  overlayType: OverlayType; particlesType: ParticleType;
}> = ({ act, titles, dur, cf, variant, overlayType, particlesType }) => {
  const frame = useCurrentFrame();
  const title = titles[act] ?? { chapter: "", kr: "" };
  const { chapter, kr } = title;
  const effectiveVariant: TitleVariant = title.variant ?? variant;

  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [dur - cf, dur], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Journal variant (cream paper, serif ink, with Act illustration)
  if (effectiveVariant === "journal") {
    const chars = Array.from(kr);
    // Act illustration fades in slowly, stays subtle behind text
    const illuOpacity = interpolate(frame, [0, 40], [0, 0.55], { extrapolateRight: "clamp" });
    const illuScale = interpolate(frame, [0, dur], [1.0, 1.04], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ opacity }}>
        <PaperBackground seed={act * 7} />
        {/* Act illustration as ambient background layer */}
        {act >= 1 && act <= 5 && (
          <AbsoluteFill style={{
            opacity: illuOpacity,
            transform: `scale(${illuScale})`,
            transformOrigin: "center center",
          }}>
            <Img src={`/assets/acts/act-${act}.svg`} style={{
              width: "100%", height: "100%", objectFit: "contain",
              display: "block",
            }} />
          </AbsoluteFill>
        )}
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 28 }}>
          {/* Small uppercase chapter */}
          <div style={{
            color: INK_SOFT, fontFamily: SERIF, fontSize: 24, letterSpacing: 12,
            fontWeight: 400, textTransform: "uppercase",
            opacity: interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            {chapter}
          </div>
          {/* Gold hairline */}
          <div style={{
            width: 64, height: 1, background: GOLD_SOFT,
            opacity: interpolate(frame, [14, 32], [0, 1], { extrapolateRight: "clamp" }),
          }} />
          {/* Korean subtitle — large serif in ink */}
          <div style={{ color: INK, fontFamily: SERIF_KR, fontSize: 88, fontWeight: 400, letterSpacing: 4, display: "flex" }}>
            {chars.map((c, i) => {
              const s = 26 + i * 3;
              return (
                <span key={i} style={{
                  opacity: interpolate(frame, [s, s + 14], [0, 1], { extrapolateRight: "clamp" }),
                  transform: `translateY(${interpolate(frame, [s, s + 14], [10, 0], { extrapolateRight: "clamp" })}px)`,
                  display: "inline-block",
                }}>
                  {c === " " ? "\u00a0" : c}
                </span>
              );
            })}
          </div>
          {/* Year — italic Cormorant, very small, appears last */}
          {title.year && (
            <div style={{
              marginTop: 4,
              fontFamily: "'EB Garamond', 'Cormorant Garamond', serif",
              fontStyle: "italic", fontWeight: 400,
              fontSize: 28, letterSpacing: "0.18em",
              color: "rgba(60, 45, 25, 0.72)",
              opacity: interpolate(frame, [26 + chars.length * 3 + 10, 26 + chars.length * 3 + 28], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(frame, [26 + chars.length * 3 + 10, 26 + chars.length * 3 + 28], [6, 0], { extrapolateRight: "clamp" })}px)`,
            }}>
              {title.year}
            </div>
          )}
        </AbsoluteFill>
        <OverlayLayer type={overlayType} />
        <ParticleLayer type={particlesType} />
      </AbsoluteFill>
    );
  }

  // Standard variant (dark bg, gold + white)
  const chars = Array.from(kr);
  const scale = 1 + 0.025 * (frame / dur);
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: BG_DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${scale})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{
          color: GOLD, fontFamily: SERIF, fontSize: 26, letterSpacing: 10,
          fontWeight: 300, textTransform: "uppercase",
          opacity: interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" }),
        }}>{chapter}</div>
        <div style={{
          width: 72, height: 1, background: GOLD,
          opacity: interpolate(frame, [14, 32], [0, 0.6], { extrapolateRight: "clamp" }),
        }} />
        <div style={{ color: "white", fontFamily: SERIF_KR, fontSize: 76, fontWeight: 400, letterSpacing: 6, display: "flex" }}>
          {chars.map((c, i) => {
            const s = 26 + i * 3;
            return (
              <span key={i} style={{
                opacity: interpolate(frame, [s, s + 14], [0, 1], { extrapolateRight: "clamp" }),
                transform: `translateY(${interpolate(frame, [s, s + 14], [8, 0], { extrapolateRight: "clamp" })}px)`,
                display: "inline-block",
              }}>
                {c === " " ? "\u00a0" : c}
              </span>
            );
          })}
        </div>
      </div>
      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Moment Card Scene ("이때" interstitial — from Claude Design P0-2)
// ─────────────────────────────────────────────

const MomentCardScene: React.FC<{
  l1: string; l2: string; year: string;
  dur: number;
  overlayType: OverlayType; particlesType: ParticleType;
}> = ({ l1, l2, year, dur, overlayType, particlesType }) => {
  const frame = useCurrentFrame();

  // Timing matches Claude Design HTML exactly:
  // Card fades: 0-0.4s in, hold, 0.4s out
  // Subtitle rises at 0.15s, Year at 0.55s, Rule draws 0.30-0.90s
  const fps = 30;
  const cardFadeIn  = interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: "clamp" });
  const cardFadeOut = interpolate(frame, [dur - 0.4 * fps, dur], [1, 0], { extrapolateLeft: "clamp" });
  const cardOpacity = Math.min(cardFadeIn, cardFadeOut);

  const subOpacity = interpolate(frame, [0.15 * fps, 0.55 * fps], [0, 1], { extrapolateRight: "clamp" });
  const subY       = interpolate(frame, [0.15 * fps, 0.55 * fps], [8, 0], { extrapolateRight: "clamp" });

  const yearOpacity = interpolate(frame, [0.55 * fps, 0.95 * fps], [0, 1], { extrapolateRight: "clamp" });
  const yearY       = interpolate(frame, [0.55 * fps, 0.95 * fps], [8, 0], { extrapolateRight: "clamp" });

  const ruleWidth = interpolate(frame, [0.30 * fps, 0.90 * fps], [0, 260], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: cardOpacity }}>
      {/* Cream paper background with subtle radial warmth (from Claude Design) */}
      <AbsoluteFill style={{
        background: `radial-gradient(1400px 900px at 30% 20%, #faf2dc, ${PAPER} 60%), ${PAPER}`,
      }} />
      {/* Hanji fiber noise */}
      <AbsoluteFill style={{
        opacity: 0.25,
        mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.06 0 0 0 0.07 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        backgroundSize: "300px 300px",
      }} />
      {/* Vignette */}
      <AbsoluteFill style={{
        background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(168, 136, 72, 0.09) 85%, rgba(120, 90, 50, 0.16) 100%)",
      }} />
      {/* Center stack (above noise/vignette — not dimmed by multiply layers) */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", zIndex: 10 }}>
        {/* Subtitle — two lines (Nanum Myeongjo 56px) */}
        <div style={{
          fontFamily: SERIF_KR,
          fontWeight: 500,
          fontSize: 56,
          lineHeight: 1.45,
          letterSpacing: "0.02em",
          textAlign: "center",
          color: "#0a0806",
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
          whiteSpace: "nowrap",
        }}>
          <span>{l1}</span>
          <span style={{ fontWeight: 800, display: "block", marginTop: 4 }}>{l2}</span>
        </div>
        {/* Ink rule */}
        <div style={{
          marginTop: 44, marginBottom: 28,
          width: ruleWidth,
          height: 2,
          background: "#0a0806",
          opacity: 0.9,
        }} />
        {/* Year / context (Cormorant 28px, uppercase, wide letter-spacing) */}
        <div style={{
          fontFamily: SERIF,
          fontWeight: 400,
          fontSize: 28,
          letterSpacing: "0.34em",
          textAlign: "center",
          color: "#0a0806",
          opacity: yearOpacity,
          transform: `translateY(${yearY}px)`,
          textTransform: "uppercase",
        }}>
          {year}
        </div>
      </AbsoluteFill>
      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Year Marker Scene (Claude Design P1-2 Variant A — Serene breath)
// ─────────────────────────────────────────────

const YearMarkerScene: React.FC<{
  year: string;
  location: string;
  dur: number;
  overlayType: OverlayType;
  particlesType: ParticleType;
}> = ({ year, location, dur, overlayType, particlesType }) => {
  const frame = useCurrentFrame();
  const fps = 30;

  // Total ~3s. Based on Claude Design v2 "serene" variant:
  // 0.0s card fades in
  // 0.3s "anno" italic pre-label appears
  // 0.6s year appears
  // 0.9-2.1s letter-spacing expands 0→12px
  // 2.1s rule draws in
  // 2.3s location label fades in
  // (dur-0.5)s → dur : fade out

  const cardFadeIn  = interpolate(frame, [0, 0.3 * fps], [0, 1], { extrapolateRight: "clamp" });
  const cardFadeOut = interpolate(frame, [dur - 0.5 * fps, dur], [1, 0], { extrapolateLeft: "clamp" });
  const cardOpacity = Math.min(cardFadeIn, cardFadeOut);

  const preLabelOp  = interpolate(frame, [0.3 * fps, 0.7 * fps], [0, 0.75], { extrapolateRight: "clamp" });
  const yearOp      = interpolate(frame, [0.6 * fps, 1.0 * fps], [0, 1], { extrapolateRight: "clamp" });
  const yearLetter  = interpolate(frame, [0.9 * fps, 2.1 * fps], [0, 12], { extrapolateRight: "clamp" });
  const ruleScale   = interpolate(frame, [2.1 * fps, 2.5 * fps], [0, 1], { extrapolateRight: "clamp" });
  const locationOp  = interpolate(frame, [2.3 * fps, 2.7 * fps], [0, 0.85], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: cardOpacity }}>
      {/* Cream paper + hanji grain */}
      <AbsoluteFill style={{
        background: "radial-gradient(1500px 900px at 50% 50%, #faf2dc, #f5ecd7 55%, #eaddbe 100%)",
      }} />
      <AbsoluteFill style={{
        opacity: 0.55,
        mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.05 0 0 0 0.05 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        backgroundSize: "400px 400px",
      }} />

      <AbsoluteFill style={{
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
      }}>
        {/* "anno" italic pre-label */}
        <div style={{
          fontFamily: "'EB Garamond', 'Cormorant Garamond', serif",
          fontWeight: 400,
          fontStyle: "italic",
          fontSize: 28,
          color: INK_SOFT,
          letterSpacing: "0.3em",
          marginBottom: 28,
          opacity: preLabelOp,
          textTransform: "lowercase",
        }}>
          anno
        </div>

        {/* Year — big serif */}
        <div style={{
          fontFamily: "'EB Garamond', 'Cormorant Garamond', serif",
          fontWeight: 400,
          fontSize: 240,
          lineHeight: 1,
          color: INK,
          letterSpacing: `${yearLetter}px`,
          opacity: yearOp,
        }}>
          {year}
        </div>

        {/* Thin ink rule */}
        <div style={{
          marginTop: 40,
          width: 1.5,
          height: 80,
          background: INK,
          opacity: 0.8,
          transform: `scaleY(${ruleScale})`,
          transformOrigin: "top",
        }} />

        {/* Location subtitle */}
        <div style={{
          marginTop: 30,
          fontFamily: SERIF_KR,
          fontSize: 30,
          color: INK_SOFT,
          letterSpacing: "0.42em",
          opacity: locationOp,
        }}>
          {location}
        </div>
      </AbsoluteFill>
      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Journey Map Scene (Claude Design P2-2)
// ─────────────────────────────────────────────

// Journey map locations (5 points, shared across all Act maps).
// Coordinates tuned for balanced layout on 1920×1080 with smooth catmull-rom curves.
const JOURNEY_LOCATIONS = [
  { cx: 260,  cy: 490, label: "성모병원",    year: "1988 · 1993", anchor: "start",  lx: -8,  ly: -34 },
  { cx: 540,  cy: 660, label: "분당",        year: "1994 —",      anchor: "middle", lx:  0,  ly:  58 },
  { cx: 880,  cy: 380, label: "청춘",        year: "2010 —",      anchor: "middle", lx:  0,  ly: -34 },
  { cx: 1300, cy: 590, label: "뉴욕 · 서울", year: "2016 —",      anchor: "middle", lx:  0,  ly:  58 },
  { cx: 1650, cy: 380, label: "여기, 오늘",  year: "2026",        anchor: "end",    lx:  8,  ly: -34 },
];

// Smooth cubic beziers between consecutive points — catmull-rom-derived control points.
const JOURNEY_SEGMENTS = [
  "M 260 490 C 353 547, 437 678, 540 660",
  "M 540 660 C 643 642, 753 392, 880 380",
  "M 880 380 C 1007 368, 1172 590, 1300 590",
  "M 1300 590 C 1428 590, 1533 450, 1650 380",
];

// Raw stops for plane linear interpolation.
const JOURNEY_STOPS: [number, number][] = JOURNEY_LOCATIONS.map((L) => [L.cx, L.cy]);

const JourneyMapScene: React.FC<{
  config: JourneyMapConfig;
  dur: number;
  overlayType: OverlayType;
  particlesType: ParticleType;
}> = ({ config, dur, overlayType, particlesType }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, Math.min(1, frame / dur));

  const vc = Math.max(1, Math.min(JOURNEY_LOCATIONS.length, config.visibleCount ?? JOURNEY_LOCATIONS.length));
  const presentIdx = vc - 1;           // index of the "present" location
  const hasPresentLeg = vc >= 2;        // is there a previous location → plane animates

  // Title / subtitle / caption
  const titleOp = interpolate(t, [0.03, 0.12, 0.92, 1.0], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const subOp   = interpolate(t, [0.06, 0.16, 0.92, 1.0], [0, 0.85, 0.85, 0], { extrapolateRight: "clamp" });
  const capOp   = interpolate(t, [0.72, 0.85, 0.95, 1.0], [0, 0.85, 0.85, 0], { extrapolateRight: "clamp" });

  // Base fade-in (shared) and global fade-out
  const baseFade = interpolate(t, [0.08, 0.22, 0.92, 1.0], [0, 1, 1, 0], { extrapolateRight: "clamp" });

  // Past: solid (already traveled, confidently drawn)
  const pastOp   = baseFade * 0.82;
  // Future: pale preview (foreshadows the road ahead)
  const futureOp = baseFade * 0.22;

  // Present emphasis timeline:
  //   • Act 1 (no plane): present emerges early (0.10→0.28) and then pulses
  //   • Act 2+ (with plane): present stays pale (future-level) until plane arrives, then emphasizes (0.72→0.85)
  const presentEmphasizeStart = hasPresentLeg ? 0.72 : 0.10;
  const presentEmphasizeEnd   = hasPresentLeg ? 0.85 : 0.28;

  // Opacity lerps from the "pre" state (futureOp for Act 2+, 0 for Act 1) to full baseFade
  const presentPreOp = hasPresentLeg ? futureOp : 0;
  const presentOp = interpolate(
    t,
    [0.08, 0.22, presentEmphasizeStart, presentEmphasizeEnd, 0.92, 1.0],
    [0, presentPreOp, presentPreOp, baseFade, baseFade, 0],
    { extrapolateRight: "clamp" },
  );

  // Scale grows into emphasis
  const presentScale = interpolate(
    t,
    [presentEmphasizeStart, presentEmphasizeEnd],
    [0.88, 1.12],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Gentle pulse after emphasis has landed — subtle (~6% amplitude, slow sine)
  const pulseActive = t > presentEmphasizeEnd;
  const pulsePhase = (t - presentEmphasizeEnd) * 9.0;
  const pulse = pulseActive ? 1 + 0.06 * Math.sin(pulsePhase) : 1;
  const pulseOp = pulseActive ? 1 + 0.08 * Math.sin(pulsePhase + 0.4) : 1;

  // Plane animation (Act 2+)
  const planeT = hasPresentLeg
    ? interpolate(t, [0.40, 0.78], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const planeVis = hasPresentLeg
    ? interpolate(t, [0.36, 0.42, 0.76, 0.82], [0, 1, 1, 0], { extrapolateRight: "clamp" })
    : 0;
  const planeStart = hasPresentLeg ? JOURNEY_STOPS[presentIdx - 1] : JOURNEY_STOPS[0];
  const planeEnd   = JOURNEY_STOPS[presentIdx];
  const px = planeStart[0] + (planeEnd[0] - planeStart[0]) * planeT;
  const py = planeStart[1] + (planeEnd[1] - planeStart[1]) * planeT;
  const angle = Math.atan2(planeEnd[1] - planeStart[1], planeEnd[0] - planeStart[0]) * 180 / Math.PI;

  // Present-segment dash-draw (animates as plane takes off)
  const segDashOffset = hasPresentLeg
    ? interpolate(t, [0.28, 0.52], [1200, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1200;
  const segOp = hasPresentLeg
    ? interpolate(t, [0.26, 0.34, 0.92, 1.0], [0, 0.85, 0.85, 0], { extrapolateRight: "clamp" })
    : 0;

  const autoSubtitle = JOURNEY_LOCATIONS.slice(0, vc).map((L) => L.label).join(" · ");
  const presentLoc = JOURNEY_LOCATIONS[presentIdx];

  return (
    <AbsoluteFill>
      {/* Cream paper */}
      <AbsoluteFill style={{ background: "radial-gradient(1400px 900px at 50% 50%, #faf2dc, #f5ecd7 55%, #eaddbe 100%)" }} />
      <AbsoluteFill style={{
        opacity: 0.45, mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.05 0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
      }} />

      {/* Top banner */}
      <div style={{
        position: "absolute", top: 64, left: 0, right: 0, textAlign: "center",
        fontFamily: "'EB Garamond', serif", fontStyle: "italic", fontWeight: 400,
        fontSize: 38, letterSpacing: "0.22em", color: "#3a2f22",
        textTransform: "uppercase", opacity: titleOp,
      }}>{config.title ?? "Our Journey"}</div>
      <div style={{
        position: "absolute", top: 120, left: 0, right: 0, textAlign: "center",
        fontFamily: SERIF_KR, fontSize: 26, color: INK, letterSpacing: "0.2em",
        opacity: subOp,
      }}>{(config.subtitle && config.subtitle.trim()) || autoSubtitle}</div>

      {/* Map SVG */}
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {/* Compass */}
        <g transform="translate(1780, 140)" stroke={INK} fill="none" strokeWidth={1.4} opacity={0.5}>
          <circle r={34} />
          <path d="M 0 -28 L 4 -4 L 0 0 L -4 -4 Z" fill={INK} stroke="none" />
          <path d="M 0 28 L 4 4 L 0 0 L -4 4 Z" />
          <path d="M 28 0 L 4 -4 L 0 0 L 4 4 Z" />
          <path d="M -28 0 L -4 -4 L 0 0 L -4 4 Z" />
          <text x={0} y={-44} fontFamily="EB Garamond" fontStyle="italic" fontSize={14} textAnchor="middle" fill="#3a2f22" stroke="none" opacity={0.8}>N</text>
        </g>

        {/* Future segments (pale preview of the road ahead) */}
        {JOURNEY_SEGMENTS.slice(presentIdx).map((d, i) => (
          <path key={`future-seg-${i}`} d={d} fill="none" stroke={INK} strokeWidth={1.4}
                strokeDasharray="2 12" strokeLinecap="round" opacity={futureOp * 0.9} />
        ))}

        {/* Past segments (solid-faded) */}
        {JOURNEY_SEGMENTS.slice(0, Math.max(0, presentIdx - 1)).map((d, i) => (
          <path key={`past-seg-${i}`} d={d} fill="none" stroke={INK} strokeWidth={2}
                strokeDasharray="5 9" strokeLinecap="round" opacity={pastOp} />
        ))}

        {/* Present segment (animates as plane takes off) */}
        {hasPresentLeg && (
          <path d={JOURNEY_SEGMENTS[presentIdx - 1]} fill="none" stroke={INK} strokeWidth={2.5}
                strokeDasharray="6 10" strokeLinecap="round"
                style={{ strokeDashoffset: segDashOffset, opacity: segOp }} />
        )}

        {/* Future dots (pale preview) */}
        {JOURNEY_LOCATIONS.slice(presentIdx + 1).map((L) => (
          <g key={`future-loc-${L.label}`} opacity={futureOp}>
            <circle cx={L.cx} cy={L.cy} r={6} stroke={INK} fill="none" strokeWidth={1.2} />
            <circle cx={L.cx} cy={L.cy} r={3.5} fill={INK} />
            <text x={L.cx + L.lx} y={L.cy + L.ly} textAnchor={L.anchor as "start" | "middle" | "end"}
                  fontFamily="'Nanum Pen Script', cursive" fontSize={30} fill={INK}>{L.label}</text>
            <text x={L.cx + L.lx} y={L.cy + L.ly + 20} textAnchor={L.anchor as "start" | "middle" | "end"}
                  fontFamily="'EB Garamond', serif" fontStyle="italic" fontSize={16} fill="#3a2f22">{L.year}</text>
          </g>
        ))}

        {/* Past dots (solid, already traveled) */}
        {JOURNEY_LOCATIONS.slice(0, presentIdx).map((L) => (
          <g key={`past-loc-${L.label}`} opacity={pastOp}>
            <circle cx={L.cx} cy={L.cy} r={14} fill={INK} opacity={0.12} />
            <circle cx={L.cx} cy={L.cy} r={7} stroke={INK} fill="none" strokeWidth={1.6} />
            <circle cx={L.cx} cy={L.cy} r={5} fill={INK} />
            <text x={L.cx + L.lx} y={L.cy + L.ly} textAnchor={L.anchor as "start" | "middle" | "end"}
                  fontFamily="'Nanum Pen Script', cursive" fontSize={38} fill={INK}>{L.label}</text>
            <text x={L.cx + L.lx} y={L.cy + L.ly + 22} textAnchor={L.anchor as "start" | "middle" | "end"}
                  fontFamily="'EB Garamond', serif" fontStyle="italic" fontSize={20} fill="#3a2f22">{L.year}</text>
          </g>
        ))}

        {/* Present dot — emphasized, grows, pulses */}
        <g opacity={Math.min(1, presentOp * pulseOp)}
           transform={`translate(${presentLoc.cx} ${presentLoc.cy}) scale(${presentScale * pulse}) translate(${-presentLoc.cx} ${-presentLoc.cy})`}>
          <circle cx={presentLoc.cx} cy={presentLoc.cy} r={26} fill={INK} opacity={0.16} />
          <circle cx={presentLoc.cx} cy={presentLoc.cy} r={13} stroke={INK} fill="none" strokeWidth={2.6} />
          <circle cx={presentLoc.cx} cy={presentLoc.cy} r={7.5} fill={INK} />
          <text x={presentLoc.cx + presentLoc.lx} y={presentLoc.cy + presentLoc.ly}
                textAnchor={presentLoc.anchor as "start" | "middle" | "end"}
                fontFamily="'Nanum Pen Script', cursive" fontSize={52} fill={INK}>{presentLoc.label}</text>
          <text x={presentLoc.cx + presentLoc.lx} y={presentLoc.cy + presentLoc.ly + 28}
                textAnchor={presentLoc.anchor as "start" | "middle" | "end"}
                fontFamily="'EB Garamond', serif" fontStyle="italic" fontSize={26} fill="#3a2f22">{presentLoc.year}</text>
        </g>

        {/* Plane */}
        {planeVis > 0 && (
          <g transform={`translate(${px}, ${py}) rotate(${angle})`} opacity={planeVis}>
            <g transform="translate(-22,-16)">
              <path d="M 0 16 L 30 10 L 44 14 L 30 18 Z" fill={INK} />
              <path d="M 18 16 L 12 4 L 24 6 L 22 16 Z" fill={INK} />
              <path d="M 18 16 L 12 28 L 24 26 L 22 16 Z" fill={INK} />
              <path d="M 2 16 L -4 10 L 2 14 Z" fill={INK} />
              <path d="M 2 16 L -4 22 L 2 18 Z" fill={INK} />
            </g>
          </g>
        )}
      </svg>

      {/* Bottom caption */}
      {config.caption && (
        <div style={{
          position: "absolute", bottom: 64, left: 0, right: 0, textAlign: "center",
          fontFamily: "'EB Garamond', serif", fontStyle: "italic", fontSize: 22,
          letterSpacing: "0.1em", color: "#3a2f22", opacity: capOp,
        }}>{config.caption}</div>
      )}

      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Letter Interlude Scene (Claude Design P2-4)
// ─────────────────────────────────────────────

const LetterInterludeScene: React.FC<{
  config: LetterInterludeConfig;
  dur: number;
  overlayType: OverlayType;
  particlesType: ParticleType;
}> = ({ config, dur, overlayType, particlesType }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, Math.min(1, frame / dur));

  // Paper fade-in: 0% → 12% in, 92% → 100% out (8s timing normalized)
  const paperOp = interpolate(t, [0, 0.12, 0.92, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const curlOp = interpolate(t, [0.10, 0.16, 0.92, 1], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const dateOp = interpolate(t, [0.06, 0.10, 0.92, 1], [0, 0.9, 0.9, 0], { extrapolateRight: "clamp" });

  // Line 1 typing: 10% → 24% (stepped)
  const l1Chars = Array.from(config.l1);
  const l1Progress = interpolate(t, [0.10, 0.24], [0, l1Chars.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const l1Visible = Math.floor(l1Progress);

  // Line 2 typing: 30% → 72%
  const l2Chars = Array.from(config.l2);
  const l2Progress = interpolate(t, [0.30, 0.72], [0, l2Chars.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const l2Visible = Math.floor(l2Progress);

  // Cursor blink: only during typing pause after l2 (72-90%)
  const cursorOn = t > 0.72 && t < 0.90 && Math.floor(frame / 10) % 2 === 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#2a2420" }}>
      {/* Paper */}
      <div style={{
        position: "absolute",
        left: 120, top: 100, right: 120, bottom: 100,
        background: "radial-gradient(1200px 700px at 40% 30%, #fbf4dc, #ecdfc0 70%, #d9c89f 100%)",
        boxShadow: "0 30px 60px rgba(20,14,4,0.45), 0 10px 24px rgba(20,14,4,0.25)",
        opacity: paperOp,
        transform: `translateY(${paperOp < 1 ? 8 - paperOp * 8 : 0}px) rotate(-0.6deg)`,
      }}>
        {/* Paper rule lines */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "repeating-linear-gradient(180deg, transparent 0, transparent 59px, rgba(26,21,16,0.08) 59px, rgba(26,21,16,0.08) 60px)",
        }} />
        {/* Corner curl */}
        <div style={{
          position: "absolute", top: -6, right: -6,
          width: 92, height: 92,
          background: "linear-gradient(225deg, #f1e5c4 0%, #e3d4ab 60%, #cdb887 100%)",
          clipPath: "polygon(100% 0, 100% 100%, 0 0)",
          transform: "rotate(3deg)",
          boxShadow: "-4px 4px 10px rgba(0,0,0,0.18)",
          opacity: curlOp,
        }} />
        {/* Letter body */}
        <div style={{ position: "absolute", left: 90, top: 170, right: 90, color: INK }}>
          <div style={{
            fontFamily: "'EB Garamond', serif", fontStyle: "italic",
            fontSize: 26, letterSpacing: "0.1em", color: "#3a2f22",
            opacity: dateOp, marginBottom: 8,
          }}>{config.date}</div>
          <div style={{
            fontFamily: "'Nanum Pen Script', cursive", color: INK,
            fontSize: 78, lineHeight: 1.05, marginTop: 12,
          }}>
            {l1Chars.slice(0, l1Visible).join("")}
          </div>
          <div style={{
            fontFamily: "'Nanum Pen Script', cursive", color: INK,
            fontSize: 72, lineHeight: 1.15, marginTop: 36,
          }}>
            {l2Chars.slice(0, l2Visible).join("")}
            {cursorOn && <span style={{ display: "inline-block", width: 3, height: 70, background: INK, verticalAlign: "top", marginLeft: 6 }} />}
          </div>
        </div>
      </div>

      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Polaroid Collage Scene (Claude Design P2-5)
// ─────────────────────────────────────────────

const CollageScene: React.FC<{
  config: CollageConfig;
  dur: number;
  overlayType: OverlayType;
  particlesType: ParticleType;
}> = ({ config, dur, overlayType, particlesType }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, Math.min(1, frame / dur));

  // Default 7-slot scrapbook layout (dense)
  const LAYOUTS_7 = [
    { left: 140,  top: 90,   w: 360, h: 380, rot: -6, tapeCorner: "top-30",     tapeColor: "#d9a8a0" },
    { left: 620,  top: 70,   w: 400, h: 420, rot:  4, tapeCorner: "top-right",  tapeColor: "#a8c9d4" },
    { left: 1180, top: 100,  w: 380, h: 400, rot: -8, tapeCorner: "top-left",   tapeColor: "#d4b870" },
    { left: 80,   top: 500,  w: 360, h: 380, rot:  3, tapeCorner: "top-40",     tapeColor: "#a8b898" },
    { left: 700,  top: 500,  w: 480, h: 500, rot: -2, tapeCorner: "top-left",   tapeColor: "#e8d9b8" },
    { left: 260,  top: 820,  w: 320, h: 340, rot:  7, tapeCorner: "top-right",  tapeColor: "#b8a8c9" },
    { left: 1300, top: 540,  w: 400, h: 420, rot: -5, tapeCorner: "top-25",     tapeColor: "#d89a7a" },
  ];

  // Count-specific layouts — for small collages we spread polaroids across the full canvas
  // with breathing room and organic asymmetric rotations.
  const LAYOUTS_BY_COUNT: Record<number, typeof LAYOUTS_7> = {
    1: [
      { left: 720, top: 260, w: 480, h: 560, rot: -2, tapeCorner: "top-30",    tapeColor: "#d9a8a0" },
    ],
    2: [
      { left: 300, top: 240, w: 520, h: 580, rot: -5, tapeCorner: "top-right", tapeColor: "#d9a8a0" },
      { left: 1100, top: 280, w: 520, h: 580, rot:  3, tapeCorner: "top-left", tapeColor: "#a8c9d4" },
    ],
    3: [
      { left: 180,  top: 230, w: 460, h: 530, rot: -7, tapeCorner: "top-right", tapeColor: "#d9a8a0" },
      { left: 730,  top: 170, w: 480, h: 560, rot:  3, tapeCorner: "top-30",    tapeColor: "#e8d9b8" },
      { left: 1280, top: 250, w: 460, h: 530, rot: -5, tapeCorner: "top-left",  tapeColor: "#a8c9d4" },
    ],
    4: [
      { left: 150,  top: 140, w: 420, h: 470, rot: -6, tapeCorner: "top-right", tapeColor: "#d9a8a0" },
      { left: 640,  top: 110, w: 440, h: 490, rot:  4, tapeCorner: "top-30",    tapeColor: "#a8c9d4" },
      { left: 1150, top: 160, w: 420, h: 470, rot: -4, tapeCorner: "top-left",  tapeColor: "#d4b870" },
      { left: 660,  top: 590, w: 480, h: 440, rot:  2, tapeCorner: "top-40",    tapeColor: "#e8d9b8" },
    ],
    5: [
      { left: 100,  top: 150, w: 380, h: 430, rot: -7, tapeCorner: "top-right", tapeColor: "#d9a8a0" },
      { left: 540,  top: 110, w: 420, h: 470, rot:  3, tapeCorner: "top-30",    tapeColor: "#a8c9d4" },
      { left: 1040, top: 140, w: 400, h: 440, rot: -4, tapeCorner: "top-left",  tapeColor: "#d4b870" },
      { left: 1480, top: 180, w: 380, h: 430, rot:  5, tapeCorner: "top-right", tapeColor: "#a8b898" },
      { left: 700,  top: 610, w: 460, h: 440, rot: -2, tapeCorner: "top-40",    tapeColor: "#e8d9b8" },
    ],
    6: LAYOUTS_7.slice(0, 6),
    7: LAYOUTS_7,
  };

  const LAYOUTS = LAYOUTS_BY_COUNT[Math.min(7, Math.max(1, config.slots.length))] ?? LAYOUTS_7;

  // Drop-in timing (from original 4s drop, staggered 0.2s)
  // Normalize: each polaroid starts at (i * 0.05) t and drops over 0.5 t
  const polaOpacity = (i: number) => {
    const start = i * 0.05;
    return interpolate(t, [start, start + 0.1, 0.92, 1.0], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  };
  const polaDropY = (i: number) => {
    const start = i * 0.05;
    return interpolate(t, [start, start + 0.2], [-60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };

  return (
    <AbsoluteFill>
      {/* Kraft paper page */}
      <AbsoluteFill style={{ background: "radial-gradient(1600px 900px at 50% 45%, #d4be92 0%, #bca072 60%, #9a8252 100%)" }} />
      <AbsoluteFill style={{
        opacity: 0.6, mixBlendMode: "multiply",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><filter id='n'><feTurbulence baseFrequency='0.65' numOctaves='3' seed='11'/><feColorMatrix values='0 0 0 0 0.15 0 0 0 0 0.1 0 0 0 0 0.05 0 0 0 0.18 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
      }} />
      <AbsoluteFill style={{
        backgroundImage: "repeating-linear-gradient(95deg, transparent 0, transparent 3px, rgba(80,60,30,0.06) 3px, rgba(80,60,30,0.06) 4px)",
      }} />

      {/* Polaroids */}
      {LAYOUTS.map((L, i) => {
        const slot = config.slots[i];
        const photoH = L.h - 90; // account for padding 20 + 72 caption area
        const tapePos: React.CSSProperties =
          L.tapeCorner === "top-right"  ? { top: -10, right: 20,        transform: "rotate(20deg)" } :
          L.tapeCorner === "top-left"   ? { top: -10, left: -10,        transform: "rotate(-30deg)" } :
          L.tapeCorner === "top-25"     ? { top: -10, left: "25%",      transform: "rotate(-4deg)" } :
          L.tapeCorner === "top-30"     ? { top: -10, left: "30%",      transform: "rotate(-8deg)" } :
          /* top-40 */                   { top: -10, left: "40%",       transform: "rotate(5deg)" };
        return (
          <div key={i} style={{
            position: "absolute",
            left: L.left, top: L.top,
            width: L.w, height: L.h,
            background: "#fbf4dc",
            padding: "20px 20px 72px",
            boxShadow: "0 20px 40px rgba(20,14,4,0.35), 0 6px 12px rgba(20,14,4,0.22)",
            transform: `rotate(${L.rot}deg) translateY(${polaDropY(i)}px)`,
            transformOrigin: "center center",
            opacity: polaOpacity(i),
            // Put the largest polaroid on top (in case of overlap)
            zIndex: L.w * L.h === Math.max(...LAYOUTS.map((x) => x.w * x.h)) ? 3 : 1,
          }}>
            {/* Tape */}
            <div style={{
              position: "absolute",
              width: 110, height: 28,
              opacity: 0.85,
              mixBlendMode: "multiply",
              backgroundColor: L.tapeColor,
              backgroundImage: "repeating-linear-gradient(90deg, transparent 0, transparent 6px, rgba(255,255,255,0.15) 6px, rgba(255,255,255,0.15) 7px), linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.25), rgba(255,255,255,0))",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              ...tapePos,
            }} />
            {/* Photo */}
            <div style={{
              width: "100%", height: photoH,
              background: slot?.file ? "#eee" : "linear-gradient(160deg, #c4b494 0%, #8a7a5a 100%)",
              backgroundSize: "cover", backgroundPosition: "center",
              overflow: "hidden", position: "relative",
            }}>
              {slot?.file && (
                <Img src={slot.file.startsWith("http") ? slot.file : `/${slot.file}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )}
            </div>
            {/* Caption */}
            {slot?.caption && (
              <div style={{
                position: "absolute", left: 20, right: 20, bottom: 18,
                textAlign: "center",
                fontFamily: "'Nanum Pen Script', cursive",
                color: INK, fontSize: 26,
              }}>{slot.caption}</div>
            )}
          </div>
        );
      })}

      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Photo Scene
// ─────────────────────────────────────────────

const PhotoScene: React.FC<{
  photo: PhotoEntry;
  dur: number;
  isFirst: boolean;
  isLast: boolean;
  cf: number;
  enter: TransitionMode;
  exit: TransitionMode;
  frameType: FrameType;
  overlayType: OverlayType;
  particlesType: ParticleType;
  bg: BackgroundStyle;
  kenBurnsAmount: number;
}> = ({ photo, dur, isFirst, isLast, cf, enter, exit, frameType, overlayType, particlesType, bg, kenBurnsAmount }) => {
  const frame = useCurrentFrame();
  const t = Math.min(1, Math.max(0, frame / dur));
  const { scale, tx, ty } = kenBurns(photo.effect, t, photo.focalPoint.x, photo.focalPoint.y, kenBurnsAmount);

  const ent = isFirst ? { opacity: 1, clipPath: undefined, transform: "" } : enterEffect(enter, frame, cf, dur);
  const ext = isLast ? { opacity: 1, clipPath: undefined, transform: "" } : exitEffect(exit, frame, cf, dur);

  const opacity = Math.min(ent.opacity, ext.opacity);
  const clipPath = ent.clipPath ?? ext.clipPath;
  const slideTransform = ent.transform || ext.transform;

  const filterCSS = FILTER_CSS[photo.filter] ?? "none";
  const src = photo.file.startsWith("http") ? photo.file : `/${photo.file}`;

  // On paper bg, photos need softer shadow (feel like printed photos on page)
  const paperShadow = "0 12px 40px rgba(80,50,20,0.25), 0 2px 6px rgba(80,50,20,0.15)";
  const darkShadow = "0 24px 80px rgba(0,0,0,0.55)";
  const defaultShadow = bg === "paper" ? paperShadow : darkShadow;

  return (
    <AbsoluteFill style={{
      opacity,
      clipPath, WebkitClipPath: clipPath,
      transform: slideTransform,
    }}>
      <BackgroundFor bg={bg} src={src} extraFilter={filterCSS !== "none" ? filterCSS : undefined} seed={hashSeed(photo.tag)} />
      {frameType === "none" ? (
        photo.crop ? (
          // Crop mode: wrapper clips to viewport, image is sized so crop rect fills wrapper
          <AbsoluteFill style={{ overflow: "hidden" }}>
            <Img src={src} style={{
              position: "absolute",
              left: `${-photo.crop.x / photo.crop.w * 100}%`,
              top: `${-photo.crop.y / photo.crop.h * 100}%`,
              width: `${100 / photo.crop.w}%`,
              height: `${100 / photo.crop.h}%`,
              objectFit: "fill",
              transform: `scale(${scale}) translate(${tx * 100}%, ${ty * 100}%)`,
              transformOrigin: "center center",
              filter: filterCSS !== "none" ? filterCSS : undefined,
              display: "block",
            }} />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <Img src={src} style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              transform: `scale(${scale}) translate(${tx * 100}%, ${ty * 100}%)`,
              transformOrigin: "center center",
              filter: filterCSS !== "none" ? filterCSS : undefined,
              boxShadow: defaultShadow,
              display: "block",
            }} />
          </AbsoluteFill>
        )
      ) : (
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            ...getFrameStyle(frameType),
            transform: `scale(${scale}) translate(${tx * 100}%, ${ty * 100}%)${frameType === "polaroid" ? " rotate(-1deg)" : ""}`,
            boxShadow: getFrameStyle(frameType).boxShadow,
          }}>
            <Img src={src} style={{
              width: "100%", maxWidth: "100%",
              objectFit: "contain",
              filter: filterCSS !== "none" ? filterCSS : undefined,
              display: "block",
            }} />
          </div>
        </AbsoluteFill>
      )}
      {photo.spotlights?.length > 0 && (
        <SpotlightOverlay spotlights={photo.spotlights} />
      )}
      {/* ★ 별표 사진에 따뜻한 골드 할로 비네트 (미묘한 강조) */}
      {photo.tag.startsWith("★") && (
        <AbsoluteFill style={{
          pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 48%, rgba(232,208,155,0.10) 0%, rgba(232,208,155,0.04) 35%, transparent 60%, rgba(40,25,5,0.14) 100%)",
          mixBlendMode: "overlay",
          opacity: interpolate(frame, [cf, cf + 30, dur - 30, dur], [0, 1, 1, 0], { extrapolateRight: "clamp" }),
        }} />
      )}
      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
      {photo.caption?.text && (
        <CaptionOverlay text={photo.caption.text} position={photo.caption.position} dur={dur} />
      )}
      {photo.eraIcon && ERA_ICONS[photo.eraIcon] && (
        <EraIconCorner iconKey={photo.eraIcon} position={photo.eraIconPosition ?? "tr"} dur={dur} bg={bg} />
      )}
    </AbsoluteFill>
  );
};

// ─── Era Icon Corner (small P2-3 symbol fixed at photo corner) ───
const EraIconCorner: React.FC<{
  iconKey: string;
  position: "tl" | "tr" | "bl" | "br";
  dur: number;
  bg: BackgroundStyle;
}> = ({ iconKey, position, dur, bg }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [16, 40], [0, 0.6], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [dur - 30, dur - 6], [0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  const IconComp = ERA_ICONS[iconKey];
  if (!IconComp) return null;
  const color = bg === "black" ? "rgba(232, 208, 155, 0.85)" : "rgba(26, 21, 16, 0.85)";
  const padStyle: React.CSSProperties =
    position === "tl" ? { top: 56, left: 56 } :
    position === "tr" ? { top: 56, right: 56 } :
    position === "bl" ? { bottom: 56, left: 56 } :
    { bottom: 56, right: 56 };
  return (
    <div style={{ position: "absolute", ...padStyle, pointerEvents: "none", opacity, zIndex: 30 }}>
      <IconComp color={color} size={78} />
    </div>
  );
};

// ─────────────────────────────────────────────
// Split Screen
// ─────────────────────────────────────────────

const srcOf = (p: PhotoEntry) => p.file.startsWith("http") ? p.file : `/${p.file}`;

const SplitScene: React.FC<{
  left: PhotoEntry; right: PhotoEntry;
  dur: number; isFirst: boolean; isLast: boolean; cf: number; mergeOut: boolean;
  overlayType: OverlayType; particlesType: ParticleType;
  bg: BackgroundStyle;
  style: SplitStyle;
  kenBurnsAmount: number;
}> = ({ left, right, dur, isFirst, isLast, cf, mergeOut, overlayType, particlesType, bg, style, kenBurnsAmount }) => {
  const frame = useCurrentFrame();
  const fadeIn = isFirst ? 1 : interpolate(frame, [0, cf], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = isLast ? 1 : interpolate(frame, [dur - cf, dur], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  const t = Math.min(1, frame / dur);

  // ─── Polaroid variant: two tilted polaroids with real paper texture + washi tape ───
  if (style === "polaroid") {
    const scale = 1 + 0.02 * t;
    // Use Claude Design P0-3 real polaroid paper texture
    const polaroidBase: React.CSSProperties = {
      backgroundColor: "white",
      backgroundImage: "url('/assets/polaroid/polaroid-paper.png')",
      backgroundSize: "100% 100%",
      backgroundRepeat: "no-repeat",
      padding: "20px 20px 70px 20px",
      boxShadow: "0 20px 60px rgba(60,40,15,0.4), 0 4px 12px rgba(60,40,15,0.25)",
      width: "44%",
      position: "absolute",
    };
    const imgFrameStyle: React.CSSProperties = {
      width: "100%",
      aspectRatio: "1 / 1.1",
      overflow: "hidden",
      background: "#f4ede0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };
    // Deterministic washi tape selection per photo based on tag
    const tapes = [
      "washi-kraft-brown", "washi-dotted-cream", "washi-pressed-flower",
      "washi-gold-foil", "washi-aged-white", "washi-mint-green",
      "washi-striped-ivory-gold",
    ];
    // Pick different tapes for left vs right based on different chars
    const pickL = (s: string) => tapes[Math.abs(s.charCodeAt(0)) % tapes.length];
    const pickR = (s: string) => tapes[Math.abs(s.charCodeAt(s.length - 1) + 3) % tapes.length];
    const leftTape = pickL(left.tag || "A");
    const rightTape = pickR(right.tag || "B");
    // Tape positioned top-center, slight asymmetry so each side feels distinct
    const tapeL: React.CSSProperties = {
      position: "absolute",
      top: -14,
      left: "22%",
      width: "40%",
      height: 34,
      transform: "rotate(-6deg)",
      pointerEvents: "none",
      zIndex: 5,
    };
    const tapeR: React.CSSProperties = {
      position: "absolute",
      top: -14,
      left: "30%",
      width: "40%",
      height: 34,
      transform: "rotate(4deg)",
      pointerEvents: "none",
      zIndex: 5,
    };
    const captionStyle: React.CSSProperties = {
      position: "absolute", bottom: 18, left: 0, right: 0,
      textAlign: "center",
      fontFamily: SCRIPT_KR,
      fontSize: 34,
      fontWeight: 700,
      color: "rgba(40,25,10,0.92)",
      letterSpacing: 2,
    };
    const leftLabel = left.splitLabel ?? left.tag.split(" ")[0];
    const rightLabel = right.splitLabel ?? right.tag.split(" ")[0];
    return (
      <AbsoluteFill style={{ opacity }}>
        <PaperBackground seed={hashSeed(left.tag + right.tag)} />
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: "92%", height: "88%" }}>
            <div style={{ ...polaroidBase, left: "3%", top: "4%", transform: `rotate(-3deg) scale(${scale})`, transformOrigin: "center" }}>
              <Img src={`/assets/polaroid/${leftTape}.png`} style={tapeL} />
              <div style={imgFrameStyle}>
                <Img src={srcOf(left)} style={{
                  maxWidth: "100%", maxHeight: "100%",
                  width: "auto", height: "auto",
                  objectFit: "contain", display: "block",
                }} />
              </div>
              <div style={captionStyle}>{leftLabel}</div>
            </div>
            <div style={{ ...polaroidBase, right: "3%", top: "8%", transform: `rotate(2.5deg) scale(${scale})`, transformOrigin: "center" }}>
              <Img src={`/assets/polaroid/${rightTape}.png`} style={tapeR} />
              <div style={imgFrameStyle}>
                <Img src={srcOf(right)} style={{
                  maxWidth: "100%", maxHeight: "100%",
                  width: "auto", height: "auto",
                  objectFit: "contain", display: "block",
                }} />
              </div>
              <div style={captionStyle}>{rightLabel}</div>
            </div>
          </div>
        </AbsoluteFill>
        <OverlayLayer type={overlayType} />
        <ParticleLayer type={particlesType} />
        {left.caption?.text && (
          <CaptionOverlay text={left.caption.text} position={left.caption.position} dur={dur} />
        )}
      </AbsoluteFill>
    );
  }

  // ─── Cameo variant: two circular portraits side-by-side on cream paper ───
  if (style === "cameo") {
    const scale = 1 + 0.02 * t;
    const leftKen = kenBurns(left.effect, t, left.focalPoint.x, left.focalPoint.y, kenBurnsAmount);
    const rightKen = kenBurns(right.effect, t, right.focalPoint.x, right.focalPoint.y, kenBurnsAmount);
    const cameoStyle: React.CSSProperties = {
      width: 420, height: 420,
      borderRadius: "50%",
      overflow: "hidden",
      border: `6px solid ${GOLD_SOFT}`,
      boxShadow: "0 16px 56px rgba(60,40,15,0.4), inset 0 0 0 1px rgba(255,255,255,0.5)",
      transform: `scale(${scale})`,
    };
    const nameStyle: React.CSSProperties = {
      marginTop: 24, textAlign: "center",
      fontFamily: SERIF_KR, fontSize: 36, fontWeight: 700, color: INK, letterSpacing: 6,
    };
    const leftLabel = left.splitLabel ?? left.tag.split(" ")[0];
    const rightLabel = right.splitLabel ?? right.tag.split(" ")[0];
    return (
      <AbsoluteFill style={{ opacity }}>
        <PaperBackground />
        <AbsoluteFill style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 120,
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={cameoStyle}>
              <Img src={srcOf(left)} style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: `scale(${leftKen.scale}) translate(${leftKen.tx * 100}%, ${leftKen.ty * 100}%)`,
              }} />
            </div>
            <div style={nameStyle}>{leftLabel}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={cameoStyle}>
              <Img src={srcOf(right)} style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: `scale(${rightKen.scale}) translate(${rightKen.tx * 100}%, ${rightKen.ty * 100}%)`,
              }} />
            </div>
            <div style={nameStyle}>{rightLabel}</div>
          </div>
        </AbsoluteFill>
        <OverlayLayer type={overlayType} />
        <ParticleLayer type={particlesType} />
        {left.caption?.text && (
          <CaptionOverlay text={left.caption.text} position={left.caption.position} dur={dur} />
        )}
      </AbsoluteFill>
    );
  }

  // ─── Standard variant: 50/50 vertical split (original) ───
  const scaleStd = 1 + 0.05 * t;
  const gap = mergeOut
    ? interpolate(frame, [dur * 0.5, dur - cf], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 12;
  const half: React.CSSProperties = { flex: 1, overflow: "hidden", position: "relative", backgroundColor: "#000" };
  const img: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scaleStd})` };

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#000", display: "flex", flexDirection: "row" }}>
      <div style={half}><Img src={srcOf(left)} style={img} /></div>
      <div style={{ width: gap, background: "#000" }} />
      <div style={half}><Img src={srcOf(right)} style={img} /></div>
      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
      {left.caption?.text && (
        <CaptionOverlay text={left.caption.text} position={left.caption.position} dur={dur} />
      )}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Ending
// ─────────────────────────────────────────────

const EndingScene: React.FC<{
  ending: EndingConfig; dur: number; cf: number;
  overlayType: OverlayType; particlesType: ParticleType;
  bg: BackgroundStyle;
}> = ({ ending, dur, cf, overlayType, particlesType, bg }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, cf], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [dur - 36, dur], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Calligraphy-style ending (Claude Design P1-1).
  // Per-character wipe reveal with staggered delays.
  // Timing (seconds, at 30fps):
  //   0.50s → 1st bride char
  //   1.10s → 2nd bride char
  //   1.70s → 3rd bride char
  //   2.60s → heart
  //   3.20s → 1st groom char
  //   3.80s → 2nd groom char
  //   4.40s → 3rd groom char
  //   4.70s → date caption
  //   6.00s → message (new addition)

  const WIPE_DUR = 13; // ~0.42s
  const charReveal = (startFrame: number) =>
    interpolate(frame, [startFrame, startFrame + WIPE_DUR], [100, 0], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
  const fadeAt = (s: number, f = 1) =>
    interpolate(frame, [s * 30, s * 30 + 30], [0, f], { extrapolateRight: "clamp" });

  const brideChars = Array.from(ending.brideName);
  const groomChars = Array.from(ending.groomName);

  // Heart pop (scale + opacity)
  const heartStart = 2.6 * 30;
  const heartT = interpolate(frame, [heartStart, heartStart + 14], [0, 1], { extrapolateRight: "clamp" });
  const heartScale = interpolate(heartT, [0, 0.6, 1], [0.6, 1.15, 1]);
  const heartOpacity = interpolate(heartT, [0, 0.6, 1], [0, 1, 1]);

  const onPaper = bg !== "black";

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Cream paper + hanji grain (Claude Design calligraphy bg) */}
      {onPaper ? (
        <>
          <AbsoluteFill style={{
            background: "radial-gradient(1500px 900px at 50% 50%, #faf2dc, #f5ecd7 55%, #eaddbe 100%)",
          }} />
          <AbsoluteFill style={{
            opacity: 0.55,
            mixBlendMode: "multiply",
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.05 0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
            backgroundSize: "400px 400px",
          }} />
        </>
      ) : (
        <AbsoluteFill style={{ backgroundColor: BG_DARK }} />
      )}

      {/* Centered names row with heart between */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 120 }}>
        {/* Bride name */}
        <div style={{
          fontFamily: "'Nanum Brush Script', 'Nanum Pen Script', cursive",
          fontSize: 240,
          color: onPaper ? INK : "white",
          lineHeight: 1,
          display: "flex",
          textShadow: "0 0 0.5px rgba(26, 21, 16, 0.3)",
        }}>
          {brideChars.map((c, i) => {
            const startFrame = Math.round((0.50 + i * 0.60) * 30);
            const clipRight = charReveal(startFrame);
            return (
              <span key={i} style={{
                display: "inline-block",
                clipPath: `inset(0 ${clipRight}% 0 0)`,
                WebkitClipPath: `inset(0 ${clipRight}% 0 0)`,
              }}>{c}</span>
            );
          })}
        </div>

        {/* Heart */}
        <div style={{
          fontSize: 120,
          color: "#8a4a3a",
          lineHeight: 1,
          opacity: heartOpacity,
          transform: `scale(${heartScale})`,
        }}>♥</div>

        {/* Groom name */}
        <div style={{
          fontFamily: "'Nanum Brush Script', 'Nanum Pen Script', cursive",
          fontSize: 240,
          color: onPaper ? INK : "white",
          lineHeight: 1,
          display: "flex",
          textShadow: "0 0 0.5px rgba(26, 21, 16, 0.3)",
        }}>
          {groomChars.map((c, i) => {
            const startFrame = Math.round((3.20 + i * 0.60) * 30);
            const clipRight = charReveal(startFrame);
            return (
              <span key={i} style={{
                display: "inline-block",
                clipPath: `inset(0 ${clipRight}% 0 0)`,
                WebkitClipPath: `inset(0 ${clipRight}% 0 0)`,
              }}>{c}</span>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Small botanical sprig under names — appears after both names complete (~5.2s) */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "62%",
        transform: "translateX(-50%)",
        width: 240, height: 60,
        opacity: Math.min(fadeAt(5.2, 0.55), fadeOut),
        pointerEvents: "none",
      }}>
        <svg viewBox="0 0 240 60" width="240" height="60"
          stroke={onPaper ? "#1a1510" : "#e8d09b"}
          fill="none" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
          {/* Horizontal branch */}
          <path d="M 20 30 Q 60 28, 120 30 Q 180 32, 220 30" opacity="0.6" />
          {/* Small leaves (left side) */}
          <path d="M 50 30 Q 56 22, 64 24" opacity="0.6" />
          <path d="M 70 30 Q 76 38, 84 36" opacity="0.6" />
          {/* Center tiny flower/dot */}
          <circle cx="120" cy="30" r="2.5" fill={onPaper ? "#1a1510" : "#e8d09b"} stroke="none" opacity="0.7" />
          <path d="M 115 28 Q 120 24, 125 28" opacity="0.5" />
          {/* Small leaves (right side) */}
          <path d="M 155 30 Q 160 22, 168 24" opacity="0.6" />
          <path d="M 180 30 Q 186 38, 194 36" opacity="0.6" />
        </svg>
      </div>

      {/* Date caption, bottom center */}
      <div style={{
        position: "absolute",
        left: 0, right: 0, bottom: 140,
        textAlign: "center",
        fontFamily: SERIF,
        fontWeight: 300,
        fontSize: 34,
        letterSpacing: "0.42em",
        color: onPaper ? INK : "white",
        opacity: Math.min(fadeAt(5.5, 0.9), fadeOut),
      }}>
        {ending.date}
      </div>

      {/* Thank-you message */}
      <div style={{
        position: "absolute",
        left: 0, right: 0, bottom: 70,
        textAlign: "center",
        fontFamily: SERIF_KR,
        fontSize: 26,
        letterSpacing: 6,
        color: onPaper ? "rgba(58,42,24,0.7)" : "rgba(255,255,255,0.75)",
        opacity: Math.min(fadeAt(6.8), fadeOut),
      }}>
        {ending.message}
      </div>

      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Main composition
// ─────────────────────────────────────────────

export const MainVideo: React.FC<VideoConfig> = (config) => {
  const { photos, actTitles, ending, fps, crossfadeSec, titleCardSec, endingSec } = config;
  const cf = Math.round(crossfadeSec * fps);
  const tcf = Math.round(titleCardSec * fps);
  const ef = Math.round(endingSec * fps);

  const timeline: TimelineItem[] = useMemo(
    () => buildTimeline(
      photos, tcf, ef, fps,
      config.moments ?? [],
      config.yearMarkers ?? [],
      config.journeyMaps ?? [],
      config.letterInterludes ?? [],
      config.collages ?? [],
    ),
    [photos, tcf, ef, fps, config.moments, config.yearMarkers, config.journeyMaps, config.letterInterludes, config.collages]
  );

  let cursor = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {timeline.map((item, i) => {
        const from = cursor;
        const isFirst = i === 0;
        const isLast = i === timeline.length - 1;
        cursor += item.durationInFrames - cf;

        return (
          <Sequence key={`${i}-${item.kind}`} from={from} durationInFrames={item.durationInFrames} name={item.name}>
            {item.kind === "titleCard" && (
              <TitleCardScene
                act={item.act} titles={actTitles}
                dur={item.durationInFrames} cf={cf}
                variant={config.titleVariant}
                overlayType={config.overlay} particlesType={config.particles}
              />
            )}
            {item.kind === "photo" && (
              <PhotoScene
                photo={item.photo}
                dur={item.durationInFrames}
                isFirst={isFirst}
                isLast={isLast}
                cf={cf}
                enter={item.enterTransition}
                exit={item.exitTransition}
                frameType={item.photo.frameOverride ?? config.frame}
                overlayType={item.photo.overlayOverride ?? config.overlay}
                particlesType={item.photo.particlesOverride ?? config.particles}
                bg={config.backgroundStyle}
                kenBurnsAmount={config.kenBurnsAmount}
              />
            )}
            {item.kind === "split" && (
              <SplitScene
                left={item.left} right={item.right}
                dur={item.durationInFrames}
                isFirst={isFirst} isLast={isLast} cf={cf}
                mergeOut={item.mergeOut}
                overlayType={item.left.overlayOverride ?? config.overlay}
                particlesType={item.left.particlesOverride ?? config.particles}
                bg={config.backgroundStyle}
                style={item.left.splitStyle ?? "standard"}
                kenBurnsAmount={config.kenBurnsAmount}
              />
            )}
            {item.kind === "moment" && (
              <MomentCardScene
                l1={item.card.l1}
                l2={item.card.l2}
                year={item.card.year}
                dur={item.durationInFrames}
                overlayType={config.overlay}
                particlesType={config.particles}
              />
            )}
            {item.kind === "yearMarker" && (
              <YearMarkerScene
                year={item.marker.year}
                location={item.marker.location}
                dur={item.durationInFrames}
                overlayType={config.overlay}
                particlesType={config.particles}
              />
            )}
            {item.kind === "journeyMap" && (
              <JourneyMapScene
                config={item.map}
                dur={item.durationInFrames}
                overlayType={config.overlay}
                particlesType={config.particles}
              />
            )}
            {item.kind === "letter" && (
              <LetterInterludeScene
                config={item.letter}
                dur={item.durationInFrames}
                overlayType={config.overlay}
                particlesType={config.particles}
              />
            )}
            {item.kind === "collage" && (
              <CollageScene
                config={item.collage}
                dur={item.durationInFrames}
                overlayType={config.overlay}
                particlesType={config.particles}
              />
            )}
            {item.kind === "ending" && (
              <EndingScene
                ending={ending} dur={item.durationInFrames} cf={cf}
                overlayType={config.overlay} particlesType={config.particles}
                bg={config.backgroundStyle}
              />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
