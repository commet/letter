// Single source of truth for the wedding pre-ceremony video.
// Photo order matches the act structure below. Edit durations/effects here
// and the preview hot-reloads instantly.
//
// Act map:
//   1  각자의 처음 → 같은 자리 (솔로 + 어린시절 두 가족 reveal)
//   2  교회 유년기
//   3  어린이 캠프·행사
//   4  학창 시절
//   5  청년부
//   6  크리스마스 공연 (클라이맥스: 빠른 컷)
//   7  둘이 만나다
//   8  함께 걸어온 시간 (졸업·입대·가족)
//   9  지금의 우리 → 결혼 (프리웨딩, 엔딩)

export type Effect =
  | "zoomIn"
  | "zoomOut"
  | "panLeft"
  | "panRight"
  | "static";

export type PhotoEntry = {
  tag: string;
  act: number;
  file: string; // relative to public/, matches scripts/copy-photos.mjs output
  durationSec: number;
  effect: Effect;
};

// Default durations per act (seconds). Act 6 is deliberately very short
// because it's the beat-cut climax.
const D = {
  act1: 4.0,
  act2: 3.0,
  act3: 3.0,
  act4: 2.5,
  act5: 2.5,
  act6: 0.8,
  act7: 3.0,
  act8: 3.2,
  act9: 3.5,
};

// Rotate through effects so adjacent photos feel different.
const fx: Effect[] = ["zoomIn", "panRight", "zoomOut", "panLeft"];
const e = (i: number): Effect => fx[i % fx.length];

export const photos: PhotoEntry[] = [
  // ── Act 1: 각자의 처음 → 같은 자리 ───────────────────────
  { tag: "어항 앞 어린 신랑",         act: 1, file: "photos/001.jpeg", durationSec: D.act1, effect: "zoomIn" },
  { tag: "Be The Reds 신랑",          act: 1, file: "photos/002.jpeg", durationSec: D.act1, effect: "zoomOut" },
  { tag: "책상 앞 어린 신부",         act: 1, file: "photos/003.jpeg", durationSec: D.act1, effect: "zoomIn" },
  { tag: "태극기 얼굴 COREA 신부",    act: 1, file: "photos/004.jpeg", durationSec: D.act1, effect: "zoomOut" },
  { tag: "★ 어린시절 고궁 (두 아이)", act: 1, file: "photos/005.jpg",  durationSec: 5.0,    effect: "zoomIn" },
  { tag: "★ 어린시절 생일파티",       act: 1, file: "photos/006.png",  durationSec: 5.0,    effect: "zoomIn" },

  // ── Act 2: 교회 유년기 ────────────────────────────────
  { tag: "1999년 유치부 단체",        act: 2, file: "photos/007.jpeg", durationSec: D.act2, effect: e(0) },
  { tag: "주일학교 1",                act: 2, file: "photos/008.jpeg", durationSec: D.act2, effect: e(1) },
  { tag: "주일학교 2",                act: 2, file: "photos/009.jpeg", durationSec: D.act2, effect: e(2) },
  { tag: "붉은악마 교회 행사",        act: 2, file: "photos/010.jpeg", durationSec: D.act2, effect: e(3) },
  { tag: "빨간티 어린이 단체 (북)",   act: 2, file: "photos/011.jpeg", durationSec: D.act2, effect: e(4) },
  { tag: "눈밭 어린이",               act: 2, file: "photos/012.jpeg", durationSec: D.act2, effect: e(5) },
  { tag: "교회 실내 활동",            act: 2, file: "photos/013.jpeg", durationSec: D.act2, effect: e(6) },
  { tag: "어린이 생일파티 케이크",    act: 2, file: "photos/014.jpeg", durationSec: D.act2, effect: e(7) },
  { tag: "교회 합창",                 act: 2, file: "photos/015.jpeg", durationSec: D.act2, effect: e(8) },
  { tag: "어른 선물 받는 장면",       act: 2, file: "photos/016.jpeg", durationSec: D.act2, effect: e(9) },

  // ── Act 3: 캠프·행사 ──────────────────────────────────
  { tag: "버스 앞 여름캠프",          act: 3, file: "photos/017.jpeg", durationSec: D.act3, effect: e(0) },
  { tag: "시골길 Y자 포즈",           act: 3, file: "photos/018.jpeg", durationSec: D.act3, effect: e(1) },
  { tag: "가을 공원 단체",            act: 3, file: "photos/019.jpeg", durationSec: D.act3, effect: e(2) },

  // ── Act 4: 학창 시절 ──────────────────────────────────
  { tag: "청소년 꽃다발 (교회 무대)", act: 4, file: "photos/020.jpeg", durationSec: D.act4, effect: e(0) },
  { tag: "교실 5인 꽃다발",           act: 4, file: "photos/021.jpeg", durationSec: D.act4, effect: e(1) },
  { tag: "교실 선생+학생 단체",       act: 4, file: "photos/022.jpeg", durationSec: D.act4, effect: e(2) },
  { tag: "영화관 3D 안경",            act: 4, file: "photos/023.jpeg", durationSec: D.act4, effect: e(3) },
  { tag: "지하철 통로 단체",          act: 4, file: "photos/024.jpeg", durationSec: D.act4, effect: e(4) },

  // ── Act 5: 청년부 ─────────────────────────────────────
  { tag: "사무실 2인",                act: 5, file: "photos/025.jpeg", durationSec: D.act5, effect: e(0) },
  { tag: "청년부 예배당 1",           act: 5, file: "photos/026.jpeg", durationSec: D.act5, effect: e(1) },
  { tag: "청년부 예배당 2",           act: 5, file: "photos/027.jpeg", durationSec: D.act5, effect: e(2) },
  { tag: "스키장 밤 (세로)",          act: 5, file: "photos/028.jpeg", durationSec: D.act5, effect: e(3) },
  { tag: "스키장 밤 (가로)",          act: 5, file: "photos/029.jpeg", durationSec: D.act5, effect: e(4) },
  { tag: "대나무숲 셀카",             act: 5, file: "photos/030.jpeg", durationSec: D.act5, effect: e(5) },
  { tag: "갈대밭 셀카",               act: 5, file: "photos/031.jpeg", durationSec: D.act5, effect: e(6) },
  { tag: "청년부 셀카",               act: 5, file: "photos/032.jpeg", durationSec: D.act5, effect: e(7) },
  { tag: "해변 단체",                 act: 5, file: "photos/033.jpeg", durationSec: D.act5, effect: e(8) },
  { tag: "녹차밭 3인",                act: 5, file: "photos/034.jpeg", durationSec: D.act5, effect: e(9) },
  { tag: "긴 식당 단체",              act: 5, file: "photos/035.jpeg", durationSec: D.act5, effect: e(10) },
  { tag: "고기집 9인",                act: 5, file: "photos/036.jpeg", durationSec: D.act5, effect: e(11) },

  // ── Act 6: 크리스마스 공연 (클라이맥스: 빠른 컷) ──────
  { tag: "★ 크리스마스 오프닝",       act: 6, file: "photos/037.jpeg", durationSec: D.act6, effect: "static" },
  { tag: "★ 크리스마스 하트",         act: 6, file: "photos/038.jpeg", durationSec: D.act6, effect: "static" },
  { tag: "★ 크리스마스 춤 1",         act: 6, file: "photos/039.jpeg", durationSec: D.act6, effect: "static" },
  { tag: "★ 크리스마스 춤 2",         act: 6, file: "photos/040.jpeg", durationSec: D.act6, effect: "static" },
  { tag: "★ 크리스마스 사슴뿔",       act: 6, file: "photos/041.jpeg", durationSec: D.act6, effect: "static" },
  { tag: "★ 크리스마스 4인 춤 1",     act: 6, file: "photos/042.jpeg", durationSec: D.act6, effect: "static" },
  { tag: "★ 크리스마스 4인 춤 2",     act: 6, file: "photos/043.jpeg", durationSec: D.act6, effect: "static" },

  // ── Act 7: 둘이 만나다 ────────────────────────────────
  { tag: "미술관 커플 1",             act: 7, file: "photos/044.jpeg", durationSec: D.act7, effect: "zoomIn" },
  { tag: "미술관 커플 2",             act: 7, file: "photos/045.jpeg", durationSec: D.act7, effect: "zoomOut" },
  { tag: "미술관 커플 3 (뒷모습)",    act: 7, file: "photos/046.jpeg", durationSec: D.act7, effect: "panRight" },
  { tag: "미술관 커플 4",             act: 7, file: "photos/047.jpeg", durationSec: D.act7, effect: "zoomIn" },
  { tag: "초기 일상 셀카",            act: 7, file: "photos/048.png",  durationSec: D.act7, effect: "zoomOut" },
  { tag: "Shake Shack 셀카",          act: 7, file: "photos/049.png",  durationSec: D.act7, effect: "zoomIn" },
  { tag: "테니스 경기장 (NY)",        act: 7, file: "photos/050.jpg",  durationSec: D.act7, effect: "panLeft" },
  { tag: "브루클린 브릿지 (NY)",      act: 7, file: "photos/051.png",  durationSec: D.act7, effect: "zoomIn" },

  // ── Act 8: 함께 걸어온 시간 ──────────────────────────
  { tag: "졸업식 커플 (신부 학사모)", act: 8, file: "photos/052.jpeg", durationSec: D.act8, effect: "zoomIn" },
  { tag: "서울대 졸업 가족 (신랑)",   act: 8, file: "photos/053.jpg",  durationSec: D.act8, effect: "zoomIn" },
  { tag: "신랑 부모님과",             act: 8, file: "photos/054.jpg",  durationSec: D.act8, effect: "zoomIn" },
  { tag: "머리 자르고 난 뒤 (입대전)",act: 8, file: "photos/055.jpg",  durationSec: D.act8, effect: "zoomIn" },
  { tag: "군대 면회 벚꽃 1",          act: 8, file: "photos/056.png",  durationSec: D.act8, effect: "zoomOut" },
  { tag: "군대 면회 벚꽃 2",          act: 8, file: "photos/057.jpeg", durationSec: D.act8, effect: "zoomIn" },
  { tag: "군부대 가족·친구",          act: 8, file: "photos/058.jpeg", durationSec: D.act8, effect: "panRight" },
  { tag: "군부대 대화",               act: 8, file: "photos/059.jpeg", durationSec: D.act8, effect: "zoomIn" },

  // ── Act 9: 지금의 우리 → 결혼 ────────────────────────
  { tag: "신발 디테일 (필러)",        act: 9, file: "photos/060.jpg",  durationSec: 2.0,    effect: "zoomIn" },
  { tag: "프리웨딩 소나무숲 1",       act: 9, file: "photos/061.png",  durationSec: D.act9, effect: "zoomIn" },
  { tag: "프리웨딩 테이블",           act: 9, file: "photos/062.jpg",  durationSec: D.act9, effect: "panRight" },
  { tag: "프리웨딩 포즈",             act: 9, file: "photos/063.jpg",  durationSec: D.act9, effect: "zoomIn" },
  { tag: "벚꽃 앞 커플",              act: 9, file: "photos/064.jpg",  durationSec: D.act9, effect: "zoomOut" },
  { tag: "흰 터널 커플",              act: 9, file: "photos/065.jpg",  durationSec: D.act9, effect: "zoomIn" },
  { tag: "엔딩: 꽃 받치는 포즈",      act: 9, file: "photos/066.jpg",  durationSec: 5.0,    effect: "zoomIn" },
];

export const FPS = 30;
export const CROSSFADE_SEC = 0.5;

// Total composition duration, accounting for overlapping crossfades.
export const totalDurationSec = (() => {
  const sum = photos.reduce((s, p) => s + p.durationSec, 0);
  return sum - CROSSFADE_SEC * (photos.length - 1);
})();
