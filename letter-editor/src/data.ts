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
  journeyMaps?: JourneyMap[]; // animated journey map scenes
  letterInterludes?: LetterInterlude[]; // handwritten letter scenes
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
  collages: Collage[] = []
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
    // Collages
    const collagesHere = collagesBefore.get(i);
    if (collagesHere) {
      for (const c of collagesHere) {
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
  const tl = buildTimeline(
    config.photos, tcf, ef, config.fps,
    config.moments ?? [],
    config.yearMarkers ?? [],
    config.journeyMaps ?? [],
    config.letterInterludes ?? [],
    config.collages ?? [],
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
  // ── Act I — 그때의 우리 (유년기 페어 6쌍) ──────
  // 슬기(좌, 1988) · 예찬(우, 1993). 성모병원 출생 동일, 5살 차이.
  P("슬기 성모병원",              1, `${S}/001.jpg`, D.split, "zoomIn",  { splitPair: true, splitStyle: "cameo", eraIcon: "teddy-bear" }),
  P("예찬 성모병원",              1, `${S}/002.jpg`, D.split, "zoomIn", { eraIcon: "teddy-bear" }),
  P("슬기 생일",                  1, `${S}/003.jpg`, D.split, "zoomOut", { splitPair: true, splitStyle: "polaroid", eraIcon: "birthday-cake" }),
  P("예찬 생일",                  1, `${S}/004.png`, D.split, "zoomOut", { eraIcon: "birthday-cake" }),
  P("슬기 아빠와",                1, `${S}/005.jpg`, D.split, "zoomIn",  { splitPair: true, splitStyle: "polaroid", eraIcon: "rocking-horse" }),
  P("예찬 아빠와",                1, `${S}/006.jpg`, D.split, "zoomIn",  { eraIcon: "rocking-horse" }),
  P("슬기 장난기",                1, `${S}/007.jpg`, D.split, "panRight", { splitPair: true, splitStyle: "polaroid", eraIcon: "crayon" }),
  P("예찬 장난기",                1, `${S}/008.jpg`, D.split, "panRight", { eraIcon: "crayon" }),
  P("슬기 부엌",                  1, `${S}/009.jpg`, D.split, "zoomOut", { splitPair: true, splitStyle: "polaroid", eraIcon: "school-backpack" }),
  P("예찬 부엌",                  1, `${S}/010.jpg`, D.split, "zoomOut", { eraIcon: "school-backpack" }),
  P("슬기 그림",                  1, `${S}/011.jpg`, D.split, "zoomIn",  { splitPair: true, splitStyle: "polaroid", eraIcon: "crayon" }),
  P("예찬 그림",                  1, `${S}/012.jpg`, D.split, "zoomIn",  { eraIcon: "crayon" }),

  // ── Act II — 같은 마당 (1994~ 분당교회 공동체) ──────
  // ★ 분당선교원 단체 — 같은 공동체에서 자라온 배경
  P("★ 분당선교원 단체",           2, `${S}/014.jpeg`, D.growStar, "zoomIn",  { eraIcon: "church-steeple" }),
  P("분당선교원 2",               2, `${S}/015.jpeg`, D.growStar, "zoomIn",  { eraIcon: "hymn-book" }),
  P("여름 단체사진",              2, `${S}/019.jpeg`, D.grow, e(4), { eraIcon: "church-steeple" }),
  P("가을 단체사진",              2, `${S}/020.jpeg`, D.grow, e(5), { eraIcon: "hymn-book" }),
  P("겨울 단체사진",              2, `${S}/021.jpeg`, D.grow, e(6), { eraIcon: "church-steeple" }),
  P("서울 단체사진",              2, `${S}/022.jpeg`, D.grow, e(7), { eraIcon: "hymn-book" }),
  P("붉은악마 단체",              2, `${S}/016.jpeg`, D.grow, "zoomIn",  { eraIcon: "soccer-ball" }),  // 평범한 단체사진으로 demote
  P("영화관",                     2, `${S}/023.jpeg`, D.grow, e(8), { eraIcon: "concert-ticket" }),
  P("교회 기획실",                2, `${S}/024.jpeg`, D.grow, e(9), { eraIcon: "hymn-book" }),
  P("스키장",                     2, `${S}/025.jpeg`, D.grow, e(10), { eraIcon: "umbrella" }),
  P("고등학교 졸업식",            2, `${S}/026.jpeg`, D.grow, e(11), { eraIcon: "grad-cap" }),
  P("침례식",                     2, `${S}/027.jpeg`, D.grow, e(12), { eraIcon: "stained-glass" }),

  // ── Act III — 함께 걸은 봄 (한국 청년기, ~2015 슬기 학사 졸업 전) ──────
  // 여행, 공연 4장 (군입대·뉴욕 시기 이전), 갤러리 전시 (국내)
  P("여행 식사 1",                3, `${S}/028.jpeg`, D.trip, e(0), { eraIcon: "two-cups" }),
  P("여행 식사 2",                3, `${S}/029.jpeg`, D.trip, e(1), { eraIcon: "two-cups" }),
  P("여행 단체 1",                3, `${S}/030.jpeg`, D.trip, e(2), { eraIcon: "suitcase" }),
  P("여행 단체 2",                3, `${S}/031.jpeg`, D.trip, e(3), { eraIcon: "suitcase" }),
  P("여행 단체 3",                3, `${S}/032.jpeg`, D.trip, e(4), { eraIcon: "suitcase" }),
  P("여행 단체 4",                3, `${S}/033.jpeg`, D.trip, e(5), { eraIcon: "suitcase" }),
  P("공연 1",                    3, `${S}/034.jpeg`, D.trip2, e(6), { eraIcon: "concert-ticket" }),
  P("공연 2",                    3, `${S}/035.jpeg`, D.trip2, e(7), { eraIcon: "concert-ticket" }),
  P("공연 3",                    3, `${S}/036.jpeg`, D.trip2, e(8), { eraIcon: "concert-ticket" }),
  P("공연 4",                    3, `${S}/037.jpeg`, D.trip2, e(9), { eraIcon: "concert-ticket" }),
  P("갤러리 전시 1",              3, `${S}/038.jpeg`, D.date, "zoomIn",  { eraIcon: "gallery-frame" }),
  P("갤러리 전시 2",              3, `${S}/039.jpeg`, D.date, "zoomOut", { eraIcon: "gallery-frame" }),
  P("갤러리 전시 3",              3, `${S}/040.jpeg`, D.date, "panRight", { eraIcon: "gallery-frame" }),
  P("갤러리 전시 4",              3, `${S}/041.jpeg`, D.date, "zoomIn",  { eraIcon: "gallery-frame" }),
  P("슬기 학사 졸업",              3, `${S}/050.jpeg`, D.mile, "zoomIn",  { eraIcon: "grad-cap" }),

  // ── Act IV — 바다를 사이에 두고 (2016~, 거리의 시간) ──────
  // 예찬 군입대 → 슬기 뉴욕 유학 → 예찬 제대 → 뉴욕 방문
  P("예찬 군입대",                4, `${S}/046.jpg`,  D.mile, "zoomIn",  { eraIcon: "military-hat" }),
  P("예찬 군입대 2",              4, `${S}/047.png`,  D.mile, "zoomOut", { eraIcon: "military-hat" }),
  P("예찬 군입대 3",              4, `${S}/048.jpeg`, D.mile, "panRight", { eraIcon: "military-hat" }),
  P("예찬 군입대 4",              4, `${S}/049.jpeg`, D.mile, "zoomIn",  { eraIcon: "military-hat" }),
  P("뉴욕 1",                     4, `${S}/042.png`,  D.date, "zoomIn",  { eraIcon: "nyc-skyline" }),
  P("뉴욕 2",                     4, `${S}/043.png`,  D.date, "panLeft", { eraIcon: "nyc-skyline" }),
  P("뉴욕 3",                     4, `${S}/044.jpg`,  D.date, "zoomOut", { eraIcon: "nyc-skyline" }),
  P("뉴욕 4",                     4, `${S}/045.png`,  D.date, "zoomIn",  { eraIcon: "subway-map" }),
  P("예찬 졸업식",                4, `${S}/051.jpg`,  D.mile, "zoomOut", { eraIcon: "diploma" }),

  // ── Act V — 그리고, 오늘 (2026, 재회·연인·결혼) ──────
  P("두 사람 1",                  5, `${S}/052.jpg`, D.us, "zoomIn", { eraIcon: "two-cups" }),
  P("두 사람 2",                  5, `${S}/053.jpg`, D.us, "zoomOut", { eraIcon: "two-cups" }),
  P("두 사람 3",                  5, `${S}/054.jpg`, D.us, "panRight", { eraIcon: "open-window" }),
  P("두 사람 4",                  5, `${S}/055.png`, D.us, "zoomIn", { eraIcon: "open-window" }),
  P("두 사람 5",                  5, `${S}/056.jpg`, D.us, "panLeft", { eraIcon: "bouquet" }),
  P("두 사람 6",                  5, `${S}/057.jpg`, D.us, "zoomOut", { eraIcon: "bouquet" }),
  P("두 사람 7",                  5, `${S}/058.jpg`, D.us, "zoomIn", { eraIcon: "ring-box" }),
  P("두 사람 8",                  5, `${S}/059.jpg`, D.us, "zoomOut", { eraIcon: "ring-box" }),
  P("★ 경복궁 (함께)",             5, `${S}/013.jpg`, D.reveal, "zoomIn", { eraIcon: "linked-rings" }),
  P("★ 마지막",                   5, `${S}/060.jpg`, D.last, "zoomIn", { eraIcon: "linked-rings" }),
];

const defaultActTitles: Record<number, ActTitle> = {
  1: { chapter: "Act I",  kr: "그때의 우리" },
  2: { chapter: "Act II", kr: "같은 마당" },
  3: { chapter: "Act III", kr: "함께 걸은 봄" },
  4: { chapter: "Act IV", kr: "바다를 사이에 두고" },
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
  // ── 인터스티셜 배치 (실제 스토리 기반) ──
  // photos 인덱스: Act I 0-11, Act II 12-23, Act III 24-38, Act IV 39-47, Act V 48-57
  moments: [
    // Act II 시작 (같은 마당) — 잔잔한 여는 말
    { id: "m-2", afterPhotoIndex: 11, l1: "같은 마당에서",  l2: "함께 자란 날들", year: "1994 ~", durationSec: 2.2 },
    // Act V 시작 (2026 재회) — 핵심 리빌
    { id: "m-5", afterPhotoIndex: 47, l1: "다시, 여기서", l2: "우리가 되었다", year: "2026 · 봄", durationSec: 2.5 },
  ],
  yearMarkers: [
    // Act IV 시작 (거리의 시간)
    { id: "y-4", afterPhotoIndex: 38, year: "2016", location: "서울 ↔ 뉴욕", durationSec: 3.0 },
  ],
  journeyMaps: [
    // Act IV 뉴욕 파트 직전 — 성모병원 → 분당 → 서울 → 뉴욕 시각화
    { id: "jm-nyc", afterPhotoIndex: 42,
      title: "Across the Ocean",
      subtitle: "성모병원 · 분당 · 서울 · 뉴욕",
      caption: "계절이 몇 번, 그래도 서로에게",
      durationSec: 8.0,
    },
  ],
  letterInterludes: [],      // 의도적으로 비움 — 편지 인터루드는 스토리에 맞지 않음
  collages: [],              // 기본 0개. 에디터에서 추가 가능
};
