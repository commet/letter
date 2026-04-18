import React, { useState, useRef, useCallback, useEffect } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { MainVideo } from "./VideoComposition";
import {
  VideoConfig,
  PhotoEntry,
  ActTitle,
  EndingConfig,
  Effect,
  TransitionType,
  FilterType,
  OverlayType,
  ParticleType,
  FrameType,
  SplitStyle,
  TitleVariant,
  BackgroundStyle,
  CaptionConfig,
  SpotlightConfig,
  defaultConfig,
  computeTotalFrames,
  getPhotoIndexAtFrame,
  getPhotoStartFrame,
} from "./data";
import { loadConfig, saveConfig, uploadPhoto, aiEditConfig } from "./supabase";
import { ERA_ICONS, ERA_ICON_LABELS } from "./eraIcons";

// Resolve photo src: full URL (supabase) or local path
const photoSrc = (file: string) => file.startsWith("http") ? file : `/${file}`;

const EFFECTS: { value: Effect; label: string }[] = [
  { value: "zoomIn", label: "확대 (줌인)" },
  { value: "zoomOut", label: "축소 (줌아웃)" },
  { value: "panLeft", label: "← 왼쪽으로 이동" },
  { value: "panRight", label: "오른쪽으로 이동 →" },
  { value: "static", label: "고정" },
];
const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: "fade", label: "페이드" },
  { value: "iris", label: "아이리스" },
  { value: "slide-left", label: "슬라이드 좌" },
  { value: "slide-right", label: "슬라이드 우" },
  { value: "wipe-down", label: "와이프 하" },
  { value: "none", label: "없음" },
];
const FILTERS: { value: FilterType; label: string }[] = [
  { value: "none", label: "원본" },
  { value: "sepia", label: "세피아" },
  { value: "grayscale", label: "흑백" },
  { value: "vintage", label: "빈티지" },
  { value: "warm", label: "따뜻한" },
  { value: "cool", label: "시원한" },
];
const ROMAN: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
  6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
};

const OVERLAYS: { value: OverlayType; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "film-grain", label: "필름 그레인" },
  { value: "light-leak", label: "라이트 릭" },
  { value: "bokeh", label: "보케 (빛망울)" },
  { value: "vignette", label: "비네트" },
];
const PARTICLES: { value: ParticleType; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "sparkle", label: "반짝이" },
  { value: "petals", label: "꽃잎" },
  { value: "hearts", label: "하트" },
  { value: "snow", label: "눈" },
];
const FRAMES: { value: FrameType; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "polaroid", label: "폴라로이드" },
  { value: "film-strip", label: "필름 스트립" },
  { value: "rounded", label: "라운드" },
  { value: "classic", label: "클래식 (골드)" },
];
const SPLIT_STYLES: { value: SplitStyle; label: string }[] = [
  { value: "standard", label: "기본 (50/50 분할)" },
  { value: "polaroid", label: "폴라로이드 페어 (기울어진)" },
  { value: "cameo", label: "카메오 (원형 초상)" },
];
const TITLE_VARIANTS: { value: TitleVariant; label: string }[] = [
  { value: "standard", label: "어두운 배경 (골드)" },
  { value: "journal", label: "저널 (크림 종이)" },
];
const BACKGROUND_STYLES: { value: BackgroundStyle; label: string }[] = [
  { value: "paper", label: "크림 종이 (빈티지)" },
  { value: "blur", label: "사진 블러 (사진을 흐리게)" },
  { value: "black", label: "검정" },
];

// ─── Image Editor Modal ──────────────────────

type EditorMode = "focal" | "spotlight";

const ImageEditorModal: React.FC<{
  photo: PhotoEntry;
  kenBurnsAmount: number;
  onUpdatePhoto: (patch: Partial<PhotoEntry>) => void;
  onUpdateKenBurnsAmount: (val: number) => void;
  onClose: () => void;
}> = ({ photo, kenBurnsAmount, onUpdatePhoto, onUpdateKenBurnsAmount, onClose }) => {
  const [mode, setMode] = useState<EditorMode>("focal");
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const getClickPos = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const pos = getClickPos(e);
    if (!pos) return;

    if (mode === "focal") {
      onUpdatePhoto({ focalPoint: pos });
    } else {
      // Add new spotlight
      const newSpot: SpotlightConfig = { x: pos.x, y: pos.y, radius: 0.25, strength: 0.55 };
      onUpdatePhoto({ spotlights: [...(photo.spotlights ?? []), newSpot] });
      setSelectedSpot((photo.spotlights ?? []).length); // select the new one
    }
  };

  const updateSpotlight = (idx: number, patch: Partial<SpotlightConfig>) => {
    const spots = [...(photo.spotlights ?? [])];
    spots[idx] = { ...spots[idx], ...patch };
    onUpdatePhoto({ spotlights: spots });
  };

  const deleteSpotlight = (idx: number) => {
    onUpdatePhoto({ spotlights: (photo.spotlights ?? []).filter((_, i) => i !== idx) });
    setSelectedSpot(null);
  };

  const spots = photo.spotlights ?? [];

  // Build spotlight preview mask
  const previewGradients = spots.map(
    (s) => `radial-gradient(ellipse ${s.radius * 120}% ${s.radius * 120}% at ${s.x * 100}% ${s.y * 100}%, transparent 0%, transparent 40%, rgba(0,0,0,1) 100%)`
  );
  const previewStrength = spots.reduce((max, s) => Math.max(max, s.strength), 0.55);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>이미지 편집 - {photo.tag}</h3>
            <div className="modal-tabs">
              <button className={`tab ${mode === "focal" ? "tab-active" : ""}`} onClick={() => setMode("focal")}>
                포커스 포인트
              </button>
              <button className={`tab ${mode === "spotlight" ? "tab-active" : ""}`} onClick={() => setMode("spotlight")}>
                강조 (스포트라이트)
              </button>
            </div>
          </div>
        </div>

        <div className="editor-body">
          <div className="editor-canvas">
            <div className="focal-container">
              <img
                ref={imgRef}
                src={photoSrc(photo.file)}
                alt={photo.tag}
                className="focal-img"
                onClick={handleImageClick}
                draggable={false}
              />

              {/* Spotlight preview overlay */}
              {mode === "spotlight" && spots.length > 0 && (
                <div className="spotlight-preview" style={{
                  background: `rgba(0,0,0,${previewStrength})`,
                  WebkitMaskImage: previewGradients.join(", "),
                  WebkitMaskComposite: spots.length > 1 ? "source-in" : undefined,
                  maskImage: previewGradients.join(", "),
                } as React.CSSProperties} />
              )}

              {/* Focal point marker */}
              {mode === "focal" && (
                <div className="focal-marker" style={{
                  left: `${photo.focalPoint.x * 100}%`,
                  top: `${photo.focalPoint.y * 100}%`,
                }}>
                  <div className="focal-ring" />
                  <div className="focal-cross-h" />
                  <div className="focal-cross-v" />
                </div>
              )}

              {/* Spotlight markers */}
              {mode === "spotlight" && spots.map((s, i) => (
                <div
                  key={i}
                  className={`spot-marker ${selectedSpot === i ? "spot-marker--active" : ""}`}
                  style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
                  onClick={(e) => { e.stopPropagation(); setSelectedSpot(i); }}
                >
                  <div className="spot-ring" style={{
                    width: `${s.radius * 80}%`,
                    height: `${s.radius * 80}%`,
                  }} />
                  <span className="spot-num">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="editor-controls">
            {mode === "focal" && (
              <>
                <p className="hint">이미지를 클릭해서 줌/팬 중심점을 지정하세요.</p>
                <div className="coord-display">
                  x: {(photo.focalPoint.x * 100).toFixed(0)}% &nbsp; y: {(photo.focalPoint.y * 100).toFixed(0)}%
                </div>
                <button className="btn btn-xs" onClick={() => onUpdatePhoto({ focalPoint: { x: 0.5, y: 0.5 } })}>
                  중앙 리셋
                </button>
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-soft)" }}>
                  <p className="hint" style={{ marginBottom: 6 }}>
                    줌/확대 정도 (전체 영상 공통)
                  </p>
                  {/* Visual preview: photo with zoom applied — updates live */}
                  <div style={{
                    width: "100%", aspectRatio: "16 / 9",
                    border: "1px solid var(--border)", borderRadius: 4,
                    background: "#2a241c", overflow: "hidden",
                    position: "relative", marginBottom: 10,
                  }}>
                    <img
                      src={photoSrc(photo.file)}
                      alt=""
                      draggable={false}
                      style={{
                        position: "absolute", inset: 0,
                        width: "100%", height: "100%",
                        objectFit: "contain",
                        transform: `scale(${1 + kenBurnsAmount})`,
                        transformOrigin: `${photo.focalPoint.x * 100}% ${photo.focalPoint.y * 100}%`,
                        transition: "transform 0.25s ease-out",
                      }}
                    />
                    <div style={{
                      position: "absolute", bottom: 6, right: 8,
                      color: "white", fontSize: 10,
                      background: "rgba(0,0,0,0.55)", padding: "2px 8px", borderRadius: 2,
                      letterSpacing: 0.5, fontFamily: "monospace",
                    }}>
                      최대 scale {(1 + kenBurnsAmount).toFixed(2)}×
                    </div>
                  </div>
                  <label className="slider-label">
                    <span>확대</span>
                    <input
                      type="range"
                      className="slider"
                      min={0}
                      max={0.15}
                      step={0.005}
                      value={kenBurnsAmount}
                      onChange={(e) => onUpdateKenBurnsAmount(parseFloat(e.target.value))}
                    />
                    <span>{(kenBurnsAmount * 100).toFixed(1)}%</span>
                  </label>
                  {/* Preset buttons with visual scale indicators */}
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    {[
                      { label: "없음", val: 0, desc: "정적" },
                      { label: "2%", val: 0.02, desc: "아주 잔잔" },
                      { label: "4%", val: 0.04, desc: "권장" },
                      { label: "8%", val: 0.08, desc: "눈에 띔" },
                      { label: "15%", val: 0.15, desc: "강함" },
                    ].map((p) => {
                      const active = Math.abs(kenBurnsAmount - p.val) < 0.003;
                      return (
                        <button
                          key={p.val}
                          className="btn btn-xs"
                          style={{
                            flex: 1,
                            background: active ? "var(--gold)" : undefined,
                            color: active ? "#111" : undefined,
                            fontWeight: active ? 700 : 500,
                            padding: "6px 4px",
                            fontSize: 11,
                          }}
                          title={p.desc}
                          onClick={() => onUpdateKenBurnsAmount(p.val)}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {mode === "spotlight" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p className="hint" style={{ margin: 0 }}>
                    이미지를 클릭하면 강조 영역이 추가됩니다.<br />해당 영역만 밝고, 나머지는 어두워집니다.
                  </p>
                  {spots.length > 0 && (
                    <button
                      className="btn btn-xs"
                      style={{ flexShrink: 0, marginLeft: 10 }}
                      onClick={() => {
                        onUpdatePhoto({ spotlights: [] });
                        setSelectedSpot(null);
                      }}
                    >
                      전체 리셋
                    </button>
                  )}
                </div>
                {spots.length === 0 && (
                  <p className="hint hint-dim">아직 강조 포인트가 없습니다.</p>
                )}
                {spots.map((s, i) => (
                  <div key={i} className={`spot-control ${selectedSpot === i ? "spot-control--active" : ""}`}
                    onClick={() => setSelectedSpot(i)}>
                    <div className="spot-control-header">
                      <span>강조 #{i + 1}</span>
                      <button className="btn-icon btn-icon--danger" onClick={(e) => { e.stopPropagation(); deleteSpotlight(i); }}>&#10005;</button>
                    </div>
                    <label className="slider-label">
                      <span>반경</span>
                      <input type="range" className="slider" min={0.05} max={0.5} step={0.01} value={s.radius}
                        onChange={(e) => updateSpotlight(i, { radius: parseFloat(e.target.value) })} />
                      <span>{(s.radius * 100).toFixed(0)}%</span>
                    </label>
                    <label className="slider-label">
                      <span>강도</span>
                      <input type="range" className="slider" min={0.2} max={0.85} step={0.05} value={s.strength}
                        onChange={(e) => updateSpotlight(i, { strength: parseFloat(e.target.value) })} />
                      <span>{(s.strength * 100).toFixed(0)}%</span>
                    </label>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <span className="modal-footer-hint">
            {mode === "focal" ? "클릭 = 포커스 지정 · 변경사항은 실시간 반영됨" : "클릭 = 강조 추가 · 변경사항은 실시간 반영됨"}
          </span>
          <button
            className="btn-save"
            style={{ minWidth: 110, fontSize: 15 }}
            onClick={onClose}
          >
            ✓ 확인
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── App ─────────────────────────────────────

export const App: React.FC = () => {
  // ── All state declarations FIRST ────────────
  const [config, setConfig] = useState<VideoConfig>(defaultConfig);
  const [openActs, setOpenActs] = useState<Set<number>>(new Set());
  const [openEnding, setOpenEnding] = useState(false);
  const [editorTarget, setEditorTarget] = useState<number | null>(null);
  const [panelTab, setPanelTab] = useState<"edit" | "assets">("edit");
  const [assetTarget, setAssetTarget] = useState<"global" | "current">("current");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as "dark" | "light") ?? "dark";
  });
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstSave = useRef(true);

  // ── Derived values ──────────────────────────
  const currentPhotoIdx = getPhotoIndexAtFrame(currentFrame, config);
  const currentPhoto = currentPhotoIdx !== null ? config.photos[currentPhotoIdx] : null;
  const totalFrames = computeTotalFrames(config);
  const totalSec = totalFrames / config.fps;

  // ── Effects ─────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (p) {
        try { setCurrentFrame(p.getCurrentFrame()); } catch {}
      }
    }, 150);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // ── Load from Supabase on mount ─────────────
  useEffect(() => {
    loadConfig().then((saved) => {
      if (saved) setConfig(saved);
      setLoading(false);
    });
  }, []);

  // ── Auto-save to Supabase (debounced 2s) ────
  useEffect(() => {
    if (loading) return;
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus("saving");
      saveConfig(config).then((ok) => {
        setSaveStatus(ok ? "saved" : "idle");
        if (ok) setTimeout(() => setSaveStatus("idle"), 2000);
      });
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [config, loading]);

  // ── updaters ────────────────────────────────

  const updatePhoto = useCallback((idx: number, patch: Partial<PhotoEntry>) => {
    setConfig((c) => ({
      ...c,
      photos: c.photos.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  }, []);

  const updateCaption = useCallback((idx: number, patch: Partial<CaptionConfig> | null) => {
    setConfig((c) => ({
      ...c,
      photos: c.photos.map((p, i) => {
        if (i !== idx) return p;
        if (patch === null) return { ...p, caption: undefined };
        return { ...p, caption: { text: "", position: "bottom", ...p.caption, ...patch } };
      }),
    }));
  }, []);

  const updateTitle = useCallback((act: number, patch: Partial<ActTitle>) => {
    setConfig((c) => ({
      ...c,
      actTitles: { ...c.actTitles, [act]: { ...c.actTitles[act], ...patch } },
    }));
  }, []);

  const updateEnding = useCallback((patch: Partial<EndingConfig>) => {
    setConfig((c) => ({ ...c, ending: { ...c.ending, ...patch } }));
  }, []);

  const movePhoto = useCallback((idx: number, dir: -1 | 1) => {
    setConfig((c) => {
      const arr = [...c.photos];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return c;
      if (arr[target].act !== arr[idx].act) return c;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...c, photos: arr };
    });
  }, []);

  const deletePhoto = useCallback((idx: number) => {
    setConfig((c) => ({ ...c, photos: c.photos.filter((_, i) => i !== idx) }));
  }, []);

  const toggleSplitPair = useCallback((idx: number) => {
    setConfig((c) => ({
      ...c,
      photos: c.photos.map((p, i) => i === idx ? { ...p, splitPair: !p.splitPair } : p),
    }));
  }, []);

  // ── photo upload ────────────────────────────

  const handlePhotoUpload = useCallback((act: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = input.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        const url = await uploadPhoto(file);
        if (url) {
          const newPhoto: PhotoEntry = {
            tag: file.name.replace(/\.[^.]+$/, ""),
            act,
            file: url, // full URL from Supabase Storage
            durationSec: 3.0,
            effect: "zoomIn",
            focalPoint: { x: 0.5, y: 0.5 },
            transition: "fade",
            filter: "none",
            spotlights: [],
          };
          setConfig((c) => ({ ...c, photos: [...c.photos, newPhoto] }));
        }
      }
    };
    input.click();
  }, []);

  // ── act merge ───────────────────────────────

  const mergeActWithNext = useCallback((currentAct: number, nextAct: number) => {
    if (!confirm(`Act ${ROMAN[currentAct] ?? currentAct}과 Act ${ROMAN[nextAct] ?? nextAct}을 합칠까요?`)) return;
    setConfig((c) => ({
      ...c,
      photos: c.photos.map((p) => (p.act === nextAct ? { ...p, act: currentAct } : p)),
      actTitles: Object.fromEntries(
        Object.entries(c.actTitles).filter(([k]) => Number(k) !== nextAct)
      ) as Record<number, ActTitle>,
    }));
  }, []);

  const toggleAct = (act: number) => {
    setOpenActs((prev) => {
      const next = new Set(prev);
      next.has(act) ? next.delete(act) : next.add(act);
      return next;
    });
  };

  const resetConfig = () => {
    if (confirm("기본 설정으로 되돌릴까요?")) setConfig(defaultConfig);
  };

  // ── Moment cards (이때 interstitials) ────────

  const addMomentAfter = (photoIdx: number) => {
    const newCard = {
      id: `m${Date.now()}`,
      afterPhotoIndex: photoIdx,
      l1: "그해 여름",
      l2: "우리는 같은 자리에 있었다",
      year: "2010",
      durationSec: 2.0,
    };
    setConfig((c) => ({ ...c, moments: [...(c.moments ?? []), newCard] }));
  };

  const updateMoment = (id: string, patch: Partial<{ l1: string; l2: string; year: string; afterPhotoIndex: number; durationSec: number }>) => {
    setConfig((c) => ({
      ...c,
      moments: (c.moments ?? []).map((m) => m.id === id ? { ...m, ...patch } : m),
    }));
  };

  const deleteMoment = (id: string) => {
    setConfig((c) => ({
      ...c,
      moments: (c.moments ?? []).filter((m) => m.id !== id),
    }));
  };

  // ── Year markers (연도 타임스탬프) ───────────

  const addYearMarkerAfter = (photoIdx: number) => {
    const newMarker = {
      id: `y${Date.now()}`,
      afterPhotoIndex: photoIdx,
      year: "2020",
      location: "장소",
      durationSec: 3.0,
    };
    setConfig((c) => ({ ...c, yearMarkers: [...(c.yearMarkers ?? []), newMarker] }));
  };

  const updateYearMarker = (id: string, patch: Partial<{ year: string; location: string; durationSec: number }>) => {
    setConfig((c) => ({
      ...c,
      yearMarkers: (c.yearMarkers ?? []).map((y) => y.id === id ? { ...y, ...patch } : y),
    }));
  };

  const deleteYearMarker = (id: string) => {
    setConfig((c) => ({
      ...c,
      yearMarkers: (c.yearMarkers ?? []).filter((y) => y.id !== id),
    }));
  };

  // ── Journey map ──────────────────────────────

  const addJourneyMapAfter = (photoIdx: number) => {
    const newMap = {
      id: `jm${Date.now()}`,
      afterPhotoIndex: photoIdx,
      title: "Our Journey",
      subtitle: "성모병원 · 분당 · 붉은 광장 · 서울 · 뉴욕",
      caption: "",
      durationSec: 8.0,
    };
    setConfig((c) => ({ ...c, journeyMaps: [...(c.journeyMaps ?? []), newMap] }));
  };
  const updateJourneyMap = (id: string, patch: Partial<{ title: string; subtitle: string; caption: string; durationSec: number }>) => {
    setConfig((c) => ({
      ...c,
      journeyMaps: (c.journeyMaps ?? []).map((m) => m.id === id ? { ...m, ...patch } : m),
    }));
  };
  const deleteJourneyMap = (id: string) => {
    setConfig((c) => ({ ...c, journeyMaps: (c.journeyMaps ?? []).filter((m) => m.id !== id) }));
  };

  // ── Letter interlude ─────────────────────────

  const addLetterAfter = (photoIdx: number) => {
    const newLetter = {
      id: `li${Date.now()}`,
      afterPhotoIndex: photoIdx,
      date: "2020년 봄",
      l1: "그날의 햇살",
      l2: "우리가 처음 만난 그날",
      durationSec: 8.0,
    };
    setConfig((c) => ({ ...c, letterInterludes: [...(c.letterInterludes ?? []), newLetter] }));
  };
  const updateLetter = (id: string, patch: Partial<{ date: string; l1: string; l2: string; durationSec: number }>) => {
    setConfig((c) => ({
      ...c,
      letterInterludes: (c.letterInterludes ?? []).map((l) => l.id === id ? { ...l, ...patch } : l),
    }));
  };
  const deleteLetter = (id: string) => {
    setConfig((c) => ({ ...c, letterInterludes: (c.letterInterludes ?? []).filter((l) => l.id !== id) }));
  };

  // ── Collage ──────────────────────────────────

  const addCollageAfter = (photoIdx: number) => {
    // Pre-populate with 7 empty slots; user fills in with existing photo URLs
    const newCollage = {
      id: `col${Date.now()}`,
      afterPhotoIndex: photoIdx,
      slots: Array.from({ length: 7 }, () => ({ file: "", caption: "" })),
      durationSec: 6.0,
    };
    setConfig((c) => ({ ...c, collages: [...(c.collages ?? []), newCollage] }));
  };
  const updateCollageSlot = (id: string, slotIdx: number, patch: Partial<{ file: string; caption: string }>) => {
    setConfig((c) => ({
      ...c,
      collages: (c.collages ?? []).map((col) =>
        col.id === id
          ? { ...col, slots: col.slots.map((s, i) => i === slotIdx ? { ...s, ...patch } : s) }
          : col
      ),
    }));
  };
  const updateCollage = (id: string, patch: Partial<{ durationSec: number }>) => {
    setConfig((c) => ({
      ...c,
      collages: (c.collages ?? []).map((col) => col.id === id ? { ...col, ...patch } : col),
    }));
  };
  const deleteCollage = (id: string) => {
    setConfig((c) => ({ ...c, collages: (c.collages ?? []).filter((col) => col.id !== id) }));
  };

  // ── AI prompt edit ──────────────────────────

  const handleAiEdit = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    const result = await aiEditConfig(config, aiPrompt.trim());
    if (result) {
      setConfig(result);
      setAiPrompt("");
    } else {
      alert("AI 수정에 실패했습니다. 다시 시도해주세요.");
    }
    setAiLoading(false);
  };

  // ── group photos by act ─────────────────────

  const photosByAct: Record<number, { photo: PhotoEntry; idx: number }[]> = {};
  config.photos.forEach((photo, idx) => {
    (photosByAct[photo.act] ??= []).push({ photo, idx });
  });
  const acts = Object.keys(photosByAct).map(Number).sort((a, b) => a - b);

  // ── render ──────────────────────────────────

  if (loading) {
    return (
      <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#e8d09b", fontSize: 18 }}>불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">식전영상 에디터</h1>
        <div className="header-info">
          {Math.floor(totalSec / 60)}분 {Math.round(totalSec % 60)}초 &middot; {config.photos.length}장 &middot; {acts.length} Acts
          {saveStatus === "saving" && <span className="save-dot saving">저장 중...</span>}
          {saveStatus === "saved" && <span className="save-dot saved">저장 완료</span>}
          {saveStatus === "idle" && <span className="save-dot idle">자동 저장</span>}
        </div>
        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "라이트 모드로" : "다크 모드로"}
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <button className="btn btn-save" onClick={() => {
            setSaveStatus("saving");
            saveConfig(config).then((ok) => {
              setSaveStatus(ok ? "saved" : "idle");
              if (ok) setTimeout(() => setSaveStatus("idle"), 2000);
            });
          }}>💾 저장</button>
          <button className="btn btn-ghost" onClick={resetConfig}>초기화</button>
        </div>
      </header>

      <div className="main">
        <div className="player-wrap">
          <Player
            ref={playerRef}
            component={MainVideo}
            inputProps={config}
            durationInFrames={Math.max(1, totalFrames)}
            fps={config.fps}
            compositionWidth={1920}
            compositionHeight={1080}
            style={{ width: "100%", borderRadius: 8, overflow: "hidden" }}
            controls
            autoPlay={false}
          />
          <div className="ai-bar">
            <input
              className="ai-input"
              placeholder="예: 두 사람 사진 전부 4초로, Act 3 제목 바꿔줘..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAiEdit(); }}
              disabled={aiLoading}
            />
            <button className="btn btn-primary ai-btn" onClick={handleAiEdit} disabled={aiLoading || !aiPrompt.trim()}>
              {aiLoading ? "적용 중..." : "AI 적용"}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-tabs">
            <button className={`panel-tab ${panelTab === "edit" ? "panel-tab--active" : ""}`} onClick={() => setPanelTab("edit")}>편집</button>
            <button className={`panel-tab ${panelTab === "assets" ? "panel-tab--active" : ""}`} onClick={() => setPanelTab("assets")}>에셋</button>
          </div>

          {panelTab === "assets" && (
            <div className="assets-panel">
              {/* Target selector */}
              {/* Global video style settings */}
              <div className="asset-group">
                <h4 className="asset-group-title">영상 전체 스타일</h4>
                <div className="field-row" style={{ flexDirection: "column", gap: 8 }}>
                  <label className="field">
                    <span className="field-label">배경 스타일</span>
                    <select className="select" value={config.backgroundStyle}
                      onChange={(e) => setConfig((c) => ({ ...c, backgroundStyle: e.target.value as BackgroundStyle }))}>
                      {BACKGROUND_STYLES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">타이틀 카드 스타일 (기본)</span>
                    <select className="select" value={config.titleVariant}
                      onChange={(e) => setConfig((c) => ({ ...c, titleVariant: e.target.value as TitleVariant }))}>
                      {TITLE_VARIANTS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </label>
                  <label className="slider-label" style={{ width: "100%" }}>
                    <span>Ken Burns 세기: {(config.kenBurnsAmount * 100).toFixed(0)}%</span>
                    <input type="range" className="slider" min={0} max={0.12} step={0.01}
                      value={config.kenBurnsAmount}
                      onChange={(e) => setConfig((c) => ({ ...c, kenBurnsAmount: parseFloat(e.target.value) }))} />
                  </label>
                </div>
              </div>

              <div className="asset-group asset-target-group">
                <h4 className="asset-group-title">적용 대상</h4>
                <div className="target-tabs">
                  <button className={`target-tab ${assetTarget === "current" ? "target-tab--active" : ""}`}
                    onClick={() => setAssetTarget("current")}>현재 사진</button>
                  <button className={`target-tab ${assetTarget === "global" ? "target-tab--active" : ""}`}
                    onClick={() => setAssetTarget("global")}>전체 영상</button>
                </div>
                {assetTarget === "current" && (
                  <div className="current-photo-preview">
                    {currentPhoto ? (
                      <>
                        <img src={photoSrc(currentPhoto.file)} alt={currentPhoto.tag} />
                        <div className="current-photo-info">
                          <div className="current-photo-tag">{currentPhoto.tag}</div>
                          <div className="current-photo-hint">아래 에셋 클릭하면 이 사진에만 적용됩니다</div>
                        </div>
                      </>
                    ) : (
                      <div className="current-photo-empty">
                        타이틀 / 엔딩 구간입니다.<br />
                        사진 구간으로 이동해주세요.
                      </div>
                    )}
                  </div>
                )}
                {assetTarget === "global" && (
                  <div className="target-hint">영상 전체에 적용됩니다 (기본값)</div>
                )}
              </div>

              {/* Frame */}
              <div className="asset-group">
                <h4 className="asset-group-title">프레임</h4>
                <div className="asset-options">
                  {FRAMES.map((f) => {
                    const active = assetTarget === "global"
                      ? config.frame === f.value
                      : currentPhoto?.frameOverride === f.value;
                    const disabled = assetTarget === "current" && !currentPhoto;
                    return (
                      <button key={f.value} className={`asset-chip ${active ? "asset-chip--active" : ""}`}
                        disabled={disabled}
                        onClick={() => {
                          if (assetTarget === "global") {
                            setConfig((c) => ({ ...c, frame: f.value }));
                          } else if (currentPhotoIdx !== null) {
                            updatePhoto(currentPhotoIdx, { frameOverride: f.value });
                          }
                        }}>{f.label}</button>
                    );
                  })}
                  {assetTarget === "current" && currentPhoto?.frameOverride !== undefined && (
                    <button className="asset-chip asset-chip--reset"
                      onClick={() => currentPhotoIdx !== null && updatePhoto(currentPhotoIdx, { frameOverride: undefined })}>
                      기본값으로
                    </button>
                  )}
                </div>
              </div>

              {/* Overlay */}
              <div className="asset-group">
                <h4 className="asset-group-title">오버레이</h4>
                <div className="asset-options">
                  {OVERLAYS.map((o) => {
                    const active = assetTarget === "global"
                      ? config.overlay === o.value
                      : currentPhoto?.overlayOverride === o.value;
                    const disabled = assetTarget === "current" && !currentPhoto;
                    return (
                      <button key={o.value} className={`asset-chip ${active ? "asset-chip--active" : ""}`}
                        disabled={disabled}
                        onClick={() => {
                          if (assetTarget === "global") {
                            setConfig((c) => ({ ...c, overlay: o.value }));
                          } else if (currentPhotoIdx !== null) {
                            updatePhoto(currentPhotoIdx, { overlayOverride: o.value });
                          }
                        }}>{o.label}</button>
                    );
                  })}
                  {assetTarget === "current" && currentPhoto?.overlayOverride !== undefined && (
                    <button className="asset-chip asset-chip--reset"
                      onClick={() => currentPhotoIdx !== null && updatePhoto(currentPhotoIdx, { overlayOverride: undefined })}>
                      기본값으로
                    </button>
                  )}
                </div>
              </div>

              {/* Particles */}
              <div className="asset-group">
                <h4 className="asset-group-title">파티클</h4>
                <div className="asset-options">
                  {PARTICLES.map((p) => {
                    const active = assetTarget === "global"
                      ? config.particles === p.value
                      : currentPhoto?.particlesOverride === p.value;
                    const disabled = assetTarget === "current" && !currentPhoto;
                    return (
                      <button key={p.value} className={`asset-chip ${active ? "asset-chip--active" : ""}`}
                        disabled={disabled}
                        onClick={() => {
                          if (assetTarget === "global") {
                            setConfig((c) => ({ ...c, particles: p.value }));
                          } else if (currentPhotoIdx !== null) {
                            updatePhoto(currentPhotoIdx, { particlesOverride: p.value });
                          }
                        }}>{p.label}</button>
                    );
                  })}
                  {assetTarget === "current" && currentPhoto?.particlesOverride !== undefined && (
                    <button className="asset-chip asset-chip--reset"
                      onClick={() => currentPhotoIdx !== null && updatePhoto(currentPhotoIdx, { particlesOverride: undefined })}>
                      기본값으로
                    </button>
                  )}
                </div>
              </div>

              {/* BGM (always global) */}
              <div className="asset-group">
                <h4 className="asset-group-title">BGM (전체)</h4>
                {config.bgmUrl ? (
                  <div className="bgm-row">
                    <span className="bgm-name">BGM 적용됨</span>
                    <button className="btn-icon btn-icon--danger" onClick={() => setConfig((c) => ({ ...c, bgmUrl: undefined }))}>&#10005;</button>
                  </div>
                ) : (
                  <button className="btn btn-upload" onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "audio/*";
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      const url = await uploadPhoto(file);
                      if (url) setConfig((c) => ({ ...c, bgmUrl: url }));
                    };
                    input.click();
                  }}>+ BGM 업로드</button>
                )}
              </div>
            </div>
          )}

          {panelTab === "edit" && acts.map((act, actIdx) => {
            const open = openActs.has(act);
            const title = config.actTitles[act];
            const actPhotos = photosByAct[act] ?? [];
            const nextAct = acts[actIdx + 1];
            return (
              <section key={act} className="section">
                <div className="section-header" onClick={() => toggleAct(act)}>
                  <span className="section-badge">Act {ROMAN[act] ?? act}</span>
                  <span className="section-title">{title?.kr}</span>
                  <span className="section-count">{actPhotos.length}장</span>
                  {nextAct !== undefined && (
                    <button
                      className="btn-merge"
                      title={`Act ${ROMAN[nextAct] ?? nextAct}과 합치기`}
                      onClick={(e) => { e.stopPropagation(); mergeActWithNext(act, nextAct); }}
                    >
                      합치기
                    </button>
                  )}
                  <span className="section-arrow">{open ? "\u25B2" : "\u25BC"}</span>
                </div>
                {open && (
                  <div className="section-body">
                    <div className="field-row">
                      <label className="field">
                        <span className="field-label">챕터</span>
                        <input className="input" value={title?.chapter ?? ""} onChange={(e) => updateTitle(act, { chapter: e.target.value })} />
                      </label>
                      <label className="field">
                        <span className="field-label">부제</span>
                        <input className="input" value={title?.kr ?? ""} onChange={(e) => updateTitle(act, { kr: e.target.value })} />
                      </label>
                    </div>
                    <label className="field">
                      <span className="field-label">타이틀 스타일 (이 Act만)</span>
                      <select className="select" value={title?.variant ?? ""}
                        onChange={(e) => updateTitle(act, { variant: e.target.value ? e.target.value as TitleVariant : undefined })}>
                        <option value="">전체 설정 따름</option>
                        {TITLE_VARIANTS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                      </select>
                    </label>

                    <button className="btn btn-upload" onClick={() => handlePhotoUpload(act)}>
                      + 사진 추가
                    </button>

                    {actPhotos.map(({ photo, idx }, localIdx) => (
                      <div key={idx} className="photo-card">
                        <div className="thumb-wrap" onClick={() => setEditorTarget(idx)} title="이미지 편집">
                          <img src={photoSrc(photo.file)} alt={photo.tag} className="photo-thumb" />
                          <div className="focal-dot" style={{ left: `${photo.focalPoint.x * 100}%`, top: `${photo.focalPoint.y * 100}%` }} />
                          {(photo.spotlights?.length ?? 0) > 0 && (
                            <div className="spot-badge">{photo.spotlights?.length}</div>
                          )}
                          <div className="thumb-hint">편집</div>
                        </div>
                        <div className="photo-body">
                          <div className="photo-row-top">
                            <span className="photo-tag">
                              {(() => {
                                const isLeft = !!photo.splitPair;
                                const prev = localIdx > 0 ? actPhotos[localIdx - 1] : null;
                                const isRight = !isLeft && prev?.photo.splitPair === true;
                                if (isLeft) return <button className="pair-badge pair-badge--paired" onClick={() => toggleSplitPair(idx)} title="클릭해서 짝 해제">↔ 좌</button>;
                                if (isRight) return <button className="pair-badge pair-badge--paired" onClick={() => prev && toggleSplitPair(prev.idx)} title="클릭해서 짝 해제">↔ 우</button>;
                                // Unpaired — offer pair with next (if same act)
                                const next = localIdx < actPhotos.length - 1 ? actPhotos[localIdx + 1] : null;
                                if (next) {
                                  return <button className="pair-badge pair-badge--unpaired" onClick={() => toggleSplitPair(idx)} title="다음 사진과 좌우 분할로 짝짓기">+ 짝</button>;
                                }
                                return null;
                              })()}
                              {photo.tag}
                            </span>
                            <div className="photo-actions">
                              <select className="select select-act" value={photo.act}
                                onChange={(e) => updatePhoto(idx, { act: Number(e.target.value) })}
                                title="Act 이동">
                                {acts.map((a) => <option key={a} value={a}>Act {ROMAN[a] ?? a}</option>)}
                              </select>
                              <button className="btn-icon" onClick={() => movePhoto(idx, -1)} disabled={localIdx === 0}>&#9650;</button>
                              <button className="btn-icon" onClick={() => movePhoto(idx, 1)} disabled={localIdx === actPhotos.length - 1}>&#9660;</button>
                              <button className="btn-icon btn-icon--danger" onClick={() => { if (confirm(`"${photo.tag}" 삭제?`)) deletePhoto(idx); }}>&#10005;</button>
                            </div>
                          </div>
                          <div className="photo-controls">
                            <label className="slider-label">
                              <span>{photo.durationSec.toFixed(1)}초</span>
                              <input type="range" className="slider" min={0.3} max={8} step={0.1} value={photo.durationSec}
                                onChange={(e) => updatePhoto(idx, { durationSec: parseFloat(e.target.value) })} />
                            </label>
                          </div>
                          <div className="photo-controls">
                            <select className="select" value={photo.effect} onChange={(e) => updatePhoto(idx, { effect: e.target.value as Effect })}>
                              {EFFECTS.map((ef) => <option key={ef.value} value={ef.value}>{ef.label}</option>)}
                            </select>
                            <select className="select" value={photo.transition} onChange={(e) => updatePhoto(idx, { transition: e.target.value as TransitionType })}>
                              {TRANSITIONS.map((tr) => <option key={tr.value} value={tr.value}>{tr.label}</option>)}
                            </select>
                            <select className="select" value={photo.filter} onChange={(e) => updatePhoto(idx, { filter: e.target.value as FilterType })}>
                              {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </div>
                          {photo.splitPair && (
                            <div className="photo-controls">
                              <select className="select" title="좌우 분할 스타일"
                                value={photo.splitStyle ?? "standard"}
                                onChange={(e) => updatePhoto(idx, { splitStyle: e.target.value as SplitStyle })}>
                                {SPLIT_STYLES.map((s) => <option key={s.value} value={s.value}>페어: {s.label}</option>)}
                              </select>
                              {(photo.splitStyle === "polaroid" || photo.splitStyle === "cameo") && (
                                <>
                                  <input
                                    className="input input-sm"
                                    placeholder="왼쪽 라벨"
                                    value={photo.splitLabel ?? ""}
                                    onChange={(e) => updatePhoto(idx, { splitLabel: e.target.value })}
                                    title="폴라로이드/카메오 왼쪽 사진 하단 텍스트 (빈 칸이면 태그 첫 단어 사용)"
                                  />
                                  {config.photos[idx + 1] && (
                                    <input
                                      className="input input-sm"
                                      placeholder="오른쪽 라벨"
                                      value={config.photos[idx + 1].splitLabel ?? ""}
                                      onChange={(e) => updatePhoto(idx + 1, { splitLabel: e.target.value })}
                                      title="오른쪽 사진 하단 텍스트"
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          <div className="caption-row">
                            {photo.caption ? (
                              <>
                                <input className="input input-sm" placeholder="캡션 텍스트" value={photo.caption.text}
                                  onChange={(e) => updateCaption(idx, { text: e.target.value })} />
                                <select className="select select-sm" value={photo.caption.position}
                                  onChange={(e) => updateCaption(idx, { position: e.target.value as "top" | "bottom" | "center" })}>
                                  <option value="top">상단</option>
                                  <option value="center">중앙</option>
                                  <option value="bottom">하단</option>
                                </select>
                                <button className="btn-icon btn-icon--danger" onClick={() => updateCaption(idx, null)}>&#10005;</button>
                              </>
                            ) : (
                              <button className="btn btn-xs" onClick={() => updateCaption(idx, { text: "", position: "bottom" })}>+ 캡션</button>
                            )}
                          </div>
                          {/* Moment cards attached to this photo (inserted BEFORE next photo) */}
                          {(config.moments ?? []).filter((m) => m.afterPhotoIndex === idx).map((m) => (
                            <div key={m.id} className="moment-editor">
                              <div className="moment-editor-header">
                                <span className="moment-editor-label">이때 모먼트 (다음 사진 직전 삽입)</span>
                                <button className="btn-icon btn-icon--danger" onClick={() => deleteMoment(m.id)}>&#10005;</button>
                              </div>
                              <input className="input input-sm" placeholder="1행 (얇게)" value={m.l1}
                                onChange={(e) => updateMoment(m.id, { l1: e.target.value })} />
                              <input className="input input-sm" placeholder="2행 (굵게)" value={m.l2}
                                onChange={(e) => updateMoment(m.id, { l2: e.target.value })} />
                              <div style={{ display: "flex", gap: 6 }}>
                                <input className="input input-sm" placeholder="연도/태그" value={m.year}
                                  onChange={(e) => updateMoment(m.id, { year: e.target.value })} style={{ flex: 2 }} />
                                <input className="input input-sm" type="number" step="0.5" min="1" max="5"
                                  value={m.durationSec ?? 2.0}
                                  onChange={(e) => updateMoment(m.id, { durationSec: parseFloat(e.target.value) })}
                                  style={{ flex: 1 }} title="지속(초)" />
                              </div>
                            </div>
                          ))}
                          {/* Year markers attached to this photo (inserted BEFORE next photo) */}
                          {(config.yearMarkers ?? []).filter((y) => y.afterPhotoIndex === idx).map((y) => (
                            <div key={y.id} className="moment-editor" style={{ borderColor: "#9f7a3a" }}>
                              <div className="moment-editor-header">
                                <span className="moment-editor-label" style={{ color: "#c79a52" }}>연도 마커 (다음 사진 직전)</span>
                                <button className="btn-icon btn-icon--danger" onClick={() => deleteYearMarker(y.id)}>&#10005;</button>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <input className="input input-sm" placeholder="연도" value={y.year}
                                  onChange={(e) => updateYearMarker(y.id, { year: e.target.value })} style={{ flex: 1 }} />
                                <input className="input input-sm" placeholder="장소" value={y.location}
                                  onChange={(e) => updateYearMarker(y.id, { location: e.target.value })} style={{ flex: 2 }} />
                                <input className="input input-sm" type="number" step="0.5" min="1.5" max="6"
                                  value={y.durationSec ?? 3.0}
                                  onChange={(e) => updateYearMarker(y.id, { durationSec: parseFloat(e.target.value) })}
                                  style={{ flex: 1 }} title="지속(초)" />
                              </div>
                            </div>
                          ))}
                          {/* Journey map editor */}
                          {(config.journeyMaps ?? []).filter((m) => m.afterPhotoIndex === idx).map((m) => (
                            <div key={m.id} className="moment-editor" style={{ borderColor: "#5a7a8a" }}>
                              <div className="moment-editor-header">
                                <span className="moment-editor-label" style={{ color: "#6a8aa0" }}>여정 지도 (다음 사진 직전)</span>
                                <button className="btn-icon btn-icon--danger" onClick={() => deleteJourneyMap(m.id)}>&#10005;</button>
                              </div>
                              <input className="input input-sm" placeholder="상단 영문 제목" value={m.title ?? ""}
                                onChange={(e) => updateJourneyMap(m.id, { title: e.target.value })} />
                              <input className="input input-sm" placeholder="한글 부제" value={m.subtitle ?? ""}
                                onChange={(e) => updateJourneyMap(m.id, { subtitle: e.target.value })} />
                              <input className="input input-sm" placeholder="하단 캡션 (이탤릭)" value={m.caption ?? ""}
                                onChange={(e) => updateJourneyMap(m.id, { caption: e.target.value })} />
                            </div>
                          ))}
                          {/* Letter interlude editor */}
                          {(config.letterInterludes ?? []).filter((l) => l.afterPhotoIndex === idx).map((l) => (
                            <div key={l.id} className="moment-editor" style={{ borderColor: "#7a5a3a" }}>
                              <div className="moment-editor-header">
                                <span className="moment-editor-label" style={{ color: "#b08a5a" }}>편지 인터루드 (다음 사진 직전)</span>
                                <button className="btn-icon btn-icon--danger" onClick={() => deleteLetter(l.id)}>&#10005;</button>
                              </div>
                              <input className="input input-sm" placeholder="날짜 (예: 2019년 겨울)" value={l.date}
                                onChange={(e) => updateLetter(l.id, { date: e.target.value })} />
                              <input className="input input-sm" placeholder="1행" value={l.l1}
                                onChange={(e) => updateLetter(l.id, { l1: e.target.value })} />
                              <input className="input input-sm" placeholder="2행" value={l.l2}
                                onChange={(e) => updateLetter(l.id, { l2: e.target.value })} />
                            </div>
                          ))}
                          {/* Collage editor */}
                          {(config.collages ?? []).filter((c) => c.afterPhotoIndex === idx).map((col) => (
                            <div key={col.id} className="moment-editor" style={{ borderColor: "#7a3a5a" }}>
                              <div className="moment-editor-header">
                                <span className="moment-editor-label" style={{ color: "#b05a80" }}>폴라로이드 콜라주 ({col.slots.length}장)</span>
                                <button className="btn-icon btn-icon--danger" onClick={() => deleteCollage(col.id)}>&#10005;</button>
                              </div>
                              {col.slots.map((slot, si) => (
                                <div key={si} style={{ display: "flex", gap: 4 }}>
                                  <input className="input input-sm" placeholder={`사진 ${si+1} URL`} value={slot.file}
                                    onChange={(e) => updateCollageSlot(col.id, si, { file: e.target.value })}
                                    style={{ flex: 3 }} />
                                  <input className="input input-sm" placeholder="캡션" value={slot.caption ?? ""}
                                    onChange={(e) => updateCollageSlot(col.id, si, { caption: e.target.value })}
                                    style={{ flex: 2 }} />
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: 4 }}>
                                <input className="input input-sm" type="number" step="0.5" min="3" max="12"
                                  value={col.durationSec ?? 6.0}
                                  onChange={(e) => updateCollage(col.id, { durationSec: parseFloat(e.target.value) })}
                                  style={{ flex: 1 }} title="지속(초)" />
                              </div>
                            </div>
                          ))}
                          {/* Era icon selector for THIS photo */}
                          <div style={{ marginTop: 8, display: "flex", gap: 4, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 60 }}>시대 심볼</span>
                            <select className="select select-sm" value={photo.eraIcon ?? ""}
                              onChange={(e) => updatePhoto(idx, { eraIcon: e.target.value || undefined })}
                              style={{ flex: 2 }}>
                              <option value="">없음</option>
                              {Object.keys(ERA_ICONS).map((k) => (
                                <option key={k} value={k}>{ERA_ICON_LABELS[k] ?? k}</option>
                              ))}
                            </select>
                            <select className="select select-sm" value={photo.eraIconPosition ?? "tr"}
                              onChange={(e) => updatePhoto(idx, { eraIconPosition: e.target.value as "tl" | "tr" | "bl" | "br" })}
                              style={{ flex: 1 }}
                              disabled={!photo.eraIcon}>
                              <option value="tl">↖</option>
                              <option value="tr">↗</option>
                              <option value="bl">↙</option>
                              <option value="br">↘</option>
                            </select>
                          </div>
                          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                            <button className="btn btn-xs btn-moment-add" onClick={() => addMomentAfter(idx)} title="이 사진 다음에 '이때' 모먼트 카드 삽입" style={{ flex: 1, minWidth: 80 }}>+ 모먼트</button>
                            <button className="btn btn-xs btn-moment-add" onClick={() => addYearMarkerAfter(idx)} title="연도 마커 삽입" style={{ flex: 1, minWidth: 80 }}>+ 연도</button>
                            <button className="btn btn-xs btn-moment-add" onClick={() => addJourneyMapAfter(idx)} title="여정 지도 삽입" style={{ flex: 1, minWidth: 80 }}>+ 지도</button>
                            <button className="btn btn-xs btn-moment-add" onClick={() => addLetterAfter(idx)} title="편지 인터루드 삽입" style={{ flex: 1, minWidth: 80 }}>+ 편지</button>
                            <button className="btn btn-xs btn-moment-add" onClick={() => addCollageAfter(idx)} title="폴라로이드 콜라주 삽입" style={{ flex: 1, minWidth: 80 }}>+ 콜라주</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {panelTab === "edit" && <section className="section">
            <div className="section-header section-header--ending" onClick={() => setOpenEnding(!openEnding)}>
              <span className="section-badge">엔딩</span>
              <span className="section-title">{config.ending.date}</span>
              <span className="section-arrow">{openEnding ? "\u25B2" : "\u25BC"}</span>
            </div>
            {openEnding && (
              <div className="section-body">
                <label className="field"><span className="field-label">날짜</span>
                  <input className="input" value={config.ending.date} onChange={(e) => updateEnding({ date: e.target.value })} /></label>
                <label className="field"><span className="field-label">신랑 이름</span>
                  <input className="input" value={config.ending.groomName} onChange={(e) => updateEnding({ groomName: e.target.value })} /></label>
                <label className="field"><span className="field-label">신부 이름</span>
                  <input className="input" value={config.ending.brideName} onChange={(e) => updateEnding({ brideName: e.target.value })} /></label>
                <label className="field"><span className="field-label">감사 메시지</span>
                  <input className="input" value={config.ending.message} onChange={(e) => updateEnding({ message: e.target.value })} /></label>
              </div>
            )}
          </section>}
        </div>
      </div>

      {/* Filmstrip (bottom) */}
      <div className="filmstrip">
        {config.photos.map((p, i) => (
          <div
            key={i}
            className={`filmstrip-item ${currentPhotoIdx === i ? "filmstrip-item--active" : ""}`}
            onClick={() => {
              const frame = getPhotoStartFrame(i, config);
              const p = playerRef.current;
              if (p) {
                p.pause();
                p.seekTo(frame);
              }
            }}
            title={p.tag}
          >
            <img src={photoSrc(p.file)} alt={p.tag} />
            <div className="filmstrip-label">{i + 1}</div>
          </div>
        ))}
      </div>

      {editorTarget !== null && config.photos[editorTarget] && (
        <ImageEditorModal
          photo={config.photos[editorTarget]}
          kenBurnsAmount={config.kenBurnsAmount}
          onUpdatePhoto={(patch) => updatePhoto(editorTarget, patch)}
          onUpdateKenBurnsAmount={(val) => setConfig((c) => ({ ...c, kenBurnsAmount: val }))}
          onClose={() => setEditorTarget(null)}
        />
      )}
    </div>
  );
};
