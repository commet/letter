import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  photos,
  FPS,
  CROSSFADE_SEC,
  PhotoEntry,
  Effect,
} from "./manifest";

const CROSSFADE_FRAMES = Math.round(CROSSFADE_SEC * FPS);

// Ken Burns transform for a given effect, normalized progress (0..1).
const kenBurns = (effect: Effect, t: number) => {
  // Subtle amounts - wedding pre-ceremony should feel calm, not dizzy.
  const ZOOM_AMT = 0.08; // 8% zoom range
  const PAN_AMT = 0.04; // 4% pan range
  switch (effect) {
    case "zoomIn":
      return { scale: 1.0 + ZOOM_AMT * t, tx: 0, ty: 0 };
    case "zoomOut":
      return { scale: 1.0 + ZOOM_AMT - ZOOM_AMT * t, tx: 0, ty: 0 };
    case "panRight":
      return { scale: 1.0 + ZOOM_AMT * 0.5, tx: -PAN_AMT + PAN_AMT * 2 * t, ty: 0 };
    case "panLeft":
      return { scale: 1.0 + ZOOM_AMT * 0.5, tx: PAN_AMT - PAN_AMT * 2 * t, ty: 0 };
    case "static":
    default:
      return { scale: 1.0, tx: 0, ty: 0 };
  }
};

export const PhotoScene: React.FC<{
  photo: PhotoEntry;
  durationInFrames: number;
  isFirst: boolean;
  isLast: boolean;
}> = ({ photo, durationInFrames, isFirst, isLast }) => {
  const frame = useCurrentFrame();
  const t = Math.min(1, Math.max(0, frame / durationInFrames));
  const { scale, tx, ty } = kenBurns(photo.effect, t);

  // Crossfade opacity: ramp up at start, ramp down at end (except edges).
  const fadeIn = isFirst
    ? 1
    : interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], {
        extrapolateRight: "clamp",
      });
  const fadeOut = isLast
    ? 1
    : interpolate(
        frame,
        [durationInFrames - CROSSFADE_FRAMES, durationInFrames],
        [1, 0],
        { extrapolateLeft: "clamp" }
      );
  const opacity = Math.min(fadeIn, fadeOut);

  const src = staticFile(photo.file);

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#000" }}>
      {/* Blurred background fills letterbox gutters */}
      <AbsoluteFill>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(40px) brightness(0.55)",
            transform: "scale(1.15)",
          }}
        />
      </AbsoluteFill>
      {/* Main photo, centered with Ken Burns */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img
          src={src}
          style={{
            maxWidth: "92%",
            maxHeight: "92%",
            objectFit: "contain",
            transform: `scale(${scale}) translate(${tx * 100}%, ${ty * 100}%)`,
            boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          }}
        />
      </AbsoluteFill>
      {/* Dev overlay: act + tag (visible in studio, remove for final render) */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          display: "flex",
          alignItems: "flex-end",
          padding: 32,
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.85)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 24,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            background: "rgba(0,0,0,0.35)",
            padding: "8px 16px",
            borderRadius: 8,
          }}
        >
          Act {photo.act} · {photo.tag}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {photos.map((p, i) => {
        const durationInFrames = Math.round(p.durationSec * FPS);
        const from = cursor;
        // Advance cursor: next photo starts CROSSFADE_FRAMES before this ends.
        cursor += durationInFrames - CROSSFADE_FRAMES;
        return (
          <Sequence
            key={`${i}-${p.file}`}
            from={from}
            durationInFrames={durationInFrames}
            name={`${i + 1}. Act ${p.act} — ${p.tag}`}
          >
            <PhotoScene
              photo={p}
              durationInFrames={durationInFrames}
              isFirst={i === 0}
              isLast={i === photos.length - 1}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const totalFrames = (() => {
  const sum = photos.reduce(
    (s, p) => s + Math.round(p.durationSec * FPS),
    0
  );
  return sum - CROSSFADE_FRAMES * (photos.length - 1);
})();
