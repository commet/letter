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
};

export type ActTitle = {
  chapter: string;
  kr: string;
};

export type EndingConfig = {
  date: string;
  groomName: string;
  brideName: string;
  message: string;
};

export type VideoConfig = {
  photos: PhotoEntry[];
  actTitles: Record<number, ActTitle>;
  ending: EndingConfig;
  titleCardSec: number;
  endingSec: number;
  crossfadeSec: number;
  fps: number;
};

// ─────────────────────────────────────────────
// Timeline types & builder
// ─────────────────────────────────────────────

export type TransitionMode = "fade" | "iris-in" | "iris-out" | "slide-left" | "slide-right" | "wipe-down" | "none";

export type TimelineItem =
  | { kind: "titleCard"; act: number; durationInFrames: number; name: string }
  | { kind: "photo"; photo: PhotoEntry; durationInFrames: number; enterTransition: TransitionMode; exitTransition: TransitionMode; name: string }
  | { kind: "split"; left: PhotoEntry; right: PhotoEntry; durationInFrames: number; mergeOut: boolean; name: string }
  | { kind: "ending"; durationInFrames: number; name: string };

export function buildTimeline(
  photos: PhotoEntry[],
  titleCardFrames: number,
  endingFrames: number,
  fps: number
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const seenActs = new Set<number>();

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
  split: 4.0,  // Act I split screen pairs
  reveal: 5.0, // Act I reveal photo
  grow: 3.0,   // Act II growing up
  trip: 2.8,   // Act III trips
  beat: 0.8,   // Act III performance beat-cuts
  date: 3.0,   // Act III/IV couple dates
  mile: 3.2,   // Act IV milestones
  us: 3.5,     // Act V the two of us
  last: 5.0,   // Act V ending photo
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
  extra?: Partial<Pick<PhotoEntry, "focalPoint" | "transition" | "filter" | "caption" | "spotlights" | "splitPair">>
): PhotoEntry => ({
  tag, act, file, durationSec, effect,
  focalPoint: { x: 0.5, y: 0.5 },
  transition: "fade",
  filter: "none",
  spotlights: [],
  ...extra,
});

const defaultPhotos: PhotoEntry[] = [
  // ── Act I: 각자의 자리에서 (6 splits + 1 reveal) ──────
  // Split pairs: 슬기(좌) / 예찬(우) → 마지막 split mergeOut → 경복궁 reveal
  P("슬기 성모병원",              1, `${S}/001.jpg`, D.split, "zoomIn",  { splitPair: true }),
  P("예찬 성모병원",              1, `${S}/002.jpg`, D.split, "zoomIn"),
  P("슬기 생일",                  1, `${S}/003.jpg`, D.split, "zoomOut", { splitPair: true }),
  P("예찬 생일",                  1, `${S}/004.png`, D.split, "zoomOut"),
  P("슬기 아빠와",                1, `${S}/005.jpg`, D.split, "zoomIn",  { splitPair: true }),
  P("예찬 아빠와",                1, `${S}/006.jpg`, D.split, "zoomIn"),
  P("슬기 장난기",                1, `${S}/007.jpg`, D.split, "panRight", { splitPair: true }),
  P("예찬 장난기",                1, `${S}/008.jpg`, D.split, "panRight"),
  P("슬기 부엌",                  1, `${S}/009.jpg`, D.split, "zoomOut", { splitPair: true }),
  P("예찬 부엌",                  1, `${S}/010.jpg`, D.split, "zoomOut"),
  P("슬기 그림",                  1, `${S}/011.jpg`, D.split, "zoomIn",  { splitPair: true }),
  P("예찬 그림",                  1, `${S}/012.jpg`, D.split, "zoomIn"),
  P("★ 경복궁 (같은 곳에서)",    1, `${S}/013.jpg`, D.reveal, "zoomIn"),

  // ── Act II: 같은 곳에서, 함께 (13장) ──────────────────
  P("분당선교원",                 2, `${S}/014.jpeg`, D.grow, e(0)),
  P("분당선교원 2",               2, `${S}/015.jpeg`, D.grow, e(1)),
  P("붉은악마 단체",              2, `${S}/016.jpeg`, D.grow, e(2)),
  P("슬기 붉은악마",              2, `${S}/017.jpeg`, D.grow, e(3), { splitPair: true }),
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
  P("결혼식 공연 1",              3, `${S}/034.jpeg`, D.trip, e(6)),
  P("결혼식 공연 2",              3, `${S}/035.jpeg`, D.trip, e(7)),
  P("결혼식 공연 3",              3, `${S}/036.jpeg`, D.trip, e(8)),
  P("결혼식 공연 4",              3, `${S}/037.jpeg`, D.trip, e(9)),
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
  P("마지막",                     5, `${S}/060.jpg`, D.last, "zoomIn"),
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
    date: "2026 · XX · XX",
    groomName: "신랑 ○○",
    brideName: "신부 ○○",
    message: "와주셔서 감사합니다",
  },
  titleCardSec: 3.2,
  endingSec: 6.5,
  crossfadeSec: 0.5,
  fps: 30,
};
