// Copies the original photos from letter/video and letter/image into
// letter-video/public/photos/ with sequential numbered names (001.ext, 002.ext, ...).
// The order here must stay in sync with src/manifest.ts.
//
// Run with: node scripts/copy-photos.mjs
// Re-runnable: overwrites destination files.

import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const VIDEO_DIR = join(ROOT, "video");
const IMAGE_DIR = join(ROOT, "image");
const OUT_DIR = join(__dirname, "..", "public", "photos");

mkdirSync(OUT_DIR, { recursive: true });

const V = (name) => join(VIDEO_DIR, name);
const I = (name) => join(IMAGE_DIR, name);

// Keep this list in order with src/manifest.ts.
const sources = [
  // Act 1 — 각자의 처음 → 같은 자리
  V("KakaoTalk_Photo_2026-04-15-10-09-12 023.jpeg"),       // 001 어항 앞 어린 신랑
  V("KakaoTalk_Photo_2026-04-15-10-11-38 003.jpeg"),       // 002 Be The Reds 신랑
  V("KakaoTalk_Photo_2026-04-15-10-09-12 024.jpeg"),       // 003 책상 앞 어린 신부
  V("KakaoTalk_Photo_2026-04-15-10-11-37 001.jpeg"),       // 004 태극기 얼굴 COREA 신부
  I("16.jpg"),                                              // 005 ★ 고궁 두 아이 (jpg로 압축됨)
  I("15.png"),                                              // 006 ★ 생일파티 두 아이

  // Act 2 — 교회 유년기
  V("KakaoTalk_Photo_2026-04-15-10-09-12 025.jpeg"),       // 007 1999 유치부 단체
  V("KakaoTalk_Photo_2026-04-15-10-09-11 021.jpeg"),       // 008 주일학교 1
  V("KakaoTalk_Photo_2026-04-15-10-09-11 022.jpeg"),       // 009 주일학교 2
  V("KakaoTalk_Photo_2026-04-15-10-11-38 004.jpeg"),       // 010 붉은악마 교회 행사
  V("KakaoTalk_Photo_2026-04-15-10-11-39 005.jpeg"),       // 011 빨간티 어린이
  V("KakaoTalk_Photo_2026-04-15-10-09-12 026.jpeg"),       // 012 눈밭
  V("KakaoTalk_Photo_2026-04-15-10-09-13 027.jpeg"),       // 013 실내 활동
  V("KakaoTalk_Photo_2026-04-15-10-09-13 029.jpeg"),       // 014 생일파티 케이크
  V("KakaoTalk_Photo_2026-04-15-10-09-13 028.jpeg"),       // 015 교회 합창
  V("KakaoTalk_Photo_2026-04-15-10-09-13 030.jpeg"),       // 016 어른 선물

  // Act 3 — 캠프
  V("KakaoTalk_Photo_2026-04-15-10-11-39 006.jpeg"),       // 017 버스 여름캠프
  V("KakaoTalk_Photo_2026-04-15-10-11-39 007.jpeg"),       // 018 시골길 Y
  V("KakaoTalk_Photo_2026-04-15-10-11-39 008.jpeg"),       // 019 가을 공원

  // Act 4 — 학창
  V("KakaoTalk_Photo_2026-04-15-10-11-40 009.jpeg"),       // 020 청소년 꽃다발 (교회)
  V("KakaoTalk_Photo_2026-04-15-10-11-45 023.jpeg"),       // 021 교실 5인 꽃다발
  V("KakaoTalk_Photo_2026-04-15-10-11-46 024.jpeg"),       // 022 교실 선생+학생
  V("KakaoTalk_Photo_2026-04-15-10-09-01 004.jpeg"),       // 023 영화관 3D
  V("KakaoTalk_Photo_2026-04-15-10-09-00 003.jpeg"),       // 024 지하철 통로

  // Act 5 — 청년부
  V("KakaoTalk_Photo_2026-04-15-10-11-46 025.jpeg"),       // 025 사무실 2인
  V("KakaoTalk_Photo_2026-04-15-10-11-44 021.jpeg"),       // 026 청년부 예배당 1
  V("KakaoTalk_Photo_2026-04-15-10-11-44 022.jpeg"),       // 027 청년부 예배당 2
  V("KakaoTalk_Photo_2026-04-15-10-08-59 001.jpeg"),       // 028 스키장 세로
  V("KakaoTalk_Photo_2026-04-15-10-09-00 002.jpeg"),       // 029 스키장 가로
  V("KakaoTalk_Photo_2026-04-15-10-09-08 014.jpeg"),       // 030 대나무숲
  V("KakaoTalk_Photo_2026-04-15-10-09-08 017.jpeg"),       // 031 갈대밭
  V("KakaoTalk_Photo_2026-04-15-10-09-08 016.jpeg"),       // 032 청년부 셀카
  V("KakaoTalk_Photo_2026-04-15-10-09-09 018.jpeg"),       // 033 해변 단체
  V("KakaoTalk_Photo_2026-04-15-10-09-08 015.jpeg"),       // 034 녹차밭 3인
  V("KakaoTalk_Photo_2026-04-15-10-09-11 019.jpeg"),       // 035 긴 식당 단체
  V("KakaoTalk_Photo_2026-04-15-10-09-11 020.jpeg"),       // 036 고기집

  // Act 6 — 크리스마스 공연 (클라이맥스)
  V("KakaoTalk_Photo_2026-04-15-10-11-47 026.jpeg"),       // 037 오프닝 무대
  V("KakaoTalk_Photo_2026-04-15-10-11-47 027.jpeg"),       // 038 하트
  V("KakaoTalk_Photo_2026-04-15-10-11-48 028.jpeg"),       // 039 춤 1
  V("KakaoTalk_Photo_2026-04-15-10-11-49 029.jpeg"),       // 040 춤 2
  V("KakaoTalk_Photo_2026-04-15-10-11-50 030.jpeg"),       // 041 사슴뿔
  V("KakaoTalk_Photo_2026-04-15-10-12-08 001.jpeg"),       // 042 4인 춤 1
  V("KakaoTalk_Photo_2026-04-15-10-12-10 002.jpeg"),       // 043 4인 춤 2

  // Act 7 — 둘이 만나다
  V("KakaoTalk_Photo_2026-04-15-10-09-02 005.jpeg"),       // 044 미술관 1
  V("KakaoTalk_Photo_2026-04-15-10-09-02 006.jpeg"),       // 045 미술관 2
  V("KakaoTalk_Photo_2026-04-15-10-09-03 007.jpeg"),       // 046 미술관 3 뒷모습
  V("KakaoTalk_Photo_2026-04-15-10-09-03 008.jpeg"),       // 047 미술관 4
  I("07.png"),                                              // 048 초기 일상 셀카
  I("08.png"),                                              // 049 Shake Shack 셀카
  I("09.jpg"),                                              // 050 테니스 경기장 NY
  I("10.png"),                                              // 051 브루클린 브릿지 NY

  // Act 8 — 함께 걸어온 시간
  V("KakaoTalk_Photo_2026-04-15-10-09-04 009.jpeg"),       // 052 졸업식 커플 (신부)
  I("13.jpg"),                                              // 053 서울대 졸업 가족 (신랑)
  I("14.jpg"),                                              // 054 신랑 부모님과
  I("11.jpg"),                                              // 055 머리 자르고 난 뒤 (입대전)
  V("KakaoTalk_Photo_2026-04-15-10-09-06 010.png"),        // 056 군대 면회 1 (PNG)
  V("KakaoTalk_Photo_2026-04-15-10-09-06 011.jpeg"),       // 057 군대 면회 2
  V("KakaoTalk_Photo_2026-04-15-10-09-07 012.jpeg"),       // 058 군부대 가족
  V("KakaoTalk_Photo_2026-04-15-10-09-07 013.jpeg"),       // 059 군부대 대화

  // Act 9 — 지금의 우리 → 결혼
  I("18.jpg"),                                              // 060 신발 디테일
  I("02.png"),                                              // 061 프리웨딩 소나무숲
  I("03.jpg"),                                              // 062 프리웨딩 테이블
  I("04.jpg"),                                              // 063 프리웨딩 포즈
  I("05.jpg"),                                              // 064 벚꽃
  I("06.jpg"),                                              // 065 흰 터널
  I("01.jpg"),                                              // 066 엔딩 포즈
];

let ok = 0;
let miss = 0;
for (let i = 0; i < sources.length; i++) {
  const src = sources[i];
  const ext = extname(src).toLowerCase(); // .jpeg / .jpg / .png
  const dest = join(OUT_DIR, `${String(i + 1).padStart(3, "0")}${ext}`);
  if (!existsSync(src)) {
    console.warn(`[${i + 1}/${sources.length}] MISSING: ${src}`);
    miss++;
    continue;
  }
  copyFileSync(src, dest);
  ok++;
  process.stdout.write(
    `[${String(i + 1).padStart(3, "0")}/${sources.length}] ${dest.split("/").pop()}\n`
  );
}
console.log(`\nDone. copied=${ok} missing=${miss}`);
