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

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CROSSFADE_FRAMES = Math.round(CROSSFADE_SEC * FPS);

const TITLE_CARD_SEC = 3.2;
const TITLE_CARD_FRAMES = Math.round(TITLE_CARD_SEC * FPS);

const ENDING_SEC = 6.5;
const ENDING_FRAMES = Math.round(ENDING_SEC * FPS);

// Iris radius travels 0..120% so corners are fully covered.
const IRIS_FRAMES = CROSSFADE_FRAMES; // synced with the crossfade overlap

const SERIF_STACK =
  "'Noto Serif KR', 'Nanum Myeongjo', 'Times New Roman', serif";
const GOLD = "rgba(232, 208, 155, 0.9)";
const BG_DARK = "#0a0a0a";

const actTitles: Record<number, { chapter: string; kr: string }> = {
  1: { chapter: "Act I", kr: "각자의 자리에서" },
  2: { chapter: "Act II · 1999", kr: "같은 공동체" },
  3: { chapter: "Act III", kr: "여름, 우리의 계절" },
  4: { chapter: "Act IV", kr: "학창 시절" },
  5: { chapter: "Act V", kr: "청년, 함께 자라다" },
  6: { chapter: "Act VI · Christmas", kr: "그 해 우리는" },
  7: { chapter: "Act VII", kr: "둘이 만나다" },
  8: { chapter: "Act VIII", kr: "함께 걸어온 시간" },
  9: { chapter: "Act IX · 2026", kr: "그리고, 오늘" },
};

// ─────────────────────────────────────────────
// Ken Burns transform
// ─────────────────────────────────────────────

const kenBurns = (effect: Effect, t: number) => {
  const ZOOM_AMT = 0.08;
  const PAN_AMT = 0.04;
  switch (effect) {
    case "zoomIn":
      return { scale: 1.0 + ZOOM_AMT * t, tx: 0, ty: 0 };
    case "zoomOut":
      return { scale: 1.0 + ZOOM_AMT - ZOOM_AMT * t, tx: 0, ty: 0 };
    case "panRight":
      return {
        scale: 1.0 + ZOOM_AMT * 0.5,
        tx: -PAN_AMT + PAN_AMT * 2 * t,
        ty: 0,
      };
    case "panLeft":
      return {
        scale: 1.0 + ZOOM_AMT * 0.5,
        tx: PAN_AMT - PAN_AMT * 2 * t,
        ty: 0,
      };
    case "static":
    default:
      return { scale: 1.0, tx: 0, ty: 0 };
  }
};

// ─────────────────────────────────────────────
// Title Card Scene
// ─────────────────────────────────────────────

const TitleCardScene: React.FC<{
  act: number;
  durationInFrames: number;
}> = ({ act, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { chapter, kr } = actTitles[act];

  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - CROSSFADE_FRAMES, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  // Slow breathing scale for cinematic feel
  const t = frame / durationInFrames;
  const scale = 1.0 + 0.025 * t;

  const chars = Array.from(kr);

  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundColor: BG_DARK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            color: GOLD,
            fontFamily: SERIF_STACK,
            fontSize: 26,
            letterSpacing: 10,
            fontWeight: 300,
            textTransform: "uppercase",
            opacity: interpolate(frame, [8, 26], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          {chapter}
        </div>
        <div
          style={{
            width: 72,
            height: 1,
            background: GOLD,
            opacity: interpolate(frame, [14, 32], [0, 0.6], {
              extrapolateRight: "clamp",
            }),
          }}
        />
        <div
          style={{
            color: "white",
            fontFamily: SERIF_STACK,
            fontSize: 76,
            fontWeight: 400,
            letterSpacing: 6,
            display: "flex",
          }}
        >
          {chars.map((c, i) => {
            const start = 26 + i * 3;
            const charOpacity = interpolate(
              frame,
              [start, start + 14],
              [0, 1],
              { extrapolateRight: "clamp" }
            );
            const charY = interpolate(frame, [start, start + 14], [8, 0], {
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  opacity: charOpacity,
                  transform: `translateY(${charY}px)`,
                  display: "inline-block",
                }}
              >
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
// Photo Scene (with optional iris)
// ─────────────────────────────────────────────

type IrisMode = "none" | "in" | "out";

export const PhotoScene: React.FC<{
  photo: PhotoEntry;
  durationInFrames: number;
  isFirst: boolean;
  isLast: boolean;
  iris?: IrisMode;
  showDevOverlay?: boolean;
}> = ({
  photo,
  durationInFrames,
  isFirst,
  isLast,
  iris = "none",
  showDevOverlay = true,
}) => {
  const frame = useCurrentFrame();
  const t = Math.min(1, Math.max(0, frame / durationInFrames));
  const { scale, tx, ty } = kenBurns(photo.effect, t);

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

  let opacity = Math.min(fadeIn, fadeOut);
  let clipPath: string | undefined;

  if (iris === "in") {
    // Iris opens during the first IRIS_FRAMES, replacing fadeIn
    const irisT = interpolate(frame, [0, IRIS_FRAMES], [0, 1], {
      extrapolateRight: "clamp",
    });
    clipPath = `circle(${irisT * 120}% at 50% 50%)`;
    opacity = fadeOut;
  } else if (iris === "out") {
    // Iris closes during the last IRIS_FRAMES, replacing fadeOut
    const irisT = interpolate(
      frame,
      [durationInFrames - IRIS_FRAMES, durationInFrames],
      [0, 1],
      { extrapolateLeft: "clamp" }
    );
    clipPath = `circle(${(1 - irisT) * 120}% at 50% 50%)`;
    opacity = fadeIn;
  }

  const src = staticFile(photo.file);

  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundColor: "#000",
        clipPath,
        WebkitClipPath: clipPath,
      }}
    >
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
      {showDevOverlay && (
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
      )}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Split Screen Scene (Act 1)
// ─────────────────────────────────────────────

const SplitScene: React.FC<{
  left: PhotoEntry;
  right: PhotoEntry;
  durationInFrames: number;
  isFirst: boolean;
  isLast: boolean;
  mergeOut: boolean;
}> = ({ left, right, durationInFrames, isFirst, isLast, mergeOut }) => {
  const frame = useCurrentFrame();
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

  const t = Math.min(1, Math.max(0, frame / durationInFrames));
  const scale = 1.0 + 0.05 * t;

  // Gap narrows from 12px to 0 in the final 50% if this split merges into next.
  const gap = mergeOut
    ? interpolate(
        frame,
        [durationInFrames * 0.5, durationInFrames - CROSSFADE_FRAMES],
        [12, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 12;

  const halfStyle: React.CSSProperties = {
    flex: 1,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
  };

  const imgStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${scale})`,
  };

  const tagStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 32,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "system-ui, sans-serif",
    fontSize: 22,
    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
    background: "rgba(0,0,0,0.35)",
    padding: "6px 14px",
    borderRadius: 6,
  };

  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundColor: "#000",
        display: "flex",
        flexDirection: "row",
      }}
    >
      <div style={halfStyle}>
        <Img src={staticFile(left.file)} style={imgStyle} />
        <div style={{ ...tagStyle, left: 32 }}>신랑 · {left.tag}</div>
      </div>
      <div style={{ width: gap, background: "#000" }} />
      <div style={halfStyle}>
        <Img src={staticFile(right.file)} style={imgStyle} />
        <div style={{ ...tagStyle, right: 32 }}>신부 · {right.tag}</div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Ending Title Scene
// ─────────────────────────────────────────────

const EndingScene: React.FC<{
  durationInFrames: number;
}> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 36, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const line1 = interpolate(frame, [12, 42], [0, 1], {
    extrapolateRight: "clamp",
  });
  const rule = interpolate(frame, [34, 64], [0, 0.6], {
    extrapolateRight: "clamp",
  });
  const line2 = interpolate(frame, [56, 96], [0, 1], {
    extrapolateRight: "clamp",
  });
  const line3 = interpolate(frame, [108, 148], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundColor: BG_DARK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 36,
      }}
    >
      <div
        style={{
          color: GOLD,
          fontFamily: SERIF_STACK,
          fontSize: 30,
          letterSpacing: 12,
          fontWeight: 300,
          opacity: line1,
        }}
      >
        2026 · XX · XX
      </div>
      <div
        style={{
          width: 96,
          height: 1,
          background: GOLD,
          opacity: rule,
        }}
      />
      <div
        style={{
          color: "white",
          fontFamily: SERIF_STACK,
          fontSize: 60,
          fontWeight: 400,
          letterSpacing: 8,
          opacity: line2,
        }}
      >
        신랑 ○○ &nbsp;·&nbsp; 신부 ○○
      </div>
      <div
        style={{
          color: "rgba(255,255,255,0.78)",
          fontFamily: SERIF_STACK,
          fontSize: 28,
          letterSpacing: 6,
          opacity: line3,
          marginTop: 16,
        }}
      >
        와주셔서 감사합니다
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────
// Timeline builder
// ─────────────────────────────────────────────

type TimelineItem =
  | {
      kind: "titleCard";
      act: number;
      durationInFrames: number;
      name: string;
    }
  | {
      kind: "photo";
      photo: PhotoEntry;
      durationInFrames: number;
      iris: IrisMode;
      name: string;
    }
  | {
      kind: "split";
      left: PhotoEntry;
      right: PhotoEntry;
      durationInFrames: number;
      mergeOut: boolean;
      name: string;
    }
  | {
      kind: "ending";
      durationInFrames: number;
      name: string;
    };

const buildTimeline = (): TimelineItem[] => {
  const items: TimelineItem[] = [];
  const seenActs = new Set<number>();

  let i = 0;
  while (i < photos.length) {
    const p = photos[i];

    // Title card at the start of each act
    if (!seenActs.has(p.act)) {
      seenActs.add(p.act);
      items.push({
        kind: "titleCard",
        act: p.act,
        durationInFrames: TITLE_CARD_FRAMES,
        name: `Act ${p.act} — Title`,
      });
    }

    // Act 1: pair the 4 solo childhood photos into 2 split scenes
    if (p.act === 1 && i === 0) {
      items.push({
        kind: "split",
        left: photos[0], // 어항 앞 어린 신랑
        right: photos[2], // 책상 앞 어린 신부
        durationInFrames: Math.round(4.0 * FPS),
        mergeOut: false,
        name: "Act 1 — Split 1 (어항 / 책상)",
      });
      items.push({
        kind: "split",
        left: photos[1], // Be The Reds 신랑
        right: photos[3], // 태극기 COREA 신부
        durationInFrames: Math.round(4.0 * FPS),
        mergeOut: true,
        name: "Act 1 — Split 2 (Be The Reds / COREA) → merge",
      });
      i = 4; // skip to photo 005 (the two-kids-together reveal)
      continue;
    }

    // Iris markers for Act 6 → Act 7 transition
    const isLastOfAct6 =
      p.act === 6 && (i === photos.length - 1 || photos[i + 1].act !== 6);
    const isFirstOfAct7 =
      p.act === 7 && (i === 0 || photos[i - 1].act !== 7);
    const iris: IrisMode = isLastOfAct6
      ? "out"
      : isFirstOfAct7
      ? "in"
      : "none";

    items.push({
      kind: "photo",
      photo: p,
      durationInFrames: Math.round(p.durationSec * FPS),
      iris,
      name: `${i + 1}. Act ${p.act} — ${p.tag}`,
    });
    i++;
  }

  items.push({
    kind: "ending",
    durationInFrames: ENDING_FRAMES,
    name: "Ending — 2026.XX.XX",
  });

  return items;
};

const TIMELINE = buildTimeline();

// ─────────────────────────────────────────────
// MainVideo
// ─────────────────────────────────────────────

export const MainVideo: React.FC = () => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {TIMELINE.map((item, i) => {
        const from = cursor;
        const isFirst = i === 0;
        const isLast = i === TIMELINE.length - 1;
        cursor += item.durationInFrames - CROSSFADE_FRAMES;

        return (
          <Sequence
            key={`${i}-${item.kind}`}
            from={from}
            durationInFrames={item.durationInFrames}
            name={item.name}
          >
            {item.kind === "titleCard" && (
              <TitleCardScene
                act={item.act}
                durationInFrames={item.durationInFrames}
              />
            )}
            {item.kind === "photo" && (
              <PhotoScene
                photo={item.photo}
                durationInFrames={item.durationInFrames}
                isFirst={isFirst}
                isLast={isLast}
                iris={item.iris}
              />
            )}
            {item.kind === "split" && (
              <SplitScene
                left={item.left}
                right={item.right}
                durationInFrames={item.durationInFrames}
                isFirst={isFirst}
                isLast={isLast}
                mergeOut={item.mergeOut}
              />
            )}
            {item.kind === "ending" && (
              <EndingScene durationInFrames={item.durationInFrames} />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const totalFrames = (() => {
  const sum = TIMELINE.reduce((s, it) => s + it.durationInFrames, 0);
  return sum - CROSSFADE_FRAMES * (TIMELINE.length - 1);
})();
