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

    // Act 1 first 4 photos → 2 split scenes
    if (p.act === 1 && i === 0 && photos.length >= 4) {
      items.push({
        kind: "split",
        left: photos[0],
        right: photos[2],
        durationInFrames: Math.round(4.0 * fps),
        mergeOut: false,
        name: "Act 1 — Split 1",
      });
      items.push({
        kind: "split",
        left: photos[1],
        right: photos[3],
        durationInFrames: Math.round(4.0 * fps),
        mergeOut: true,
        name: "Act 1 — Split 2 → merge",
      });
      i = 4;
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
  slow: 4.0,   // Act I opening
  mid: 3.0,    // Act II growing up
  school: 2.5, // Act II school
  youth: 2.5,  // Act III youth
  beat: 0.8,   // Act III christmas beat-cuts
  couple: 3.0, // Act IV couple
  mile: 3.2,   // Act IV milestones
  end: 3.5,    // Act V prewedding
};

const fx: Effect[] = ["zoomIn", "panRight", "zoomOut", "panLeft"];
const e = (i: number): Effect => fx[i % fx.length];

// Helper to create photo entries with sensible defaults
const P = (
  tag: string, act: number, file: string, durationSec: number, effect: Effect,
  extra?: Partial<Pick<PhotoEntry, "focalPoint" | "transition" | "filter" | "caption" | "spotlights">>
): PhotoEntry => ({
  tag, act, file, durationSec, effect,
  focalPoint: { x: 0.5, y: 0.5 },
  transition: "fade",
  filter: "none",
  spotlights: [],
  ...extra,
});

const defaultPhotos: PhotoEntry[] = [
  // ── Act 1: 각자의 자리에서 (6장) ─────────────
  P("어항 앞 어린 신랑",         1, "photos/001.jpeg", D.slow, "zoomIn"),
  P("Be The Reds 신랑",          1, "photos/002.jpeg", D.slow, "zoomOut"),
  P("책상 앞 어린 신부",         1, "photos/003.jpeg", D.slow, "zoomIn"),
  P("태극기 얼굴 COREA 신부",    1, "photos/004.jpeg", D.slow, "zoomOut"),
  P("★ 어린시절 고궁 (두 아이)", 1, "photos/005.jpg",  5.0,    "zoomIn"),
  P("★ 어린시절 생일파티",       1, "photos/006.png",  5.0,    "zoomIn"),

  // ── Act 2: 함께 자란 시간 (18장: 교회+캠프+학창) ──
  P("1999년 유치부 단체",        2, "photos/007.jpeg", D.mid,    e(0)),
  P("주일학교 1",                2, "photos/008.jpeg", D.mid,    e(1)),
  P("주일학교 2",                2, "photos/009.jpeg", D.mid,    e(2)),
  P("붉은악마 교회 행사",        2, "photos/010.jpeg", D.mid,    e(3)),
  P("빨간티 어린이 단체 (북)",   2, "photos/011.jpeg", D.mid,    e(4)),
  P("눈밭 어린이",               2, "photos/012.jpeg", D.mid,    e(5)),
  P("교회 실내 활동",            2, "photos/013.jpeg", D.mid,    e(6)),
  P("어린이 생일파티 케이크",    2, "photos/014.jpeg", D.mid,    e(7)),
  P("교회 합창",                 2, "photos/015.jpeg", D.mid,    e(8)),
  P("어른 선물 받는 장면",       2, "photos/016.jpeg", D.mid,    e(9)),
  P("버스 앞 여름캠프",          2, "photos/017.jpeg", D.mid,    e(10)),
  P("시골길 Y자 포즈",           2, "photos/018.jpeg", D.mid,    e(11)),
  P("가을 공원 단체",            2, "photos/019.jpeg", D.mid,    e(12)),
  P("청소년 꽃다발 (교회 무대)", 2, "photos/020.jpeg", D.school, e(13)),
  P("교실 5인 꽃다발",           2, "photos/021.jpeg", D.school, e(14)),
  P("교실 선생+학생 단체",       2, "photos/022.jpeg", D.school, e(15)),
  P("영화관 3D 안경",            2, "photos/023.jpeg", D.school, e(16)),
  P("지하철 통로 단체",          2, "photos/024.jpeg", D.school, e(17)),

  // ── Act 3: 청년, 그리고 그 해 겨울 (19장: 청년부+크리스마스) ──
  P("사무실 2인",                3, "photos/025.jpeg", D.youth, e(0)),
  P("청년부 예배당 1",           3, "photos/026.jpeg", D.youth, e(1)),
  P("청년부 예배당 2",           3, "photos/027.jpeg", D.youth, e(2)),
  P("스키장 밤 (세로)",          3, "photos/028.jpeg", D.youth, e(3)),
  P("스키장 밤 (가로)",          3, "photos/029.jpeg", D.youth, e(4)),
  P("대나무숲 셀카",             3, "photos/030.jpeg", D.youth, e(5)),
  P("갈대밭 셀카",               3, "photos/031.jpeg", D.youth, e(6)),
  P("청년부 셀카",               3, "photos/032.jpeg", D.youth, e(7)),
  P("해변 단체",                 3, "photos/033.jpeg", D.youth, e(8)),
  P("녹차밭 3인",                3, "photos/034.jpeg", D.youth, e(9)),
  P("긴 식당 단체",              3, "photos/035.jpeg", D.youth, e(10)),
  P("고기집 9인",                3, "photos/036.jpeg", D.youth, e(11)),
  P("★ 크리스마스 오프닝",       3, "photos/037.jpeg", D.beat,  "static"),
  P("★ 크리스마스 하트",         3, "photos/038.jpeg", D.beat,  "static"),
  P("★ 크리스마스 춤 1",         3, "photos/039.jpeg", D.beat,  "static"),
  P("★ 크리스마스 춤 2",         3, "photos/040.jpeg", D.beat,  "static"),
  P("★ 크리스마스 사슴뿔",       3, "photos/041.jpeg", D.beat,  "static"),
  P("★ 크리스마스 4인 춤 1",     3, "photos/042.jpeg", D.beat,  "static"),
  P("★ 크리스마스 4인 춤 2",     3, "photos/043.jpeg", D.beat,  "static", { transition: "iris" }),

  // ── Act 4: 둘이 만나다 (16장: 커플+졸업+입대) ──
  P("미술관 커플 1",             4, "photos/044.jpeg", D.couple, "zoomIn"),
  P("미술관 커플 2",             4, "photos/045.jpeg", D.couple, "zoomOut"),
  P("미술관 커플 3 (뒷모습)",    4, "photos/046.jpeg", D.couple, "panRight"),
  P("미술관 커플 4",             4, "photos/047.jpeg", D.couple, "zoomIn"),
  P("초기 일상 셀카",            4, "photos/048.png",  D.couple, "zoomOut"),
  P("Shake Shack 셀카",          4, "photos/049.png",  D.couple, "zoomIn"),
  P("테니스 경기장 (NY)",        4, "photos/050.jpg",  D.couple, "panLeft"),
  P("브루클린 브릿지 (NY)",      4, "photos/051.png",  D.couple, "zoomIn"),
  P("졸업식 커플 (신부 학사모)", 4, "photos/052.jpeg", D.mile,   "zoomIn"),
  P("서울대 졸업 가족 (신랑)",   4, "photos/053.jpg",  D.mile,   "zoomIn"),
  P("신랑 부모님과",             4, "photos/054.jpg",  D.mile,   "zoomIn"),
  P("머리 자르고 난 뒤 (입대전)",4, "photos/055.jpg",  D.mile,   "zoomIn"),
  P("군대 면회 벚꽃 1",          4, "photos/056.png",  D.mile,   "zoomOut"),
  P("군대 면회 벚꽃 2",          4, "photos/057.jpeg", D.mile,   "zoomIn"),
  P("군부대 가족·친구",          4, "photos/058.jpeg", D.mile,   "panRight"),
  P("군부대 대화",               4, "photos/059.jpeg", D.mile,   "zoomIn"),

  // ── Act 5: 그리고, 오늘 (7장: 프리웨딩+엔딩) ──
  P("신발 디테일 (필러)",        5, "photos/060.jpg",  2.0,    "zoomIn"),
  P("프리웨딩 소나무숲 1",       5, "photos/061.png",  D.end,  "zoomIn"),
  P("프리웨딩 테이블",           5, "photos/062.jpg",  D.end,  "panRight"),
  P("프리웨딩 포즈",             5, "photos/063.jpg",  D.end,  "zoomIn"),
  P("벚꽃 앞 커플",              5, "photos/064.jpg",  D.end,  "zoomOut"),
  P("흰 터널 커플",              5, "photos/065.jpg",  D.end,  "zoomIn"),
  P("엔딩: 꽃 받치는 포즈",      5, "photos/066.jpg",  5.0,    "zoomIn"),
];

const defaultActTitles: Record<number, ActTitle> = {
  1: { chapter: "Act I", kr: "각자의 자리에서" },
  2: { chapter: "Act II · 1999", kr: "함께 자란 시간" },
  3: { chapter: "Act III · Christmas", kr: "청년, 그리고 그 해 겨울" },
  4: { chapter: "Act IV", kr: "둘이 만나다" },
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
