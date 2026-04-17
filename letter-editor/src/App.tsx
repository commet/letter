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
  CaptionConfig,
  SpotlightConfig,
  defaultConfig,
  computeTotalFrames,
} from "./data";
import { loadConfig, saveConfig, uploadPhoto, aiEditConfig } from "./supabase";

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

// ─── Image Editor Modal ──────────────────────

type EditorMode = "focal" | "spotlight";

const ImageEditorModal: React.FC<{
  photo: PhotoEntry;
  onUpdatePhoto: (patch: Partial<PhotoEntry>) => void;
  onClose: () => void;
}> = ({ photo, onUpdatePhoto, onClose }) => {
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
              </>
            )}

            {mode === "spotlight" && (
              <>
                <p className="hint">이미지를 클릭하면 강조 영역이 추가됩니다.<br />해당 영역만 밝고, 나머지는 어두워집니다.</p>
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
            {mode === "focal" ? "클릭 = 포커스 지정" : "클릭 = 강조 추가"}
          </span>
          <button className="btn btn-primary" onClick={onClose}>확인</button>
        </div>
      </div>
    </div>
  );
};

// ─── App ─────────────────────────────────────

export const App: React.FC = () => {
  const [config, setConfig] = useState<VideoConfig>(defaultConfig);
  const [openActs, setOpenActs] = useState<Set<number>>(new Set());
  const [openEnding, setOpenEnding] = useState(false);
  const [editorTarget, setEditorTarget] = useState<number | null>(null);
  const [panelTab, setPanelTab] = useState<"edit" | "assets">("edit");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as "dark" | "light") ?? "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstSave = useRef(true);

  const totalFrames = computeTotalFrames(config);
  const totalSec = totalFrames / config.fps;

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
          <button className="btn btn-primary" onClick={() => {
            setSaveStatus("saving");
            saveConfig(config).then((ok) => {
              setSaveStatus(ok ? "saved" : "idle");
              if (ok) setTimeout(() => setSaveStatus("idle"), 2000);
            });
          }}>저장</button>
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
              <div className="asset-group">
                <h4 className="asset-group-title">오버레이</h4>
                <div className="asset-options">
                  {OVERLAYS.map((o) => (
                    <button key={o.value} className={`asset-chip ${config.overlay === o.value ? "asset-chip--active" : ""}`}
                      onClick={() => setConfig((c) => ({ ...c, overlay: o.value }))}>{o.label}</button>
                  ))}
                </div>
              </div>
              <div className="asset-group">
                <h4 className="asset-group-title">파티클</h4>
                <div className="asset-options">
                  {PARTICLES.map((p) => (
                    <button key={p.value} className={`asset-chip ${config.particles === p.value ? "asset-chip--active" : ""}`}
                      onClick={() => setConfig((c) => ({ ...c, particles: p.value }))}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div className="asset-group">
                <h4 className="asset-group-title">프레임</h4>
                <div className="asset-options">
                  {FRAMES.map((f) => (
                    <button key={f.value} className={`asset-chip ${config.frame === f.value ? "asset-chip--active" : ""}`}
                      onClick={() => setConfig((c) => ({ ...c, frame: f.value }))}>{f.label}</button>
                  ))}
                </div>
              </div>
              <div className="asset-group">
                <h4 className="asset-group-title">BGM</h4>
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
                              {photo.splitPair && <span className="pair-badge pair-badge--left" title="다음 사진과 좌우 분할">← 좌</span>}
                              {localIdx > 0 && actPhotos[localIdx - 1].photo.splitPair && <span className="pair-badge pair-badge--right" title="이전 사진과 좌우 분할">우 →</span>}
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
                          <div className="photo-controls photo-controls--assets">
                            <select className="select select-sm" title="프레임"
                              value={photo.frameOverride ?? ""}
                              onChange={(e) => updatePhoto(idx, { frameOverride: e.target.value ? e.target.value as FrameType : undefined })}>
                              <option value="">프레임 (기본)</option>
                              {FRAMES.map((f) => <option key={f.value} value={f.value}>프레임: {f.label}</option>)}
                            </select>
                            <select className="select select-sm" title="오버레이"
                              value={photo.overlayOverride ?? ""}
                              onChange={(e) => updatePhoto(idx, { overlayOverride: e.target.value ? e.target.value as OverlayType : undefined })}>
                              <option value="">오버레이 (기본)</option>
                              {OVERLAYS.map((o) => <option key={o.value} value={o.value}>오버레이: {o.label}</option>)}
                            </select>
                            <select className="select select-sm" title="파티클"
                              value={photo.particlesOverride ?? ""}
                              onChange={(e) => updatePhoto(idx, { particlesOverride: e.target.value ? e.target.value as ParticleType : undefined })}>
                              <option value="">파티클 (기본)</option>
                              {PARTICLES.map((p) => <option key={p.value} value={p.value}>파티클: {p.label}</option>)}
                            </select>
                          </div>
                          <div className="photo-controls">
                            <button className="btn-xs" onClick={() => toggleSplitPair(idx)}
                              title={photo.splitPair ? "다음 사진과의 짝 해제" : "다음 사진과 좌우 분할로 표시"}>
                              {photo.splitPair ? "↔ 짝 해제" : "↔ 다음 사진과 분할"}
                            </button>
                          </div>
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

      {editorTarget !== null && config.photos[editorTarget] && (
        <ImageEditorModal
          photo={config.photos[editorTarget]}
          onUpdatePhoto={(patch) => updatePhoto(editorTarget, patch)}
          onClose={() => setEditorTarget(null)}
        />
      )}
    </div>
  );
};
