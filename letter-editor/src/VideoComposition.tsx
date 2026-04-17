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
  FILTER_CSS,
  buildTimeline,
} from "./data";

// ─────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────

const SERIF = "'Noto Serif KR', 'Nanum Myeongjo', 'Times New Roman', serif";
const GOLD = "rgba(232, 208, 155, 0.9)";
const BG = "#0a0a0a";

// ─────────────────────────────────────────────
// Ken Burns with focal point
// ─────────────────────────────────────────────

const kenBurns = (effect: Effect, t: number, fx = 0.5, fy = 0.5) => {
  const Z = 0.08;
  const P = 0.04;
  // Shift toward focal point as we zoom
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
}> = ({ act, titles, dur, cf }) => {
  const frame = useCurrentFrame();
  const { chapter, kr } = titles[act] ?? { chapter: "", kr: "" };
  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [dur - cf, dur], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  const scale = 1 + 0.025 * (frame / dur);
  const chars = Array.from(kr);

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${scale})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{
          color: GOLD, fontFamily: SERIF, fontSize: 26, letterSpacing: 10,
          fontWeight: 300, textTransform: "uppercase",
          opacity: interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          {chapter}
        </div>
        <div style={{
          width: 72, height: 1, background: GOLD,
          opacity: interpolate(frame, [14, 32], [0, 0.6], { extrapolateRight: "clamp" }),
        }} />
        <div style={{ color: "white", fontFamily: SERIF, fontSize: 76, fontWeight: 400, letterSpacing: 6, display: "flex" }}>
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
}> = ({ photo, dur, isFirst, isLast, cf, enter, exit }) => {
  const frame = useCurrentFrame();
  const t = Math.min(1, Math.max(0, frame / dur));
  const { scale, tx, ty } = kenBurns(photo.effect, t, photo.focalPoint.x, photo.focalPoint.y);

  // Combine enter and exit effects
  const ent = isFirst ? { opacity: 1, clipPath: undefined, transform: "" } : enterEffect(enter, frame, cf, dur);
  const ext = isLast ? { opacity: 1, clipPath: undefined, transform: "" } : exitEffect(exit, frame, cf, dur);

  const opacity = Math.min(ent.opacity, ext.opacity);
  const clipPath = ent.clipPath ?? ext.clipPath;
  const slideTransform = ent.transform || ext.transform;

  const filterCSS = FILTER_CSS[photo.filter] ?? "none";
  const src = photo.file.startsWith("http") ? photo.file : `/${photo.file}`;

  return (
    <AbsoluteFill style={{
      opacity, backgroundColor: "#000",
      clipPath, WebkitClipPath: clipPath,
      transform: slideTransform,
    }}>
      <AbsoluteFill>
        <Img src={src} style={{
          width: "100%", height: "100%", objectFit: "cover",
          filter: `blur(40px) brightness(0.55)${filterCSS !== "none" ? ` ${filterCSS}` : ""}`,
          transform: "scale(1.15)",
        }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Img src={src} style={{
          maxWidth: "92%", maxHeight: "92%", objectFit: "contain",
          transform: `scale(${scale}) translate(${tx * 100}%, ${ty * 100}%)`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          filter: filterCSS !== "none" ? filterCSS : undefined,
        }} />
      </AbsoluteFill>
      {photo.spotlights?.length > 0 && (
        <SpotlightOverlay spotlights={photo.spotlights} />
      )}
      {photo.caption?.text && (
        <CaptionOverlay text={photo.caption.text} position={photo.caption.position} dur={dur} />
      )}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Split Screen
// ─────────────────────────────────────────────

const SplitScene: React.FC<{
  left: PhotoEntry; right: PhotoEntry;
  dur: number; isFirst: boolean; isLast: boolean; cf: number; mergeOut: boolean;
}> = ({ left, right, dur, isFirst, isLast, cf, mergeOut }) => {
  const frame = useCurrentFrame();
  const fadeIn = isFirst ? 1 : interpolate(frame, [0, cf], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = isLast ? 1 : interpolate(frame, [dur - cf, dur], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  const t = Math.min(1, frame / dur);
  const scale = 1 + 0.05 * t;
  const gap = mergeOut
    ? interpolate(frame, [dur * 0.5, dur - cf], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 12;
  const half: React.CSSProperties = { flex: 1, overflow: "hidden", position: "relative", backgroundColor: "#000" };
  const img: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` };

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#000", display: "flex", flexDirection: "row" }}>
      <div style={half}><Img src={left.file.startsWith("http") ? left.file : `/${left.file}`} style={img} /></div>
      <div style={{ width: gap, background: "#000" }} />
      <div style={half}><Img src={right.file.startsWith("http") ? right.file : `/${right.file}`} style={img} /></div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Ending
// ─────────────────────────────────────────────

const EndingScene: React.FC<{
  ending: EndingConfig; dur: number; cf: number;
}> = ({ ending, dur, cf }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, cf], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [dur - 36, dur], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
      <div style={{
        color: GOLD, fontFamily: SERIF, fontSize: 30, letterSpacing: 12, fontWeight: 300,
        opacity: interpolate(frame, [12, 42], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        {ending.date}
      </div>
      <div style={{
        width: 96, height: 1, background: GOLD,
        opacity: interpolate(frame, [34, 64], [0, 0.6], { extrapolateRight: "clamp" }),
      }} />
      <div style={{
        color: "white", fontFamily: SERIF, fontSize: 60, fontWeight: 400, letterSpacing: 8,
        opacity: interpolate(frame, [56, 96], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        {ending.groomName} &nbsp;·&nbsp; {ending.brideName}
      </div>
      <div style={{
        color: "rgba(255,255,255,0.78)", fontFamily: SERIF, fontSize: 28, letterSpacing: 6, marginTop: 16,
        opacity: interpolate(frame, [108, 148], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        {ending.message}
      </div>
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
              <TitleCardScene act={item.act} titles={actTitles} dur={item.durationInFrames} cf={cf} />
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
              />
            )}
            {item.kind === "split" && (
              <SplitScene left={item.left} right={item.right} dur={item.durationInFrames} isFirst={isFirst} isLast={isLast} cf={cf} mergeOut={item.mergeOut} />
            )}
            {item.kind === "ending" && (
              <EndingScene ending={ending} dur={item.durationInFrames} cf={cf} />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
