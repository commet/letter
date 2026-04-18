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
  FILTER_CSS,
  buildTimeline,
} from "./data";

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

const PaperBackground: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, ${PAPER} 0%, ${PAPER_DARK} 100%)` }}>
    <AbsoluteFill style={{
      opacity: 0.12,
      mixBlendMode: "multiply",
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize: "400px 400px",
    }} />
  </AbsoluteFill>
);

const BlurBackground: React.FC<{ src: string; extraFilter?: string }> = ({ src, extraFilter }) => (
  <AbsoluteFill>
    <Img src={src} style={{
      width: "100%", height: "100%", objectFit: "cover",
      filter: `blur(40px) brightness(0.55)${extraFilter ? ` ${extraFilter}` : ""}`,
      transform: "scale(1.15)",
    }} />
  </AbsoluteFill>
);

const BackgroundFor: React.FC<{ bg: BackgroundStyle; src?: string; extraFilter?: string }> = ({ bg, src, extraFilter }) => {
  if (bg === "paper") return <PaperBackground />;
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
  const strength = spotlights.reduce((max, s) => Math.max(max, s.strength), 0.55);
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
  const fadeIn = interpolate(frame, [8, 28], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [dur - 20, dur], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const posStyle: React.CSSProperties =
    position === "top" ? { top: 60 } :
    position === "center" ? { top: "50%", transform: "translateY(-50%)" } :
    { bottom: 60 };

  return (
    <div style={{
      position: "absolute", left: 0, right: 0, ...posStyle,
      display: "flex", justifyContent: "center", pointerEvents: "none",
      opacity,
    }}>
      <div style={{
        color: "white", fontFamily: SERIF, fontSize: 36, fontWeight: 400,
        letterSpacing: 4, textShadow: "0 3px 16px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5)",
        background: "rgba(0,0,0,0.25)", padding: "10px 28px", borderRadius: 8,
      }}>
        {text}
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

  // Journal variant (cream paper, serif ink)
  if (effectiveVariant === "journal") {
    const chars = Array.from(kr);
    return (
      <AbsoluteFill style={{ opacity }}>
        <PaperBackground />
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 32 }}>
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
      <BackgroundFor bg={bg} src={src} extraFilter={filterCSS !== "none" ? filterCSS : undefined} />
      {frameType === "none" ? (
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
      <OverlayLayer type={overlayType} />
      <ParticleLayer type={particlesType} />
      {photo.caption?.text && (
        <CaptionOverlay text={photo.caption.text} position={photo.caption.position} dur={dur} />
      )}
    </AbsoluteFill>
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

  // ─── Polaroid variant: two tilted polaroids on cream paper ───
  if (style === "polaroid") {
    const scale = 1 + 0.02 * t;
    const polaroidBase: React.CSSProperties = {
      background: "white",
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
        <PaperBackground />
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: "92%", height: "88%" }}>
            <div style={{ ...polaroidBase, left: "3%", top: "4%", transform: `rotate(-3deg) scale(${scale})`, transformOrigin: "center" }}>
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

  const onPaper = bg === "paper";
  const dateColor = onPaper ? INK_SOFT : GOLD;
  const nameColor = onPaper ? INK : "white";
  const msgColor = onPaper ? "rgba(58,42,24,0.7)" : "rgba(255,255,255,0.78)";
  const ruleColor = onPaper ? GOLD_SOFT : GOLD;

  return (
    <AbsoluteFill style={{ opacity, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
      {onPaper ? <PaperBackground /> : <AbsoluteFill style={{ backgroundColor: BG_DARK }} />}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
        <div style={{
          color: dateColor, fontFamily: SERIF, fontSize: 30, letterSpacing: 12, fontWeight: 300,
          opacity: interpolate(frame, [12, 42], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          {ending.date}
        </div>
        <div style={{
          width: 96, height: 1, background: ruleColor,
          opacity: interpolate(frame, [34, 64], [0, 0.7], { extrapolateRight: "clamp" }),
        }} />
        <div style={{
          color: nameColor, fontFamily: SERIF_KR, fontSize: 60, fontWeight: 400, letterSpacing: 8,
          opacity: interpolate(frame, [56, 96], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          {ending.groomName} &nbsp;·&nbsp; {ending.brideName}
        </div>
        <div style={{
          color: msgColor, fontFamily: SERIF_KR, fontSize: 28, letterSpacing: 6, marginTop: 16,
          opacity: interpolate(frame, [108, 148], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          {ending.message}
        </div>
      </AbsoluteFill>
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
    () => buildTimeline(photos, tcf, ef, fps),
    [photos, tcf, ef, fps]
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
