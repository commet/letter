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

export type CaptionConfig = {
  text: string;
  position: "top" | "bottom" | "center";
};

export type SpotlightConfig = {
  x: number;        // 0-1
  y: number;        // 0-1
  radius: number;   // 0.05-0.5 (fraction of image size)
  strength: number;  // 0-1, dimming intensity outside (0.6 = 60% dim)
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
  caption?: CaptionConfig;
  spotlights: SpotlightConfig[];
  splitPair?: boolean; // true = this photo + next photo form a split screen
  splitStyle?: SplitStyle; // layout when this is the left photo of a split pair
  splitLabel?: string; // custom label under polaroid/cameo (fallback: tag first word)
  // Per-photo asset overrides (undefined = use global config)
  frameOverride?: FrameType;
  overlayOverride?: OverlayType;
  particlesOverride?: ParticleType;
};

export type ActTitle = {
  chapter: string;
  kr: string;
  variant?: TitleVariant; // overrides global titleVariant
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
  // NEW
  backgroundStyle: BackgroundStyle;
  kenBurnsAmount: number;
  titleVariant: TitleVariant;
  moments?: MomentCard[]; // "이때" interstitial cards inserted between photos
  yearMarkers?: YearMarker[]; // year / location title interstitials
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
  | { kind: "ending"; durationInFrames: number; name: string };

export function buildTimeline(
  photos: PhotoEntry[],
  titleCardFrames: number,
  endingFrames: number,
  fps: number,
  moments: MomentCard[] = [],
  yearMarkers: YearMarker[] = []
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

  let i = 0;
  while (i < photos.length) {
    const p = photos[i];

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
        durationInFrames: Math.round(4.0 * fps),
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
  const tl = buildTimeline(config.photos, tcf, ef, config.fps);

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
  const tl = buildTimeline(config.photos, tcf, ef, config.fps);

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
  const tl = buildTimeline(config.photos, tcf, ef, config.fps);
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
  extra?: Partial<Pick<PhotoEntry, "focalPoint" | "transition" | "filter" | "caption" | "spotlights" | "splitPair" | "splitStyle" | "frameOverride" | "overlayOverride" | "particlesOverride">>
): PhotoEntry => ({
  tag, act, file, durationSec, effect,
  focalPoint: { x: 0.5, y: 0.5 },
  transition: "fade",
  filter: "none",
  spotlights: [],
  ...extra,
});

const defaultPhotos: PhotoEntry[] = [
  // ── Act I: 각자의 자리에서 (6 splits + 1 interlude) ──────
  // Split pairs: 슬기(좌) / 예찬(우). 경복궁은 demote — 진짜 리빌은 Act II 분당선교원.
  P("슬기 성모병원",              1, `${S}/001.jpg`, D.split, "zoomIn",  { splitPair: true, splitStyle: "cameo" }),
  P("예찬 성모병원",              1, `${S}/002.jpg`, D.split, "zoomIn"),
  P("슬기 생일",                  1, `${S}/003.jpg`, D.split, "zoomOut", { splitPair: true, splitStyle: "polaroid" }),
  P("예찬 생일",                  1, `${S}/004.png`, D.split, "zoomOut"),
  P("슬기 아빠와",                1, `${S}/005.jpg`, D.split, "zoomIn",  { splitPair: true, splitStyle: "polaroid" }),
  P("예찬 아빠와",                1, `${S}/006.jpg`, D.split, "zoomIn"),
  P("슬기 장난기",                1, `${S}/007.jpg`, D.split, "panRight", { splitPair: true, splitStyle: "polaroid" }),
  P("예찬 장난기",                1, `${S}/008.jpg`, D.split, "panRight"),
  P("슬기 부엌",                  1, `${S}/009.jpg`, D.split, "zoomOut", { splitPair: true, splitStyle: "polaroid" }),
  P("예찬 부엌",                  1, `${S}/010.jpg`, D.split, "zoomOut"),
  P("슬기 그림",                  1, `${S}/011.jpg`, D.split, "zoomIn",  { splitPair: true, splitStyle: "polaroid" }),
  P("예찬 그림",                  1, `${S}/012.jpg`, D.split, "zoomIn"),
  P("경복궁",                    1, `${S}/013.jpg`, D.reveal, "zoomIn"),

  // ── Act II: 같은 곳에서, 함께 (13장) ──────────────────
  // ★ 분당선교원: 진짜 리빌 — 두 사람이 같은 공동체에 있었다 (스포트라이트 필수)
  P("★ 분당선교원 (같은 공동체)",   2, `${S}/014.jpeg`, D.growStar, "zoomIn"),
  P("분당선교원 2",               2, `${S}/015.jpeg`, D.growStar, "zoomIn"),
  P("★ 붉은악마 단체",             2, `${S}/016.jpeg`, D.growStar, "zoomIn"),
  P("슬기 붉은악마",              2, `${S}/017.jpeg`, D.grow, e(3), { splitPair: true, splitStyle: "polaroid" }),
  P("예찬 붉은악마",              2, `${S}/018.jpeg`, D.grow, e(3)),
  P("여름 단체사진",              2, `${S}/019.jpeg`, D.grow, e(4)),
  P("가을 단체사진",              2, `${S}/020.jpeg`, D.grow, e(5)),
  P("겨울 단체사진",              2, `${S}/021.jpeg`, D.grow, e(6)),
  P("서울 단체사진",              2, `${S}/022.jpeg`, D.grow, e(7)),
  P("영화관",                     2, `${S}/023.jpeg`, D.grow, e(8)),
  P("교회 기획실",                2, `${S}/024.jpeg`, D.grow, e(9)),
  P("스키장",                     2, `${S}/025.jpeg`, D.grow, e(10)),
  P("고등학교 졸업식",            2, `${S}/026.jpeg`, D.grow, e(11)),
  P("침례식",                     2, `${S}/027.jpeg`, D.grow, e(12)),

  // ── Act III: 우리의 시간 (18장: 여행+공연+갤러리+뉴욕) ─
  P("여행 식사 1",                3, `${S}/028.jpeg`, D.trip, e(0)),
  P("여행 식사 2",                3, `${S}/029.jpeg`, D.trip, e(1)),
  P("여행 단체 1",                3, `${S}/030.jpeg`, D.trip, e(2)),
  P("여행 단체 2",                3, `${S}/031.jpeg`, D.trip, e(3)),
  P("여행 단체 3",                3, `${S}/032.jpeg`, D.trip, e(4)),
  P("여행 단체 4",                3, `${S}/033.jpeg`, D.trip, e(5)),
  P("★ 결혼식 공연 1",             3, `${S}/034.jpeg`, D.trip2, e(6)),
  P("결혼식 공연 2",              3, `${S}/035.jpeg`, D.trip2, e(7)),
  P("결혼식 공연 3",              3, `${S}/036.jpeg`, D.trip2, e(8)),
  P("결혼식 공연 4",              3, `${S}/037.jpeg`, D.trip2, e(9)),
  P("갤러리 전시 1",              3, `${S}/038.jpeg`, D.date, "zoomIn"),
  P("갤러리 전시 2",              3, `${S}/039.jpeg`, D.date, "zoomOut"),
  P("갤러리 전시 3",              3, `${S}/040.jpeg`, D.date, "panRight"),
  P("갤러리 전시 4",              3, `${S}/041.jpeg`, D.date, "zoomIn"),
  P("뉴욕 1",                     3, `${S}/042.png`,  D.date, "zoomIn"),
  P("뉴욕 2",                     3, `${S}/043.png`,  D.date, "panLeft"),
  P("뉴욕 3",                     3, `${S}/044.jpg`,  D.date, "zoomOut"),
  P("뉴욕 4",                     3, `${S}/045.png`,  D.date, "zoomIn"),

  // ── Act IV: 함께 걸어온 시간 (6장: 군입대+졸업) ────────
  P("예찬 군입대",                4, `${S}/046.jpg`,  D.mile, "zoomIn"),
  P("예찬 군입대 2",              4, `${S}/047.png`,  D.mile, "zoomOut"),
  P("예찬 군입대 3",              4, `${S}/048.jpeg`, D.mile, "panRight"),
  P("예찬 군입대 4",              4, `${S}/049.jpeg`, D.mile, "zoomIn"),
  P("슬기 졸업",                  4, `${S}/050.jpeg`, D.mile, "zoomIn"),
  P("예찬 졸업식",                4, `${S}/051.jpg`,  D.mile, "zoomOut"),

  // ── Act V: 그리고, 오늘 (9장: 두 사람+마지막) ─────────
  P("두 사람 1",                  5, `${S}/052.jpg`, D.us, "zoomIn"),
  P("두 사람 2",                  5, `${S}/053.jpg`, D.us, "zoomOut"),
  P("두 사람 3",                  5, `${S}/054.jpg`, D.us, "panRight"),
  P("두 사람 4",                  5, `${S}/055.png`, D.us, "zoomIn"),
  P("두 사람 5",                  5, `${S}/056.jpg`, D.us, "panLeft"),
  P("두 사람 6",                  5, `${S}/057.jpg`, D.us, "zoomOut"),
  P("두 사람 7",                  5, `${S}/058.jpg`, D.us, "zoomIn"),
  P("두 사람 8",                  5, `${S}/059.jpg`, D.us, "zoomOut"),
  P("★ 마지막",                   5, `${S}/060.jpg`, D.last, "zoomIn"),
];

const defaultActTitles: Record<number, ActTitle> = {
  1: { chapter: "Act I", kr: "각자의 자리에서" },
  2: { chapter: "Act II", kr: "같은 곳에서, 함께" },
  3: { chapter: "Act III", kr: "우리의 시간" },
  4: { chapter: "Act IV", kr: "함께 걸어온 시간" },
  5: { chapter: "Act V · 2026", kr: "그리고, 오늘" },
};

export const defaultConfig: VideoConfig = {
  photos: defaultPhotos,
  actTitles: defaultActTitles,
  ending: {
    date: "2026 · 05 · 05",
    groomName: "이예찬",
    brideName: "송슬기",
    message: "와주셔서 감사합니다",
  },
  titleCardSec: 4.0,   // slightly longer for breathing
  endingSec: 10.0,     // longer emotional close
  crossfadeSec: 0.6,
  fps: 30,
  overlay: "none",
  particles: "none",
  frame: "none",
  backgroundStyle: "paper",  // NEW — cream paper (vintage journal feel)
  kenBurnsAmount: 0.04,      // NEW — half of previous 0.08 (calmer)
  titleVariant: "journal",   // NEW — elegant journal style for all acts
  moments: [                 // NEW — "이때" interstitial cards from Claude Design P0-2
    { id: "m1", afterPhotoIndex: 12, l1: "그해 여름", l2: "우리는 같은 교회에 있었다", year: "2010", durationSec: 2.0 },
    { id: "m2", afterPhotoIndex: 14, l1: "2002년, 붉은 광장에서", l2: "우리는 같은 팀이었다", year: "2002", durationSec: 2.0 },
  ],
  yearMarkers: [             // NEW — 연도 타임스탬프 카드 (P1-2)
    // 여행/뉴욕 사진 직전 — Act III 후반 시작점
    { id: "y1", afterPhotoIndex: 41, year: "2020", location: "뉴욕", durationSec: 3.0 },
  ],
};
