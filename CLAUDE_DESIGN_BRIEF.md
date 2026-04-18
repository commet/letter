# CLAUDE DESIGN — 에셋 수집 브리프

> 이 문서는 claude.ai/design 에 그대로 import 해서 사용하기 위한 작업 지시서입니다.
> 하나의 프롬프트(섹션) 단위로 복사하여 Claude Design 채팅창에 붙여넣고, 결과물을 다운로드합니다.

---

## 0. 프로젝트 공통 컨텍스트

**읽고 시작하세요. 모든 프롬프트에 공통 적용됩니다.**

```
PROJECT: Korean wedding pre-ceremony slideshow video.
A couple's life story across 5 Acts (childhood → community → shared years
→ milestones → today). Runtime ~8 minutes with 60 photos.
Tech: Remotion + React (React components will be hand-authored from your output).
Canvas: 1920 × 1080 (16:9 landscape video frame).
Frame rate: 30 fps.

AESTHETIC DIRECTION:
- 70% vintage journal (hand-drawn ink, cream paper, imperfection)
- 20% documentary (honest, quiet, observational)
- 10% editorial (confident typography, intentional space)
- AVOID: glossy wedding invitation templates, corporate gradients,
         symmetric ornate borders, save-the-date card formulas

COLOR PALETTE (use exactly these):
- Cream paper:   #f5ecd7  (primary background)
- Paper dark:    #e8dcc0  (edge shading on paper)
- Ink black:     #1a1510  (primary text)
- Gold soft:     #e8d09b  (accents only, sparingly)
- Gold deep:     #a88848  (light-mode accents)

TYPOGRAPHY (Google Fonts, must be used):
- Nanum Myeongjo (400, 700, 800)   → Korean serif, primary
- Gowun Batang   (400, 700)         → Korean serif, alt
- Nanum Pen Script                   → Korean handwriting
- Gaegu          (300, 400, 700)    → Korean casual
- Cormorant Garamond (300, 400, 500)→ Latin serif elegant

OUTPUT PREFERENCES:
- Static illustrations → SVG (clean paths, no embedded raster)
- Textures → PNG (tileable where specified)
- Motion pieces → single HTML file with inline SVG + CSS keyframes
- All outputs viewable in isolation (no external JS libraries required)
- Include accurate timing in seconds for any animation
```

---

## 사용 방법

1. Claude Design 캔버스 열기 (claude.ai/design)
2. 아래 섹션 하나를 통째로 복사 → 채팅창에 붙여넣기
3. 첫 프롬프트 전에 **"0. 프로젝트 공통 컨텍스트"** 를 한 번 먼저 붙여넣어 전체 세션의 전제를 맞춤
4. 결과물이 마음에 들면 **Export → Download as .zip**
5. 저장 경로를 Claude Code 에게 알려주면 Remotion 포팅 진행

각 에셋마다 우선순위(P0/P1/P2), 기대 출력, Remotion 포팅 계획이 함께 기재되어 있습니다.

---

# 우선순위 P0 — 반드시 뽑기

## P0-1. Act 상징 일러스트 5장 (SVG)

**목적:** 각 Act 타이틀 카드의 배경/주제 일러스트. 현재 타이틀은 텍스트만 있어서 시각적 무게가 없음.

**프롬프트 (Claude Design에 붙여넣을 것):**
```
Five hand-drawn ink illustrations for a Korean wedding video story chapters.
Monochrome (ink black #1a1510 on transparent), minimal line art,
single ink weight throughout. Aesthetic: sumi-e (Korean ink painting) 
meets restrained botanical print. Imperfect, hand-quality.
NO text, NO frames, NO watermarks.

Each 1920×1080 SVG, composition centered but with generous whitespace.

Act I "각자의 자리에서": 
  Two separate garden paths, distant from each other, both meandering.
  Each has a small person silhouette walking (seen from above).
  Do not connect the paths.

Act II "같은 곳에서, 함께":
  Two paths converge toward a simple doorway or gate.
  The doorway is open, warm light implied by empty space inside.
  Figures not shown.

Act III "우리의 시간":
  A woven basket on a tabletop, spilling small shared objects:
  two teacups, a folded map, ticket stubs, a camera, a book.
  Slightly top-down angle.

Act IV "함께 걸어온 시간":
  A single pair of footprints walking into the distance on sand or snow.
  Footprints overlap as the couple walks close together.

Act V "그리고, 오늘":
  A single wildflower just bloomed, seen from slight side angle.
  Delicate, not ornate. Single stem, few leaves.

Output as 5 separate SVG files. Name them act-1.svg through act-5.svg.
```

**Remotion 통합:** `TitleCardScene`에 `<svg>` 인라인 배경 레이어 추가. Act마다 다른 SVG 로드. 0→1 opacity 페이드인 + 1.02 scale Ken Burns.

---

## P0-2. "이때" 모먼트 인터스티셜 카드 (HTML+CSS 애니)

**목적:** 특별한 사진 직전에 삽입하는 0.5초~1초짜리 브릿지 카드. 영상에 리듬과 호흡을 주는 핵심 장치.

**프롬프트:**
```
Five cinematic interstitial title cards for a life-story wedding video.
Each card: 1920×1080, 2 seconds total (0.4s fade in, 1.2s hold, 0.4s fade out).

Background: cream paper (#f5ecd7) with subtle hanji texture.
Typography: Nanum Myeongjo 56px for subtitle, Cormorant Garamond 28px 
for year/context line. Ink black #1a1510.
Layout: centered, breathing whitespace, one thin horizontal ink rule 
separating two text lines.

The five variants (use these exact Korean texts):

1. "그해 여름 / 우리는 같은 교회에 있었다"       YEAR: 2010
2. "2002년, 붉은 광장에서 / 우리는 같은 팀이었다"  YEAR: 2002
3. "같은 교실, 다른 자리 / 그러나 이미 시작"       YEAR: 2008
4. "편지와 기다림 / 그리고 긴 겨울"               YEAR: 2019
5. "지금, 여기 / 그리고 내일"                     YEAR: 2026

Animation: text fades in with slight vertical movement (8px up).
Subtitle appears first, then after 0.3s the year line.
The horizontal ink rule draws left-to-right across 0.6s (stroke-dashoffset).

Output as single HTML with all 5 variants in sequence, each triggered 
by a data-index attribute. CSS keyframes only, no JS.
```

**Remotion 통합:** 새로운 SceneKind `"moment"` 를 timeline에 추가. `config.moments: MomentCard[]` 필드 추가. 특정 사진 직전에 삽입 가능. Editor UI에서 +모먼트 버튼 추가.

---

## P0-3. 폴라로이드 종이 질감 + 워시테이프 (PNG 세트)

**목적:** 현재 폴라로이드는 흰색 CSS 박스일 뿐. 실물감 부족.

**프롬프트:**
```
Asset set for a wedding slideshow with vintage polaroid aesthetic.

ASSET 1 — Polaroid paper texture:
  Single polaroid card outline, 900 × 1020 px PNG with alpha.
  Authentic instant-film paper: slight warm yellow cast (#fdf6e8),
  fiber grain visible, edges slightly darker, one tiny natural 
  fingerprint smudge in bottom-right corner (very subtle).
  Empty photo area in center at standard polaroid proportions.

ASSET 2 — Washi tape strips, 8 variants:
  Each 320 × 80 px PNG with alpha, horizontal strip, torn edges.
  Slight wrinkle/fold realism, semi-transparent effect at edges.
  Variants:
    - Kraft brown (no pattern)
    - Dotted cream (small ink dots)
    - Pressed-flower print (tiny dried flowers, pastel)
    - Gold foil (subtle shimmer, not glossy)
    - Aged white (old paper with slight staining)
    - Mint green solid
    - Striped ivory + gold
    - Plain tracing-paper translucent

ASSET 3 — Photo corner mounts, 4 variants:
  Each 120 × 120 px PNG with alpha.
  Old-school paper triangle photo corners (for albums).
  Ivory, kraft, black, and aged cream variants.

All photoreal, not cartoony. Output as named PNG files in a zip.
```

**Remotion 통합:**
- `SplitScene` 폴라로이드 div에 `background-image` 레이어 추가
- 각 폴라로이드마다 랜덤으로 테이프 1개 `<img>` 상단에 얹음 (우측/좌측 위치도 랜덤)
- 선택적으로 corner mount 네 귀퉁이에 배치 가능

---

# 우선순위 P1 — 강력 권장

## P1-1. 엔딩 씬 — 이름 붓글씨 stroke-draw

**목적:** 영상의 마지막 감정 클라이맥스. 두 사람 이름이 붓으로 그려지는 순간.

**중요:** 실제 이름은 아래 `<BRIDE_NAME>` / `<GROOM_NAME>` 자리에 사용자가 교체.

**프롬프트:**
```
SVG calligraphy animation for two Korean names: "<BRIDE_NAME>" and "<GROOM_NAME>".
Korean brush-calligraphy style (붓글씨), not digital stroke.
Each character revealed stroke-by-stroke via SVG 
stroke-dasharray/stroke-dashoffset technique.

Layout:
  [BRIDE_NAME]    [small ink heart]    [GROOM_NAME]
  3 characters     1 simple shape       3 characters

Timing (total 5 seconds):
  0.0s - 0.5s : blank cream paper
  0.5s - 2.5s : bride name draws left-to-right, stroke-by-stroke
  2.5s - 3.0s : pause
  3.0s - 3.4s : ink heart draws
  3.4s - 5.0s : groom name draws left-to-right, stroke-by-stroke

Background: cream paper #f5ecd7.
Ink color: #1a1510.
Names should be LARGE — approximately 200px character height.
Center vertically in canvas. Generous whitespace above and below.

NO surrounding ornaments, NO borders, NO other text.
Just: paper, ink, names.

Output: single HTML file with inline SVG and CSS keyframes, 
self-contained, 1920×1080.
```

**Remotion 통합:** SVG path data 추출 → Remotion `interpolate(frame, [startFrame, endFrame], [pathLength, 0])`로 `stroke-dashoffset` 제어. BGM 박자에 정확히 맞춤 가능.

---

## P1-2. 연도 타임스탬프 카드 (타임점프용)

**목적:** Act 전환 or 군입대/졸업처럼 시간이 점프할 때 1.5초짜리 연도 인서트.

**프롬프트:**
```
Year marker interstitial card for a life-story video.
Shows a four-digit year (example: "2013") with dramatic typography animation.

Canvas: 1920×1080, cream paper #f5ecd7 background.
Typography: Cormorant Garamond, weight 300 (light), 200px height.
Ink black #1a1510.

Animation timing (2.5 seconds total):
  0.0s - 0.3s : fade in from 0 opacity, digits close-spaced (letter-spacing: 0)
  0.3s - 0.9s : letter-spacing expands from 0 to 80px gracefully (ease-out)
  0.9s - 1.8s : hold
  1.8s - 2.1s : letter-spacing compresses back to 20px
  2.1s - 2.5s : fade out

Below the year, a thin horizontal ink rule (300px wide, 1.5px thick) 
draws in from center outward during 0.4s-0.9s.

Below the rule (100px gap), small subtitle text in Nanum Myeongjo 28px,
appears at 1.1s: uses a placeholder like "[LOCATION]". 

Generate 6 variants with these year/location pairs:
  2002 · 붉은 광장
  2008 · 같은 학교
  2013 · 분당
  2018 · 서울
  2020 · 뉴욕
  2026 · 오늘

Output: single HTML file with all 6 variants addressable by data-year.
```

**Remotion 통합:** 새 SceneKind `"yearMarker"` 추가. 사용자가 timeline 원하는 위치에 삽입 가능.

---

## P1-3. 하드그림 식물 장식 라이브러리 (SVG 세트)

**목적:** 캡션/타이틀 주변에 선택적으로 얹을 수 있는 장식 에셋. 획일적 보더보다 훨씬 세련됨.

**프롬프트:**
```
A library of 12 hand-drawn ink botanical ornaments for a vintage 
wedding video. Single ink weight, monochrome, transparent background.
Ink color #1a1510. Sumi-e style. Varied composition.

Each 400 × 200 px SVG, horizontal layout:

1. Single olive branch, 3 leaves, right-leaning
2. Small cluster of wildflowers (3 stems), asymmetric
3. Tiny wheat stalk
4. Single ginkgo leaf with stem
5. A pair of birds on a wire (tiny, silhouette)
6. Three small leaves scattered (not connected)
7. Dandelion with seeds drifting
8. Small branch with 5 berries
9. Tea cup with steam (wispy)
10. Simple candle flame with wick
11. Envelope (closed, letter poking slightly out)
12. Old key (ornate victorian style)

Also generate 4 DIVIDER ornaments (full-width line + center motif):
- 1920 × 60 px SVG each
- Thin ink line with a small central symbol:
    D1: ink dot · ink line · tiny flower · ink line · ink dot
    D2: just a diamond shape
    D3: three ascending dots (bullet style)
    D4: curling flourish

Output as a .zip of 16 SVG files.
```

**Remotion 통합:** 사용자가 에디터에서 각 사진/모먼트 카드에 선택적으로 적용. `PhotoEntry.ornament?: string` 필드 추가. 캡션 위/아래 위치 지정 가능.

---

# 우선순위 P2 — 시간 되면 추가

## P2-1. 한지 배경 텍스처 (PNG)

**프롬프트:**
```
Authentic Korean hanji (handmade mulberry paper) seamless texture.
Warm cream base (#f5ecd7). Fine plant fiber pattern visible throughout,
very subtle — almost imperceptible. Slight unevenness in color 
(warmer in some areas, cooler in others). Edges not shown 
(fully tileable).

Two variants:
1. Clean: no stains, just fiber and slight color variation
2. Aged: add 3-4 very subtle darker spots (old water marks, coffee stains)
   no more than 5% of total area, very faint

Each 1024 × 1024 PNG, seamlessly tileable. Delivered as zip.
```

**Remotion 통합:** 현재 `PaperBackground` SVG turbulence 교체. 진짜 종이 텍스처로.

---

## P2-2. 장소/지도 일러스트

**프롬프트:**
```
Hand-drawn minimalist map illustration for a Korean couple's journey.
Ink on cream paper style. No geographic borders — just the locations 
as labeled ink dots connected by dotted lines in sequence.

Locations in order (label each in handwritten Korean, Nanum Pen Script):
  1. 성모병원 (Seoul)
  2. 분당
  3. 붉은 광장 (Seoul City Hall area)
  4. 서울
  5. 뉴욕

Each location: small ink-drawn circle with label beside it.
Connecting lines: dotted, varied (some curved, some straight).
Above the map, a tiny airplane illustration moves along the path.

Animation (8 seconds total):
  0-2s   : map appears (fade in)
  2-7s   : plane moves along the path, dots activate one by one
  7-8s   : hold final state

Canvas 1920 × 1080 landscape. 
Background: cream paper #f5ecd7.

Output: single HTML with inline SVG + CSS keyframes.
```

**Remotion 통합:** Act IV→V 사이 또는 뉴욕 사진들 직전에 삽입.

---

## P2-3. 시대 상징 아이콘 세트 (SVG)

**프롬프트:**
```
Icon set for a Korean couple's life story video. Hand-drawn ink style,
single color (#1a1510), 80×80 SVG each, transparent background.
Consistent line weight across all icons.

Childhood (5 icons):
  rocking horse, birthday cake with candles, school backpack, 
  crayon held in fist, small teddy bear

Community (5 icons):
  church steeple, soccer ball with 태극기 star, red devils scarf, 
  chapel stained-glass window, hymn book

Together (8 icons):
  two coffee cups, shared umbrella, travel suitcase, concert ticket, 
  passport, NYC skyline silhouette tiny, gallery frame, subway map fragment

Milestones (5 icons):
  military hat, graduation cap, diploma scroll, engagement ring box, 
  handwritten letter

Today (5 icons):
  wedding bouquet, two linked rings, sealed envelope, 
  open window with light, wild flower

Total: 28 icons. Consistent style throughout. Output as zip.
```

**Remotion 통합:** 각 사진 귀퉁이에 살짝 (60×60px, opacity 0.4) 해당 시대 상징 아이콘 표시. `PhotoEntry.icon?: string`.

---

## P2-4. 편지지 인터루드 씬 (HTML 모션)

**프롬프트:**
```
An animated "handwritten love letter" scene for a wedding video.
Cream paper background with faint horizontal rule lines (every 60px,
very light #d4c9a8). Paper has a slight natural curl at top-right 
corner (css transform).

Animation (8 seconds total):
  0-1s   : paper fades in
  1-7s   : Korean text types out character by character, 
           ~6 chars/sec, Nanum Pen Script font 48px, ink color.
           Two lines:
             Line 1: "2015년 봄"
             Line 2: "우리가 처음 만난 그날"
  7-8s   : cursor blinks twice then fades

Fountain-pen ink effect: as each character is written, a subtle 
darker ink pool forms at the end stroke that quickly fades.

Canvas 1920×1080.
Output: single HTML file, self-contained.
```

**Remotion 통합:** 새 SceneKind `"letter"`. Act 전환 브릿지용.

---

## P2-5. 폴라로이드 몽타주 (Scrapbook Layout)

**프롬프트:**
```
Scrapbook collage layout template for a video moment. 
Kraft paper journal page background (texture visible) at 1920×1080.

Layout: 7 polaroid slots scattered naturally:
  - Top-left, angled -6°, partially overlapped by next
  - Top-center, angled +4°
  - Top-right, angled -8°
  - Middle-left, angled +3°
  - Middle-center (largest), angled -2°
  - Bottom-left, angled +7°
  - Bottom-right, angled -5°

Each polaroid has:
  - A strip of washi tape at one corner (different color per polaroid)
  - A small handwritten Korean caption below the photo area 
    (use placeholder text "[사진 설명]" — will be replaced)

Scattered around (NOT on the polaroids):
  - 3 handwritten margin notes in Nanum Pen Script 
    (placeholders: "[메모 1]", "[메모 2]", "[메모 3]")
  - 2 small ink stamps (date format "YYYY.MM")
  - 1 small pressed flower sticker
  - 1 tiny sketch of a heart

Animation (4 seconds):
  Polaroids drop in one-by-one (stagger 0.2s each), 
  slight bounce on landing, settle at their angles.
  Margin notes fade in last.

Output: HTML with numbered slots (photo-1 through photo-7), 
easily replaceable image sources.
```

**Remotion 통합:** 새 SceneKind `"collage"`. 여행편/갤러리편 마무리로 사용. 7장을 한 번에.

---

# 우선순위 P3 — 실험적 (시간 많으면)

## P3-1. 필름 35mm Shader (GLSL)

**프롬프트:**
```
GLSL fragment shader for 35mm analog film emulation overlay.
To be applied over photos in a wedding video (blend mode: multiply/screen).

Effects to combine:
1. Analog grain — temporal noise, warm tone bias
2. Very subtle RGB channel misalignment at frame edges (~1px)
3. Gentle circular vignette (darken edges ~15%)
4. Color grading toward Kodak Portra 400:
   - Lifted blacks (not pure 0)
   - Warm highlights (slight orange push)
   - Desaturated shadows
   - Slight cyan shift in midtones

Uniforms needed:
  - uTime (float, seconds)
  - uResolution (vec2)
  - uTexture (sampler2D, source image)

Output: 
  - complete .glsl fragment shader file
  - HTML demo page embedding it in a <canvas> with a sample image
  - vertex shader is simple passthrough, include it
```

**Remotion 통합:** `<AbsoluteFill>` 안에 `<canvas ref>` + WebGL setup. 새 overlay 타입 `"film-35mm"`. 고성능 GPU 필요.

---

## P3-2. 잉크 번짐 트랜지션 Shader

**프롬프트:**
```
GLSL transition shader: ink drop spreading wipe effect.
Transitions between two images over 0.8 seconds.

Effect behavior:
- Starts: ink drop at focal point (configurable 0-1 UV coord)
- Expands: organically spreads, turbulence-based irregularity 
  (not perfect circle)
- Ends: fully covers, revealing second image

Uniforms:
  - uProgress (0 to 1)
  - uFocal (vec2, 0-1)
  - uFromTexture (sampler2D)
  - uToTexture (sampler2D)
  - uTime (for turbulence variation)

Output: complete .glsl fragment shader + HTML demo 
with two test images and a progress slider.
```

**Remotion 통합:** 새 TransitionMode `"ink-spread"`. Shader transition via `@remotion/shapes` or custom canvas.

---

# 체크리스트 — 수집 우선순위

P0 (반드시):
- [ ] P0-1. Act 상징 일러스트 5장 (SVG)
- [ ] P0-2. "이때" 모먼트 카드 5종 (HTML 애니)
- [ ] P0-3. 폴라로이드 질감 + 워시테이프 PNG 세트

P1 (강력 권장):
- [ ] P1-1. 이름 붓글씨 엔딩 (HTML 애니)  ← 실제 이름 먼저 확정
- [ ] P1-2. 연도 타임스탬프 6종 (HTML 애니)
- [ ] P1-3. 식물 장식 16종 + 디바이더 4종 (SVG)

P2 (여유 되면):
- [ ] P2-1. 한지 배경 2종 (PNG)
- [ ] P2-2. 지도 일러스트 (HTML 애니)
- [ ] P2-3. 시대 아이콘 세트 28종 (SVG)
- [ ] P2-4. 편지지 인터루드 (HTML 애니)
- [ ] P2-5. 폴라로이드 몽타주 (HTML 템플릿)

P3 (실험):
- [ ] P3-1. 필름 35mm Shader (GLSL)
- [ ] P3-2. 잉크 번짐 트랜지션 Shader (GLSL)

---

# 작업 워크플로우

1. **P0 먼저** — 이 3개만 확보해도 영상 체감 품질 2배
2. 각 에셋 받을 때마다 Claude Code에게 넘기기 (ZIP 경로 또는 SVG 코드)
3. Claude Code가 Remotion 컴포넌트로 포팅 → video-0505.vercel.app에 배포
4. 프리뷰 확인하고 다음 에셋으로 진행
5. P1→P2→P3 순차 진행

**절대 금지:**
- 한 번에 다 뽑으려고 하지 말 것. 하나씩 받고 영상에 통합하고 확인 후 다음.
- "저장 버튼 누르면 다음 것도 알아서 나옴" 같은 일 없음. 매번 프롬프트 붙여넣기.

---

# 실제 이름/날짜 빈칸 (미리 채워놓기)

P1-1 (이름 붓글씨)에 필요:
- BRIDE_NAME (3글자): _______________
- GROOM_NAME (3글자): _______________
- WEDDING_DATE (YYYY.MM.DD): _______________

P0-2 (모먼트 카드)에 필요 — 현재 제안된 5개 한국어 카피가 스토리에 맞는지 확인:
- 1) "그해 여름 / 우리는 같은 교회에 있었다" (2010)
- 2) "2002년, 붉은 광장에서 / 우리는 같은 팀이었다" (2002)
- 3) "같은 교실, 다른 자리 / 그러나 이미 시작" (2008)
- 4) "편지와 기다림 / 그리고 긴 겨울" (2019)
- 5) "지금, 여기 / 그리고 내일" (2026)

→ 실제 스토리 맥락에 맞게 교체/삭제하고 Claude Design에 넘기세요.
