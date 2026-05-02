// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type Effect =
  | "zoomIn"
  | "zoomOut"
  | "panLeft"
  | "panRight"
  | "static";

export type TransitionType =
  | "fade"
  | "iris"
  | "slide-left"
  | "slide-right"
  | "wipe-down"
  | "none";

export type FilterType =
  | "none"
  | "sepia"
  | "grayscale"
  | "vintage"
  | "warm"
  | "cool";

export const FILTER_CSS: Record<FilterType, string> = {
  none: "none",
  sepia: "sepia(0.7) saturate(1.2)",
  grayscale: "grayscale(1)",
  vintage: "sepia(0.35) contrast(1.1) brightness(0.95) saturate(0.85)",
  warm: "saturate(1.3) brightness(1.05) hue-rotate(-5deg)",
  cool: "saturate(0.9) brightness(1.05) hue-rotate(10deg)",
};

// Legacy single-caption (kept for backward-compat; auto-migrated to CaptionEntry[]).
export type CaptionConfig = {
  text: string;
  position: "top" | "bottom" | "center";
};

// Per-entry caption with full position + styling control.
export type CaptionFont =
  | "serif"       // italic EB Garamond — classic elegant
  | "serif-kr"    // Nanum Myeongjo — formal Korean serif
  | "script-kr"   // Nanum Pen Script — handwritten
  | "brush-kr"    // Nanum Brush — calligraphy
  | "sans-kr";    // Noto Sans — modern

export type CaptionAlign = "left" | "center" | "right";

// Visual treatment behind caption text.
//   none           — plain text, no shadow, no bg. Only if caption is on an already-safe area.
//   shadow         — heavy text shadow only. Good on mid-contrast photos.
//   scrim-bottom   — gradient darken across bottom ~38% of frame. Default for captions at y ≥ 0.5.
//   scrim-top      — gradient darken across top ~38% of frame. For captions at y < 0.5.
//   card           — solid/translucent box behind text (uses color/padding/radius/blur).
//   bubble-yellow  — speech bubble, yellow, tail at bottom-left (슬기 — left side of canvas).
//   bubble-purple  — speech bubble, purple, tail at bottom-right (예찬 — right side of canvas).
// Bubble kinds skip typing animation (text appears all at once with the fade-in envelope)
// and hide the speaker prefix — color + tail direction encode who's speaking.
export type CaptionBgKind =
  | "none" | "shadow" | "scrim-bottom" | "scrim-top" | "card"
  | "bubble-yellow" | "bubble-purple";

export type CaptionBackground = {
  kind?: CaptionBgKind;  // default resolves to "scrim-bottom" at render. Legacy rows with just { color } are treated as "card".
  color?: string;        // used only by kind="card" — e.g., "rgba(15,12,8,0.55)"
  paddingX?: number;     // card: default 22
  paddingY?: number;     // card: default 10
  radius?: number;       // card: default 4
  blur?: boolean;        // card: backdrop blur behind box
};

// Shared between renderer and editor so the preview stays WYSIWYG.
// Render-time auto-upgrade: any caption whose speaker is "슬기" / "예찬" is treated as a
// speech-bubble regardless of saved bg.kind. Survives stale DB state, peer broadcasts that
// pre-date the bubble migration, and any other sync race that would otherwise leave the
// caption rendering as a card/scrim subtitle.
export const resolveCaptionBgKind = (
  cap: { bg?: CaptionBackground; speaker?: string }
): CaptionBgKind => {
  const k = cap.bg?.kind;
  if (k === "bubble-yellow" || k === "bubble-purple") return k;
  if (cap.speaker === "슬기") return "bubble-yellow";
  if (cap.speaker === "예찬") return "bubble-purple";
  if (k) return k;
  if (cap.bg?.color) return "card";  // legacy rows with only { color }
  return "scrim-bottom";
};

// Auto-resolve caption layout + timing for rendering. Bubble captions are arranged like
// a chat conversation:
//   - Position: stacked vertically per-speaker (slki on the left column, yechan on the right).
//                The Nth bubble of the same speaker sits below the (N-1)th one.
//   - Timing:   bubbles are spread proportionally across the scene so a long
//                multi-exchange dialogue doesn't bunch all bubbles into the first 2s
//                of a 30s photo. Per-bubble gap is clamped to a 1.3-3.0s conversation
//                rhythm — anything tighter feels rushed ("boom-boom"), looser drags.
// User-dragged positions outside the auto-stack range are respected verbatim. Non-bubble
// captions are returned unchanged. `durFrames` enables timing override; omit for editor
// preview (positions still resolve, timing left as-is).
export const enrichCaptionsForRender = <T extends {
  speaker?: string; x: number; y: number; bg?: CaptionBackground;
  fromT?: number; toT?: number;
}>(caps: readonly T[], durFrames?: number): T[] => {
  const isBubbleAt = (j: number) => {
    const k = resolveCaptionBgKind(caps[j]);
    return k === "bubble-yellow" || k === "bubble-purple";
  };
  const totalBubbles = caps.reduce((n, _, j) => n + (isBubbleAt(j) ? 1 : 0), 0);

  return caps.map((cap, i) => {
    const k = resolveCaptionBgKind(cap);
    const isBubble = k === "bubble-yellow" || k === "bubble-purple";
    if (!isBubble) return cap;

    // Stack index: how many earlier bubble captions share this speaker.
    let stackIdx = 0;
    for (let j = 0; j < i; j++) {
      if (isBubbleAt(j) && caps[j].speaker === cap.speaker) stackIdx++;
    }

    const defaultX = cap.speaker === "슬기" ? 0.20 : cap.speaker === "예찬" ? 0.80 : 0.5;
    const defaultY = Math.min(0.85, 0.20 + stackIdx * 0.16);

    // Snap when saved position is at a known auto-target (current stack slot, or the
    // legacy "all bubbles at y=0.20" from the early migration, or the legacy bottom band).
    const dx = Math.abs(cap.x - defaultX);
    const isAtThisSnap   = dx < 0.04 && Math.abs(cap.y - defaultY) < 0.04;
    const isAtFirstSnap  = dx < 0.04 && Math.abs(cap.y - 0.20) < 0.04;
    const isLegacyBottom = cap.y >= 0.7 && Math.abs(cap.x - 0.5) < 0.15;
    const snap = isAtThisSnap || isAtFirstSnap || isLegacyBottom;

    const x = snap ? defaultX : cap.x;
    const y = snap ? defaultY : cap.y;

    // Chat-sequence timing — distribute bubbles through ~87% of the scene so they
    // don't bunch up at the start of long dialogue scenes. Gap clamped to
    // [1.33s, 3.0s] so quick chat scenes stay snappy and long ones stay graceful.
    let fromT = cap.fromT;
    let toT = cap.toT;
    if (durFrames !== undefined) {
      const D = Math.max(60, durFrames);
      const bubbleIdx = caps.slice(0, i).reduce((n, _, j) => n + (isBubbleAt(j) ? 1 : 0), 0);
      const headFrames = 30;       // ~1.0s of stillness before first bubble — lets the
                                   // photo register before the conversation starts.
      const tailFrac = 0.13;       // last 13% kept clear so final bubble reads
      const usable = Math.max(1, D * (1 - tailFrac) - headFrames);
      const naturalGap = totalBubbles > 1 ? usable / (totalBubbles - 1) : 0;
      const minGap = 40;           // 1.33s — quickest before it feels rushed
      const maxGap = 90;           // 3.0s  — slowest before it feels dead
      const gap = Math.max(minGap, Math.min(maxGap, naturalGap));
      fromT = Math.min(0.92, (headFrames + bubbleIdx * gap) / D);
      toT = 0.97;
    }

    return { ...cap, x, y, fromT, toT };
  });
};

// Position-only resolver kept for callers that need a single cap's position without the
// surrounding array context (e.g. drag-edit modal that only knows about one cap at click time).
// For the conversation auto-stack to apply correctly, prefer enrichCaptionsForRender at the
// layer level. This single-cap version snaps only based on legacy-bottom heuristics.
export const resolveCaptionPosition = (
  cap: { speaker?: string; x: number; y: number; bg?: CaptionBackground }
): { x: number; y: number } => {
  const k = cap.bg?.kind;
  if (k === "bubble-yellow" || k === "bubble-purple") return { x: cap.x, y: cap.y };
  if (cap.speaker !== "슬기" && cap.speaker !== "예찬") return { x: cap.x, y: cap.y };
  const looksLegacy = cap.y >= 0.7 && Math.abs(cap.x - 0.5) < 0.15;
  if (!looksLegacy) return { x: cap.x, y: cap.y };
  return cap.speaker === "슬기" ? { x: 0.20, y: 0.20 } : { x: 0.80, y: 0.20 };
};

export const CAPTION_FONT_STACK: Record<CaptionFont, { fontFamily: string; fontStyle: "normal" | "italic"; letterSpacing: string }> = {
  "serif":     { fontFamily: "'EB Garamond', 'Cormorant Garamond', serif", fontStyle: "italic", letterSpacing: "0.16em" },
  "serif-kr":  { fontFamily: "'Nanum Myeongjo', 'Gowun Batang', 'Noto Serif KR', serif", fontStyle: "normal", letterSpacing: "0.08em" },
  "script-kr": { fontFamily: "'Nanum Pen Script', 'Gaegu', cursive", fontStyle: "normal", letterSpacing: "0.04em" },
  "brush-kr":  { fontFamily: "'Nanum Brush Script', cursive", fontStyle: "normal", letterSpacing: "0.04em" },
  "sans-kr":   { fontFamily: "'Noto Sans KR', 'Pretendard', sans-serif", fontStyle: "normal", letterSpacing: "0.04em" },
};

export type CaptionEntry = {
  id: string;
  text: string;
  speaker?: string;          // e.g., "예찬" | "슬기" — rendered as "speaker: text"
  // Position in normalized 0-1 coords over the 1920×1080 canvas.
  //   The anchor is interpreted by `align`:
  //     center → box centered on (x,y)
  //     left   → box's left edge at x
  //     right  → box's right edge at x
  //   y is the vertical center of the text box in all cases.
  x: number;
  y: number;
  align?: CaptionAlign;
  fontFamily?: CaptionFont;
  fontSize?: number;         // px at 1920×1080
  color?: string;
  bg?: CaptionBackground;
  maxWidthPct?: number;      // 0-100, max horizontal width as % of canvas (default 95)
  // Optional time window (normalized 0-1 of scene duration).
  // Only visible (faded in/out + typing) inside [fromT, toT]. Defaults: [0, 1] = whole scene.
  fromT?: number;
  toT?: number;
};

export type SpotlightConfig = {
  x: number;        // 0-1
  y: number;        // 0-1
  radius: number;   // 0.05-0.5 (fraction of image size)
  strength: number;  // 0-1, dimming intensity outside (0.6 = 60% dim)
};

// Crop rectangle in normalized image coordinates (0-1).
// The crop region [x, x+w] × [y, y+h] is what gets shown at viewport size.
export type CropRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// "Popout" — a rectangular region of the photo that lifts forward (scale + shadow)
// during a time window. The base photo stays still; a clipped duplicate animates above.
// Used for highlighting badges, signs, faces inside a still composition.
//
// Coords are normalized 0-1 to the photo's image area (same basis as spotlights).
// Time window is normalized 0-1 to the scene duration.
export type PopoutRegion = {
  id: string;
  x: number;          // top-left of region inside the image
  y: number;
  w: number;          // size as fraction of image
  h: number;
  scale?: number;     // peak scale, default 1.5 (1.0 = no lift)
  fromT?: number;     // window start, default 0
  toT?: number;       // window end, default 1
  shadow?: "soft" | "strong";  // default "strong"
};

// Annotation arrow — points to a person/object in a group photo, with optional label.
// Coordinates are normalized to the image area (0-1, same basis as spotlights/focalPoint).
export type ArrowStyle =
  | "curve"          // thin ink curve (default)
  | "straight"       // thin ink straight
  | "dashed"         // thin dashed
  | "brush"          // thick gold brush
  | "bold-curve"     // bold ink curve
  | "bold-straight"  // bold ink straight
  | "marker";        // extra-thick marker (heaviest body)
export type ArrowColor = "ink" | "gold" | "burgundy" | "navy" | "sage" | "cream" | "white" | "lilac" | "lemon";

export const ARROW_COLOR_MAP: Record<ArrowColor, string> = {
  ink:      "#1a1510",           // classic black ink (default)
  gold:     "#a88848",           // warm gold (matches palette)
  burgundy: "#8a3a3a",           // deep red, classy
  navy:     "#2a3a5a",           // deep blue
  sage:     "#5a6e4f",           // muted green
  cream:    "#d9c89f",           // paper-tone ink (subtle)
  white:    "rgba(255,255,255,0.95)",
  lilac:    "#c896ff",           // bright lavender — high-vis on most photo subjects
  lemon:    "#ffe34a",           // highlighter yellow — high-vis on dark/mid photos
};

export const ARROW_COLOR_LABELS: Record<ArrowColor, string> = {
  ink:      "잉크",
  gold:     "금색",
  burgundy: "버건디",
  navy:     "네이비",
  sage:     "세이지",
  cream:    "크림",
  white:    "화이트",
  lilac:    "라일락",
  lemon:    "레몬",
};

export type AnnotationArrow = {
  id: string;
  tipX: number;            // where the arrow points
  tipY: number;
  labelX: number;          // where the label sits (arrow starts from near here)
  labelY: number;
  label?: string;          // optional text; arrow-only if omitted/empty
  style?: ArrowStyle;      // default 'curve'
  color?: ArrowColor;      // default 'ink' (or 'gold' for brush style)
  // Optional time window (normalized 0-1 of scene duration). If set, the arrow
  // draws/fades within this window instead of using the scene-wide envelope.
  fromT?: number;
  toT?: number;
};

export type PhotoEntry = {
  tag: string;
  act: number;
  file: string;
  durationSec: number;
  effect: Effect;
  focalPoint: { x: number; y: number }; // 0-1, default 0.5,0.5
  transition: TransitionType;
  filter: FilterType;
  caption?: CaptionConfig;        // legacy — prefer `captions`
  captions?: CaptionEntry[];      // multi-caption support (dialog, monologue)
  spotlights: SpotlightConfig[];
  crop?: CropRect; // if set, only this rect of the image is shown (normalized 0-1)
  kenBurnsAmount?: number; // per-photo override for zoom/pan intensity (0-1). undefined = use global.
  annotations?: AnnotationArrow[]; // hand-drawn arrows pointing to people/objects in group photos
  popouts?: PopoutRegion[];        // regions that lift forward (scale + shadow) on a time window
  splitPair?: boolean; // true = this photo + next photo form a split screen
  splitStyle?: SplitStyle; // layout when this is the left photo of a split pair
  splitLabel?: string; // custom label under polaroid/cameo (fallback: tag first word)
  eraIcon?: string; // key from ERA_ICONS (Claude Design P2-3) — small corner decoration
  eraIconPosition?: "tl" | "tr" | "bl" | "br"; // default: tr
  ornament?: string; // key from BOTANICAL_LIBRARY (Claude Design P1-3) — decorative overlay
  // Per-photo asset overrides (undefined = use global config)
  frameOverride?: FrameType;
  overlayOverride?: OverlayType;
  particlesOverride?: ParticleType;
};

export type ActTitle = {
  chapter: string;
  kr: string;
  variant?: TitleVariant; // overrides global titleVariant
  year?: string;          // small italic date line under the chapter (e.g., "1988 · 1993")
  subtitle?: string;      // narrative tagline between kr and year (e.g., "각자의 시작").
                          // Renders as a small Korean serif italic line so all 3 layers
                          // (act card / chat header / journey map) share one story arc.
};

export type EndingConfig = {
  date: string;
  groomName: string;
  brideName: string;
  message: string;
};

export type OverlayType = "none" | "film-grain" | "light-leak" | "bokeh" | "vignette";
export type ParticleType = "none" | "sparkle" | "petals" | "hearts" | "snow";
export type FrameType = "none" | "polaroid" | "film-strip" | "rounded" | "classic";

// NEW: layout/style options
export type SplitStyle = "standard" | "polaroid" | "cameo";
export type TitleVariant = "standard" | "journal";
export type BackgroundStyle = "blur" | "paper" | "black";

export type MomentCard = {
  id: string;              // unique identifier
  afterPhotoIndex: number; // inserted AFTER this photo index (0-based); -1 = before first photo
  l1: string;              // main line (Nanum Myeongjo 400, 56px)
  l2: string;              // emphasis line (Nanum Myeongjo 700, 56px)
  year: string;            // uppercase letter-spaced label (Cormorant 28px)
  durationSec?: number;    // default 2.0
};

export type YearMarker = {
  id: string;
  afterPhotoIndex: number; // inserted BEFORE photo at (afterPhotoIndex + 1)
  year: string;            // e.g., "2013"
  location: string;        // e.g., "분당"
  durationSec?: number;    // default 3.0
};

// P2-2 Journey Map interstitial
export type JourneyMap = {
  id: string;
  afterPhotoIndex: number;
  title?: string;          // English italic top banner, default "Our Journey"
  subtitle?: string;       // Korean subtitle under title
  caption?: string;        // bottom caption
  durationSec?: number;    // default 8.0
  visibleCount?: number;   // 1..5 — reveal only first N locations (last one is "present"). Default 5 (all).
};

// P2-4 Letter interlude
export type LetterInterlude = {
  id: string;
  afterPhotoIndex: number;
  date: string;            // e.g., "2015년 봄"
  l1: string;              // handwritten line 1 (large)
  l2: string;              // handwritten line 2 (larger)
  durationSec?: number;    // default 8.0
};

// Chat interlude — messenger-style conversation with typing animation.
// Empty message text renders as a "…" typing indicator (useful for "one side is still typing").
export type ChatMessage = {
  speaker: string;              // "예찬" | "슬기" | etc (display name above bubble)
  side?: "left" | "right";      // default: "left"
  text: string;                 // empty string → typing indicator
};

export type ChatInterlude = {
  id: string;
  afterPhotoIndex: number;
  header?: string;              // small italic header at top (e.g., "성모병원 · 1988")
  messages: ChatMessage[];
  durationSec?: number;         // default 12.0
};

// Auto-fit chat scene duration: header pad + per-message (typing + hold) + tail pad.
// Constants stay in lockstep with the renderer (`framesPerChar`, `holdFrames`,
// `headerFadeFrames`, `tailFadeFrames`) so what the editor schedules matches what
// plays back. Used by the live editor (recompute on message edit) and by the
// load-time migration that fixes legacy oversized durations.
export const CHAT_TIMING = {
  fps: 30,
  framesPerChar: 7,         // ~4.3 chars/sec — slightly faster than 3 cps; still readable for older guests
  minTypingFrames: 18,
  holdFrames: 18,           // 0.6s rest after typing finishes (= inter-bubble gap)
  headerFadeSec: 1.0,
  tailFadeSec: 1.5,
  minDurSec: 4.0,
};

// Photo-caption auto-fit timing. Speaker captions appear as left-side / right-side
// bubbles that type in PARALLEL (different speakers can be visible simultaneously),
// while two captions from the same speaker run SEQUENTIALLY (one stacks under the
// previous). Old auto-fit summed all chars and treated everything as sequential,
// which over-allocated dur by ~2x for two-speaker scenes. New model groups by
// speaker → max stream length determines dur.
//   head    : initial type-in offset before the first character renders
//   rate    : frames per character (~3.75 Korean chars/sec at 30fps)
//   buffer  : breath between two same-speaker bubbles
//   frontPadSec: empty front before first caption types
//   tailPadSec: tail breath after the last caption finishes typing
export const PHOTO_CAPTION_TIMING = {
  fps: 30,
  head: 6,
  rate: 8,
  buffer: 18,
  frontPadSec: 1.0,
  tailPadSec: 1.5,
  minDurSec: 4.0,
};

// True if the cap is a speech-bubble (color-coded by speaker, instant-display).
// Exported so callers can decide between bubble-aware and typing-based dur logic.
export function isBubbleCap(c: CaptionEntry): boolean {
  const k = resolveCaptionBgKind(c);
  return k === "bubble-yellow" || k === "bubble-purple";
}

function captionsBySpeaker(caps: CaptionEntry[]): Map<string, CaptionEntry[]> {
  const map = new Map<string, CaptionEntry[]>();
  for (const cap of caps) {
    const key = cap.speaker || "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(cap);
  }
  return map;
}

function streamFrames(caps: CaptionEntry[]): number {
  const t = PHOTO_CAPTION_TIMING;
  let frames = 0;
  for (let i = 0; i < caps.length; i++) {
    frames += t.head + t.rate * (caps[i].text?.length ?? 0);
    if (i < caps.length - 1) frames += t.buffer;
  }
  return frames;
}

// Natural scene duration for any caption set. For a pair scene, pass LEFT's caps +
// RIGHT's caps combined (caller's responsibility) so cross-photo speaker grouping
// works. For a single, just its own caps.
//
// Bubble-aware: speech bubbles (슬기/예찬) appear instantly via enrichCaptionsForRender
// — typing-speed × char-count is irrelevant. Allocating dur via streamFrames over-shoots
// massively (e.g. 3 bubbles → 23s when the actual chat needs ~10s, leaving 13s of dead
// air after the last bubble). For bubble-only scenes we use:
//   head(1s) + (N-1) × maxGap(3s) + tail(2s)
// which mirrors enrichCaptionsForRender's distribution math (headFrames=30, maxGap=90).
// Mixed (bubble + typing) scenes still fall through to the typing formula since the
// typing caption sets the ceiling.
export function computeSceneDurationSec(allCaps: CaptionEntry[], fallback?: number): number {
  const t = PHOTO_CAPTION_TIMING;
  if (allCaps.length === 0) return Math.max(t.minDurSec, fallback ?? t.minDurSec);

  if (allCaps.every(isBubbleCap)) {
    const N = allCaps.length;
    const headSec = 1.0;     // matches enrich's headFrames = 30 @ 30fps
    const maxGapSec = 3.0;   // matches enrich's maxGap = 90 @ 30fps
    const tailSec = 2.0;     // comfortable read time after last bubble
    const naturalSec = headSec + Math.max(0, N - 1) * maxGapSec + tailSec;
    return Math.max(t.minDurSec, naturalSec);
  }

  const streams = captionsBySpeaker(allCaps);
  let maxFrames = 0;
  for (const caps of streams.values()) maxFrames = Math.max(maxFrames, streamFrames(caps));
  const naturalSec = maxFrames / t.fps;
  return Math.max(t.minDurSec, t.frontPadSec + naturalSec + t.tailPadSec);
}

// Recompute fromT/toT for every caption so each speaker's bubbles type back-to-back
// starting at frontPad, with toT = end-of-scene minus tailPad. Captions across
// speakers run in parallel timelines — each gets its own cursor. Returns a new
// array preserving input order; cap.speaker stays untouched.
export function repackCaptions(caps: CaptionEntry[], durSec: number): CaptionEntry[] {
  const t = PHOTO_CAPTION_TIMING;
  if (caps.length === 0 || durSec <= 0) return caps;
  const D = durSec * t.fps;
  const startFrame = t.frontPadSec * t.fps;
  const tailFrame = D - t.tailPadSec * t.fps;
  const toTFrac = Math.max(0.6, Math.min(0.97, tailFrame / D));
  const cursors = new Map<string, number>();
  return caps.map((cap) => {
    const key = cap.speaker || "";
    const cursor = cursors.get(key) ?? startFrame;
    const fromT = Math.max(0, Math.min(toTFrac - 0.02, cursor / D));
    const advance = t.head + t.rate * (cap.text?.length ?? 0) + t.buffer;
    cursors.set(key, cursor + advance);
    return { ...cap, fromT, toT: toTFrac };
  });
}

export function computeChatDurationSec(messages: ChatMessage[] | undefined): number {
  const t = CHAT_TIMING;
  const msgs = messages ?? [];
  if (msgs.length === 0) return t.minDurSec;
  const naturalFrames = msgs.reduce((sum, m) => {
    const chars = Array.from(m.text ?? "").length;
    const typing = Math.max(t.minTypingFrames, chars * t.framesPerChar);
    return sum + typing + t.holdFrames;
  }, 0);
  const naturalSec = naturalFrames / t.fps;
  return Math.max(t.minDurSec, t.headerFadeSec + naturalSec + t.tailFadeSec);
}

// P2-5 Polaroid Collage (7 photo slots on kraft paper)
export type CollageSlot = {
  file: string;            // photo URL
  caption?: string;        // handwritten label
};
export type Collage = {
  id: string;
  afterPhotoIndex: number;
  slots: CollageSlot[];    // up to 7 entries
  durationSec?: number;    // default 6.0
  beforeTitle?: boolean;   // if true, insert BEFORE the act title card at the transition point
                           //   (use case: "end of prev act" bookend before the new act starts)
  caption?: string;        // scene-level bottom caption (handwritten script on scrim)
};

// Two-track BGM with auto crossfade + master fade in/out at scene boundaries.
// Tracks live in `public/<src>` and are referenced via Remotion's staticFile.
// Track A plays from the start, then crossfades into Track B at the transition.
// The transition point is either an absolute time (trackBStartSec) or anchored
// to the start frame of an Act's title card (trackBStartAct). When both are set,
// trackBStartAct wins.
export type AudioConfig = {
  trackA?: string;          // path under public/, e.g. "audio/bgm-1.mp3"
  trackB?: string;
  trackBStartSec?: number;  // composition seconds — center of crossfade
  trackBStartAct?: number;  // align crossfade center to start of this Act's title card
  trackBStartActOffsetSec?: number; // shift the act-anchored crossfade center by N seconds
                                    //   (positive = transition later, negative = earlier).
                                    //   Lets you keep track A playing past the Act anchor without
                                    //   abandoning the act-anchored semantics.
  crossfadeSec?: number;    // A's fade-out duration in seconds (default 4). Misnomer kept for back-compat.
  trackBFadeInSec?: number; // B's fade-in duration. Defaults to crossfadeSec if unset.
                            // Setting longer than crossfadeSec gives B a softer entrance
                            // — useful when B's intro instruments sound abrupt at fast fade.
  trackBGapSec?: number;    // silence gap between A's end (trackBStartSec) and B's start.
                            // Default 0 = sequential handoff. Increase to clearly separate
                            // the two tracks aurally — even at zero overlap, perceptually
                            // adjacent fade tails can feel like "overlap"; a 1-2s gap fixes that.
  volume?: number;          // master volume 0-1 (default 0.30)
  fadeInSec?: number;       // fade in at video start (default 1.5)
  fadeOutSec?: number;      // fade out at video end  (default 2.5)
  trackAOffsetSec?: number; // optional: skip into track A (default 0)
  trackBOffsetSec?: number; // optional: skip into track B (default 0)
};

export type VideoConfig = {
  photos: PhotoEntry[];
  actTitles: Record<number, ActTitle>;
  ending: EndingConfig;
  titleCardSec: number;
  endingSec: number;
  crossfadeSec: number;
  fps: number;
  overlay: OverlayType;
  particles: ParticleType;
  frame: FrameType;
  bgmUrl?: string;
  audio?: AudioConfig;
  // NEW
  backgroundStyle: BackgroundStyle;
  kenBurnsAmount: number;
  titleVariant: TitleVariant;
  moments?: MomentCard[]; // "이때" interstitial cards inserted between photos
  yearMarkers?: YearMarker[]; // year / location title interstitials
  journeyMaps?: JourneyMap[]; // animated journey map scenes
  letterInterludes?: LetterInterlude[]; // handwritten letter scenes
  chatInterludes?: ChatInterlude[]; // messenger-style conversation scenes
  collages?: Collage[]; // 7-polaroid scrapbook scenes
};

// ─────────────────────────────────────────────
// Timeline types & builder
// ─────────────────────────────────────────────

export type TransitionMode = "fade" | "iris-in" | "iris-out" | "slide-left" | "slide-right" | "wipe-down" | "none";

export type TimelineItem =
  | { kind: "titleCard"; act: number; durationInFrames: number; name: string }
  | { kind: "photo"; photo: PhotoEntry; durationInFrames: number; enterTransition: TransitionMode; exitTransition: TransitionMode; name: string }
  | { kind: "split"; left: PhotoEntry; right: PhotoEntry; durationInFrames: number; mergeOut: boolean; name: string }
  | { kind: "moment"; card: MomentCard; durationInFrames: number; name: string }
  | { kind: "yearMarker"; marker: YearMarker; durationInFrames: number; name: string }
  | { kind: "journeyMap"; map: JourneyMap; durationInFrames: number; name: string }
  | { kind: "letter"; letter: LetterInterlude; durationInFrames: number; name: string }
  | { kind: "chat"; chat: ChatInterlude; durationInFrames: number; name: string }
  | { kind: "collage"; collage: Collage; durationInFrames: number; name: string }
  | { kind: "ending"; durationInFrames: number; name: string };

export function buildTimeline(
  photos: PhotoEntry[],
  titleCardFrames: number,
  endingFrames: number,
  fps: number,
  moments: MomentCard[] = [],
  yearMarkers: YearMarker[] = [],
  journeyMaps: JourneyMap[] = [],
  letterInterludes: LetterInterlude[] = [],
  collages: Collage[] = [],
  chatInterludes: ChatInterlude[] = []
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const seenActs = new Set<number>();

  // Group moments by insertion point
  const momentsBefore = new Map<number, MomentCard[]>(); // afterPhotoIndex = N → show BEFORE photo N+1
  for (const m of moments) {
    const key = m.afterPhotoIndex + 1; // if afterPhotoIndex=-1, show before photo 0
    if (!momentsBefore.has(key)) momentsBefore.set(key, []);
    momentsBefore.get(key)!.push(m);
  }

  // Group year markers by insertion point
  const yearsBefore = new Map<number, YearMarker[]>();
  for (const y of yearMarkers) {
    const key = y.afterPhotoIndex + 1;
    if (!yearsBefore.has(key)) yearsBefore.set(key, []);
    yearsBefore.get(key)!.push(y);
  }

  const mapsBefore = new Map<number, JourneyMap[]>();
  for (const m of journeyMaps) {
    const key = m.afterPhotoIndex + 1;
    if (!mapsBefore.has(key)) mapsBefore.set(key, []);
    mapsBefore.get(key)!.push(m);
  }

  const lettersBefore = new Map<number, LetterInterlude[]>();
  for (const l of letterInterludes) {
    const key = l.afterPhotoIndex + 1;
    if (!lettersBefore.has(key)) lettersBefore.set(key, []);
    lettersBefore.get(key)!.push(l);
  }

  const collagesBefore = new Map<number, Collage[]>();
  for (const c of collages) {
    const key = c.afterPhotoIndex + 1;
    if (!collagesBefore.has(key)) collagesBefore.set(key, []);
    collagesBefore.get(key)!.push(c);
  }

  const chatsBefore = new Map<number, ChatInterlude[]>();
  for (const c of chatInterludes) {
    const key = c.afterPhotoIndex + 1;
    if (!chatsBefore.has(key)) chatsBefore.set(key, []);
    chatsBefore.get(key)!.push(c);
  }

  let i = 0;
  while (i < photos.length) {
    const p = photos[i];

    // Collages with beforeTitle=true appear BEFORE the act title card
    // (used as "end of previous act" bookends at act transition points).
    const collagesAtI = collagesBefore.get(i) ?? [];
    const collagesBeforeTitle = collagesAtI.filter((c) => c.beforeTitle);
    const collagesAfterTitle  = collagesAtI.filter((c) => !c.beforeTitle);

    if (collagesBeforeTitle.length > 0) {
      for (const c of collagesBeforeTitle) {
        items.push({
          kind: "collage",
          collage: c,
          durationInFrames: Math.round((c.durationSec ?? 6.0) * fps),
          name: `Collage (end of act) — ${c.slots.length} photos`,
        });
      }
    }

    if (!seenActs.has(p.act)) {
      seenActs.add(p.act);
      items.push({
        kind: "titleCard",
        act: p.act,
        durationInFrames: titleCardFrames,
        name: `Act ${p.act} — Title`,
      });
    }

    // Insert year markers first, then moment cards (year is more structural)
    const yearsHere = yearsBefore.get(i);
    if (yearsHere) {
      for (const y of yearsHere) {
        items.push({
          kind: "yearMarker",
          marker: y,
          durationInFrames: Math.round((y.durationSec ?? 3.0) * fps),
          name: `Year — ${y.year} · ${y.location}`,
        });
      }
    }
    const before = momentsBefore.get(i);
    if (before) {
      for (const card of before) {
        items.push({
          kind: "moment",
          card,
          durationInFrames: Math.round((card.durationSec ?? 2.0) * fps),
          name: `Moment — ${card.l1} / ${card.l2}`,
        });
      }
    }
    // Journey maps
    const mapsHere = mapsBefore.get(i);
    if (mapsHere) {
      for (const m of mapsHere) {
        items.push({
          kind: "journeyMap",
          map: m,
          durationInFrames: Math.round((m.durationSec ?? 8.0) * fps),
          name: `Map — ${m.title ?? "Journey"}`,
        });
      }
    }
    // Letter interludes
    const lettersHere = lettersBefore.get(i);
    if (lettersHere) {
      for (const l of lettersHere) {
        items.push({
          kind: "letter",
          letter: l,
          durationInFrames: Math.round((l.durationSec ?? 8.0) * fps),
          name: `Letter — ${l.l1}`,
        });
      }
    }
    // Chat interludes (after letters, before collages — conversation framing)
    const chatsHere = chatsBefore.get(i);
    if (chatsHere) {
      for (const c of chatsHere) {
        const preview = c.header ?? c.messages.find((m) => m.text)?.text?.slice(0, 20) ?? "대화";
        items.push({
          kind: "chat",
          chat: c,
          durationInFrames: Math.round((c.durationSec ?? 12.0) * fps),
          name: `Chat — ${preview}`,
        });
      }
    }
    // Collages (only those WITHOUT beforeTitle — the others were inserted earlier)
    if (collagesAfterTitle.length > 0) {
      for (const c of collagesAfterTitle) {
        items.push({
          kind: "collage",
          collage: c,
          durationInFrames: Math.round((c.durationSec ?? 6.0) * fps),
          name: `Collage — ${c.slots.length} photos`,
        });
      }
    }

    // Split pair: this photo (left) + next photo (right) → SplitScene
    if (p.splitPair && i + 1 < photos.length) {
      const right = photos[i + 1];
      // Check if the NEXT non-pair photo is also not a split → this is the last split → mergeOut
      const nextAfterPair = i + 2 < photos.length ? photos[i + 2] : null;
      const isLastSplit = !nextAfterPair?.splitPair;
      items.push({
        kind: "split",
        left: p,
        right,
        // Respect the left photo's configured duration (was hardcoded 4.0).
        durationInFrames: Math.round(p.durationSec * fps),
        mergeOut: isLastSplit,
        name: `Split — ${p.tag} / ${right.tag}`,
      });
      i += 2;
      continue;
    }

    // Determine enter transition: previous photo's exit transition tells us how we enter.
    // For the first photo in each act after a title card, enter is always "fade" from title.
    // If previous photo specified a transition, it becomes this photo's enter.
    let enterTransition: TransitionMode = "fade";
    if (i > 0 && photos[i - 1].act === p.act) {
      const prevT = photos[i - 1].transition;
      if (prevT === "iris") enterTransition = "iris-in";
      else if (prevT === "slide-left") enterTransition = "slide-left";
      else if (prevT === "slide-right") enterTransition = "slide-right";
      else if (prevT === "wipe-down") enterTransition = "wipe-down";
      else if (prevT === "none") enterTransition = "none";
      else enterTransition = "fade";
    }

    // Exit transition: from this photo's own transition field
    let exitTransition: TransitionMode = "fade";
    if (p.transition === "iris") exitTransition = "iris-out";
    else if (p.transition === "none") exitTransition = "none";
    else if (p.transition !== "fade") exitTransition = p.transition;

    items.push({
      kind: "photo",
      photo: p,
      durationInFrames: Math.round(p.durationSec * fps),
      enterTransition,
      exitTransition,
      name: `${i + 1}. Act ${p.act} — ${p.tag}`,
    });
    i++;
  }

  items.push({
    kind: "ending",
    durationInFrames: endingFrames,
    name: "Ending",
  });

  return items;
}

// Returns the photo index at the given frame, or null if on title/ending.
export function getPhotoIndexAtFrame(frame: number, config: VideoConfig): number | null {
  const cf = Math.round(config.crossfadeSec * config.fps);
  const tcf = Math.round(config.titleCardSec * config.fps);
  const ef = Math.round(config.endingSec * config.fps);
  const tl = buildTimeline(
    config.photos, tcf, ef, config.fps,
    config.moments ?? [],
    config.yearMarkers ?? [],
    config.journeyMaps ?? [],
    config.letterInterludes ?? [],
    config.collages ?? [],
    config.chatInterludes ?? [],
  );

  let cursor = 0;
  for (const item of tl) {
    const end = cursor + item.durationInFrames;
    if (frame >= cursor && frame < end) {
      if (item.kind === "photo") return config.photos.indexOf(item.photo);
      if (item.kind === "split") return config.photos.indexOf(item.left);
      return null;
    }
    cursor += item.durationInFrames - cf;
  }
  return null;
}

// Returns a frame in the middle of the photo (after crossfade-in completes).
export function getPhotoStartFrame(photoIdx: number, config: VideoConfig): number {
  const target = config.photos[photoIdx];
  if (!target) return 0;
  const cf = Math.round(config.crossfadeSec * config.fps);
  const tcf = Math.round(config.titleCardSec * config.fps);
  const ef = Math.round(config.endingSec * config.fps);
  const tl = buildTimeline(
    config.photos, tcf, ef, config.fps,
    config.moments ?? [],
    config.yearMarkers ?? [],
    config.journeyMaps ?? [],
    config.letterInterludes ?? [],
    config.collages ?? [],
    config.chatInterludes ?? [],
  );

  let cursor = 0;
  for (const item of tl) {
    if (item.kind === "photo" && item.photo === target) {
      // Land mid-photo: past crossfade-in, so the photo is fully visible
      return cursor + Math.min(cf + 2, Math.floor(item.durationInFrames / 2));
    }
    if (item.kind === "split" && (item.left === target || item.right === target)) {
      return cursor + Math.min(cf + 2, Math.floor(item.durationInFrames / 2));
    }
    cursor += item.durationInFrames - cf;
  }
  return 0;
}

export function computeTotalFrames(config: VideoConfig): number {
  const cf = Math.round(config.crossfadeSec * config.fps);
  const tcf = Math.round(config.titleCardSec * config.fps);
  const ef = Math.round(config.endingSec * config.fps);
  const tl = buildTimeline(
    config.photos, tcf, ef, config.fps,
    config.moments ?? [],
    config.yearMarkers ?? [],
    config.journeyMaps ?? [],
    config.letterInterludes ?? [],
    config.collages ?? [],
    config.chatInterludes ?? [],
  );
  const sum = tl.reduce((s, it) => s + it.durationInFrames, 0);
  return sum - cf * (tl.length - 1);
}

// ─────────────────────────────────────────────
// Default data (from manifest.ts)
// ─────────────────────────────────────────────

const D = {
  split: 5.0,  // Act I split screen pairs (increased for breathing)
  reveal: 4.0, // Act I reveal photo (경복궁 - demoted from "star" moment)
  grow: 3.2,   // Act II growing up
  growStar: 5.0, // Act II key community photos (the real reveal)
  trip: 3.0,   // Act III trips
  trip2: 3.2,  // Act III performances / galleries
  date: 3.2,   // Act III/IV couple dates
  mile: 3.5,   // Act IV milestones
  us: 3.8,     // Act V the two of us
  last: 8.0,   // Act V ending photo (longer for emotional close)
};

// Supabase Storage base URL for photos
const S = "https://hgltvdshuyfffskvjmst.supabase.co/storage/v1/object/public/letter-photos/final";
// Local dev fallback
const F = "photos_final";

const fx: Effect[] = ["zoomIn", "panRight", "zoomOut", "panLeft"];
const e = (i: number): Effect => fx[i % fx.length];

// Helper to create photo entries with sensible defaults
const P = (
  tag: string, act: number, file: string, durationSec: number, effect: Effect,
  extra?: Partial<PhotoEntry>
): PhotoEntry => ({
  tag, act, file, durationSec, effect,
  focalPoint: { x: 0.5, y: 0.5 },
  transition: "fade",
  filter: "none",
  spotlights: [],
  ...extra,
});

// Spotlight helper for multi-spot config (default r=0.25, strength=0.55 — matches editor default)
const SL = (x: number, y: number, radius = 0.25, strength = 0.55): SpotlightConfig => ({ x, y, radius, strength });
// Focal helper
const FP = (x: number, y: number) => ({ x, y });

const defaultPhotos: PhotoEntry[] = [
  // ── Act I — 그때의 우리 (유년기 페어 6쌍 + 경복궁) ──────
  // 아이콘은 페어당 1개만, 반복 피해서 절제
  P("슬기 성모병원",              1, `${S}/001.jpg`, D.split, "zoomIn",  { splitPair: true, splitStyle: "polaroid", eraIcon: "teddy-bear" }),
  P("예찬 성모병원",              1, `${S}/002.jpg`, D.split, "zoomIn"),
  P("슬기 생일",                  1, `${S}/003.jpg`, D.split, "zoomOut", { splitPair: true, splitStyle: "polaroid", eraIcon: "birthday-cake" }),
  P("예찬 생일",                  1, `${S}/004b.jpg`, D.split, "zoomOut"),
  P("슬기 아빠와",                1, `${S}/005.jpg`, D.split, "zoomIn",  { splitPair: true, splitStyle: "polaroid" }),
  P("예찬 아빠와",                1, `${S}/006.jpg`, D.split, "zoomIn"),
  P("슬기 장난기",                1, `${S}/007.jpg`, D.split, "panRight", { splitPair: true, splitStyle: "polaroid", eraIcon: "rocking-horse" }),
  P("예찬 장난기",                1, `${S}/008.jpg`, D.split, "panRight"),
  P("슬기 부엌",                  1, `${S}/009.jpg`, D.split, "zoomOut", { splitPair: true, splitStyle: "polaroid" }),
  P("예찬 부엌",                  1, `${S}/010.jpg`, D.split, "zoomOut"),
  P("슬기 그림",                  1, `${S}/011.jpg`, D.split, "zoomIn",  { splitPair: true, splitStyle: "polaroid", eraIcon: "crayon" }),
  P("예찬 그림",                  1, `${S}/012.jpg`, D.split, "zoomIn"),

  // ── Act II — 분당 (1997~ 분당교회) ──────
  // 순서: 경복궁 → 바다 여행 → 분당선교원 2 → 단체사진들 → ... (사용자 지정 순서)
  P("경복궁",                    2, `${S}/013b.jpg`,   D.reveal, "zoomIn"),
  P("바다 여행 1",               2, `${S}/sea-1.jpeg`, D.reveal, "zoomIn"),
  P("바다 여행 2",               2, `${S}/sea-2.jpeg`, D.reveal, "panRight"),
  P("분당선교원 2",               2, `${S}/015.jpeg`, D.growStar, "zoomIn", {
    focalPoint: FP(0.577, 0.404),
    spotlights: [SL(0.405, 0.317), SL(0.710, 0.579), SL(0.485, 0.225), SL(0.695, 0.526)],
  }),
  P("여름 단체사진",              2, `${S}/019.jpeg`, D.grow, "zoomIn", {
    spotlights: [SL(0.512, 0.414), SL(0.852, 0.416)],
  }),
  P("가을 단체사진",              2, `${S}/020.jpeg`, D.grow, "zoomIn", {
    focalPoint: FP(0.706, 0.392),
    spotlights: [SL(0.678, 0.326), SL(0.776, 0.412), SL(0.575, 0.423), SL(0.781, 0.421)],
  }),
  P("겨울 단체사진",              2, `${S}/021.jpeg`, D.grow, "zoomOut", {
    focalPoint: FP(0.603, 0.497),
    spotlights: [
      { x: 0.42, y: 0.55, radius: 0.18, strength: 0.35 },
      { x: 0.60, y: 0.50, radius: 0.18, strength: 0.35 },
      SL(0.528, 0.452), SL(0.772, 0.528), SL(0.736, 0.507),
    ],
  }),
  P("붉은악마 단체",              2, `${S}/016.jpeg`, D.grow, "zoomIn"),
  P("서울 단체사진",              2, `${S}/022.jpeg`, D.grow, "panLeft"),
  P("교회 기획실",                2, `${S}/024.jpeg`, D.grow, "panRight"),
  P("영화관",                     2, `${S}/023.jpeg`, D.grow, "zoomIn"),
  P("스키장",                     2, `${S}/025.jpeg`, D.grow, "zoomIn", {
    focalPoint: FP(0.573, 0.553),
  }),
  P("고등학교 졸업식",            2, `${S}/026.jpeg`, D.grow, "zoomIn", { eraIcon: "grad-cap" }),
  P("침례식",                     2, `${S}/027.jpeg`, D.grow, "zoomIn", { eraIcon: "stained-glass" }),

  // ── Act III — 청춘 (한국 청년기) ──────
  // 아이콘은 섹션 시작에만 (여행 첫 장, 공연 첫 장, 갤러리 첫 장, 슬기 졸업)
  P("여행 식사 1",                3, `${S}/028.jpeg`, D.trip, e(0), { eraIcon: "suitcase" }),
  P("여행 식사 2",                3, `${S}/029.jpeg`, D.trip, e(1)),
  P("여행 단체 1",                3, `${S}/030.jpeg`, D.trip, e(2)),
  P("여행 단체 2",                3, `${S}/031.jpeg`, D.trip, e(3)),
  P("여행 단체 3",                3, `${S}/032.jpeg`, D.trip, e(4)),
  P("여행 단체 4",                3, `${S}/033.jpeg`, D.trip, e(5)),
  P("공연 1",                    3, `${S}/034.jpeg`, D.trip2, e(6), { eraIcon: "concert-ticket" }),
  P("공연 2",                    3, `${S}/035.jpeg`, D.trip2, e(7)),
  P("공연 3",                    3, `${S}/036.jpeg`, D.trip2, e(8)),
  P("공연 4",                    3, `${S}/037.jpeg`, D.trip2, e(9)),
  P("갤러리 전시 1",              3, `${S}/038.jpeg`, D.date, "zoomIn",  { eraIcon: "gallery-frame" }),
  P("갤러리 전시 2",              3, `${S}/039.jpeg`, D.date, "zoomOut"),
  P("갤러리 전시 3",              3, `${S}/040.jpeg`, D.date, "panRight"),
  P("갤러리 전시 4",              3, `${S}/041.jpeg`, D.date, "zoomIn"),
  P("슬기 학사 졸업",              3, `${S}/050.jpeg`, D.mile, "zoomIn",  { eraIcon: "grad-cap" }),

  // ── Act IV — 바다를 사이에 두고 (2016~ 거리의 시간) ──────
  // 아이콘은 섹션 시작 (군입대 첫, 뉴욕 첫, 졸업)
  P("예찬 군입대",                4, `${S}/046.jpg`,  D.mile, "zoomIn",  { eraIcon: "military-hat" }),
  P("예찬 군입대 2",              4, `${S}/047.png`,  D.mile, "zoomOut"),
  P("예찬 군입대 3",              4, `${S}/048.jpeg`, D.mile, "panRight"),
  P("예찬 군입대 4",              4, `${S}/049.jpeg`, D.mile, "zoomIn"),
  P("뉴욕 1",                     4, `${S}/042.png`,  D.date, "zoomIn",  { eraIcon: "nyc-skyline" }),
  P("뉴욕 2",                     4, `${S}/043.png`,  D.date, "panLeft"),
  P("뉴욕 3",                     4, `${S}/044d.jpg`, D.date, "zoomOut"),
  P("뉴욕 4",                     4, `${S}/045.png`,  D.date, "zoomIn"),
  P("예찬 졸업식",                4, `${S}/051.jpg`,  D.mile, "zoomOut", { eraIcon: "diploma" }),

  // ── Act V — 그리고, 오늘 (2026 재회·연인·결혼) ──────
  // 아이콘은 시작·중간·마지막 3장에만 (과하지 않게)
  P("두 사람 1",                  5, `${S}/052c.jpg`, D.us, "zoomIn", { eraIcon: "two-cups" }),
  P("두 사람 2",                  5, `${S}/053d.jpg`, D.us, "zoomOut"),
  P("두 사람 3",                  5, `${S}/054.jpg`, D.us, "panRight"),
  P("두 사람 4",                  5, `${S}/055.png`, D.us, "zoomIn"),
  P("바닷가",                     5, `${S}/바닷가.jpg`, D.us, "zoomIn"),
  P("바닷가 2",                   5, `${S}/seaside-2.jpg`, D.us, "panRight"),
  P("두 사람 5",                  5, `${S}/056.jpg`, D.us, "panLeft", { eraIcon: "bouquet" }),
  P("두 사람 6",                  5, `${S}/057.jpg`, D.us, "zoomOut"),
  // 크레센도 — 마지막 3장 점진적으로 길어짐 (3.8s → 4.4s → 5.0s → 8.0s)
  P("두 사람 7",                  5, `${S}/058.jpg`, 4.4, "zoomIn"),
  P("두 사람 8",                  5, `${S}/059.jpg`, 5.0, "zoomOut"),
  P("★ 마지막",                   5, `${S}/060.jpg`, D.last, "zoomIn", { eraIcon: "linked-rings" }),
];

// Narrative-first titles: tagline IS the title. Place names dropped — the story arc
// (각자의 시작 → 함께의 시작 → 같이, 또 따로 → 바다 사이 → 여기, 오늘) carries the meaning;
// "성모병원·분당·서울" felt incidental. Same titles repeat in chat headers and journey map.
const defaultActTitles: Record<number, ActTitle> = {
  1: { chapter: "Act I",   kr: "각자의 시작",         year: "1988 · 1993" },
  2: { chapter: "Act II",  kr: "함께의 시작",         year: "1994 — " },
  3: { chapter: "Act III", kr: "같이, 또 따로",       year: "2008 — 2015" },
  4: { chapter: "Act IV",  kr: "바다를 사이에 두고",  year: "2016 — 2025" },
  5: { chapter: "Act V",   kr: "여기, 오늘",          year: "2026" },
};

export const defaultConfig: VideoConfig = {
  photos: defaultPhotos,
  actTitles: defaultActTitles,
  ending: {
    date: "2026 · 05 · 05",
    groomName: "이예찬",
    brideName: "송슬기",
    message: "함께 해 주셔서 감사드립니다",
  },
  audio: {
    trackA: "audio/bgm-1.mp3",          // 주여 지난 밤 내 꿈에 (266s ≈ 4:26) — Act I
    trackB: "audio/bgm-2.mp3",          // 은혜 (289s ≈ 4:49) — Act II 분당부터 끝까지
    trackBStartSec: 160,                 // 2:40 = A 페이드아웃 종료 (단조 진입 직전)
    crossfadeSec: 4,                     // A 페이드아웃 4s [2:36~2:40]
    trackBGapSec: 0.8,                   // 2:40~2:40.8 짧은 정적 (분리감만 살짝)
    trackBFadeInSec: 3,                  // B 페이드인 3s [2:40.8~2:43.8] — 빠르게 풀볼륨 도달
    volume: 0.30,
    fadeInSec: 1.5,
    fadeOutSec: 8.0,                     // 영상 반복 재생 고려해 자연스러운 페이드아웃 (was 2.5)
  },
  titleCardSec: 6.0,   // longer breath for the opening — sets the tone
  endingSec: 13.0,     // extended for held silence + botanical sprig + message breath
  crossfadeSec: 0.6,
  fps: 30,
  overlay: "none",
  particles: "none",
  frame: "none",
  backgroundStyle: "paper",  // NEW — cream paper (vintage journal feel)
  kenBurnsAmount: 0.04,      // NEW — half of previous 0.08 (calmer)
  titleVariant: "journal",   // NEW — elegant journal style for all acts
  // ── 인터스티셜 배치 ──
  // photos 인덱스 (★분당선교원 단체 제거 후):
  //   Act I   0-11  (12장 · 페어 6쌍)
  //   Act II  12-25 (14장 · 경복궁/바다1/바다2 + 분당선교원 2 + 단체사진 등)
  //   Act III 26-40 (15장)
  //   Act IV  41-49 (9장)
  //   Act V   50-58 (9장)
  moments: [
    // Act V 시작 (2026 재회)
    { id: "m-5", afterPhotoIndex: 49, l1: "다시, 여기서", l2: "우리가 되었다", year: "2026 · 봄", durationSec: 2.5 },
  ],
  yearMarkers: [],
  journeyMaps: [
    { id: "jm-1", afterPhotoIndex: -1, title: "Our Journey",      visibleCount: 1, durationSec: 4.5 },
    { id: "jm-2", afterPhotoIndex: 11, title: "Our Journey",      visibleCount: 2, durationSec: 6.5 },
    { id: "jm-3", afterPhotoIndex: 25, title: "Our Journey",      visibleCount: 3, durationSec: 6.5 },
    { id: "jm-4", afterPhotoIndex: 40, title: "Across the Ocean", visibleCount: 4, durationSec: 7.0, caption: "계절이 몇 번, 그래도 서로에게" },
    { id: "jm-5", afterPhotoIndex: 49, title: "Here, Today",      visibleCount: 5, durationSec: 7.5 },
  ],
  letterInterludes: [],      // 의도적으로 비움 — 편지 인터루드는 스토리에 맞지 않음
  chatInterludes: [
    {
      id: "chat-1",
      afterPhotoIndex: -1,   // jm-1 여정 지도 직후, 성모병원 폴라로이드 페어 직전
      header: "각자의 시작 · 1988",
      messages: [
        {
          speaker: "예찬",
          side: "left",
          text: "우리가 시간만 달랐지, 아예 같은 병원에서 태어난줄은 크고나서 알았지. 정말 인연이었나봐:)",
        },
        {
          speaker: "슬기",
          side: "right",
          text: "",  // 아직 공백 — "typing..." 인디케이터로 렌더
        },
      ],
      durationSec: 12.0,
    },
    {
      id: "chat-2",
      afterPhotoIndex: 11,   // Act II 타이틀 + jm-2 여정 지도 직후, 경복궁 직전
      header: "함께의 시작 · 1994",
      messages: [
        {
          speaker: "예찬",
          side: "left",
          text: "내 첫 돌부터 함께 했었다니! 우리는 정말 어렸을 때부터 평생을 함께 자라왔네",
        },
        {
          speaker: "슬기",
          side: "right",
          text: "",  // 아직 공백
        },
      ],
      durationSec: 12.0,
    },
    {
      id: "chat-3",
      afterPhotoIndex: 25,   // Act III 타이틀 + jm-3 여정 지도 직후, 여행 식사 1 직전
      header: "같이, 또 따로 · 2008 — 2015",
      // 이번에는 슬기가 먼저 — 서사는 추후 결정. 현재 둘 다 공백(... 인디케이터 표시됨).
      messages: [
        {
          speaker: "슬기",
          side: "right",
          text: "",  // 서사 미정
        },
        {
          speaker: "예찬",
          side: "left",
          text: "",  // 서사 미정
        },
      ],
      durationSec: 12.0,
    },
    // chat-4 ("바다를 사이에 두고") 제거됨 — 사용자가 지운 default가 loadConfig의
    // missingDefaultChats 머지로 자꾸 부활하는 문제 해결.
    {
      id: "chat-5",
      afterPhotoIndex: 49,   // Act V 타이틀 + m-5 모먼트 + jm-5 (Here, Today) 직후, 두 사람 1 직전
      header: "여기, 오늘 · 2026",
      // 서사 미정 — 다섯 Act 모두 슬기 답변은 추후 채움.
      messages: [
        {
          speaker: "예찬",
          side: "left",
          text: "",
        },
        {
          speaker: "슬기",
          side: "right",
          text: "",
        },
      ],
      durationSec: 12.0,
    },
  ],
  collages: [
    // Act I 엔딩 북엔드 — Act 1 마지막 페어(예찬 그림, idx 11) 뒤, Act II 타이틀 앞에 삽입.
    // 2개 연속: 슬기 단독 모음 → 예찬 단독 모음.
    {
      id: "cg-sl-solo",
      afterPhotoIndex: 11,
      beforeTitle: true,
      durationSec: 5.5,
      slots: [
        { file: `${S}/sl-solo-1b.png` },
        { file: `${S}/sl-solo-2.jpeg` },
        { file: `${S}/sl-solo-3.jpeg` },
      ],
    },
    {
      id: "cg-ye-solo",
      afterPhotoIndex: 11,
      beforeTitle: true,
      durationSec: 5.5,
      slots: [
        { file: `${S}/ye-solo-1.jpeg` },
        { file: `${S}/ye-solo-2.jpeg` },
        { file: `${S}/ye-solo-3.jpeg` },
      ],
    },
  ],
};
