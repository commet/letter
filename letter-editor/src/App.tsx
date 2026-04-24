import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
  CaptionEntry,
  CaptionFont,
  CaptionAlign,
  CaptionBackground,
  CAPTION_FONT_STACK,
  resolveCaptionBgKind,
  SpotlightConfig,
  CropRect,
  PopoutRegion,
  AnnotationArrow,
  ArrowStyle,
  ArrowColor,
  ARROW_COLOR_MAP,
  ARROW_COLOR_LABELS,
  JourneyMap,
  ChatInterlude,
  ChatMessage,
  defaultConfig,
  computeTotalFrames,
  getPhotoIndexAtFrame,
  getPhotoStartFrame,
} from "./data";
import { buildArrowPath, arrowStroke, arrowHeadPath, arrowNeedsOutline, ARROW_OUTLINE_COLOR, ARROW_PRESETS, type ArrowPreset } from "./arrow";
import { loadConfig, saveConfig, uploadPhoto, aiEditConfig } from "./supabase";
import type { Comment, NewCommentInput } from "./supabase";
import { useDisplayIdentity, useEditorChannel, useComments, type PresenceUser } from "./realtime";
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

type EditorMode = "focal" | "spotlight" | "crop" | "arrow" | "caption" | "popout";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MIN_CROP = 0.1; // minimum width/height of crop rect

const ImageEditorModal: React.FC<{
  photo: PhotoEntry;
  kenBurnsAmount: number;
  initialMode?: EditorMode;
  onUpdatePhoto: (patch: Partial<PhotoEntry>) => void;
  onUpdateKenBurnsAmount: (val: number) => void;
  onClose: () => void;
}> = ({ photo, kenBurnsAmount, initialMode, onUpdatePhoto, onUpdateKenBurnsAmount, onClose }) => {
  const [mode, setMode] = useState<EditorMode>(initialMode ?? "focal");
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Crop state
  const crop: CropRect = photo.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const [cropAspect, setCropAspect] = useState<number | null>(null); // null = 자유, else w/h ratio
  const dragRef = useRef<
    | null
    | {
        handle: "tl" | "tr" | "bl" | "br" | "body";
        startCrop: CropRect;
        startClientX: number;
        startClientY: number;
        containerW: number;
        containerH: number;
      }
  >(null);

  const setCrop = (c: CropRect) => {
    const next: CropRect = {
      x: clamp(c.x, 0, 1 - MIN_CROP),
      y: clamp(c.y, 0, 1 - MIN_CROP),
      w: clamp(c.w, MIN_CROP, 1 - c.x),
      h: clamp(c.h, MIN_CROP, 1 - c.y),
    };
    onUpdatePhoto({ crop: next.w >= 0.999 && next.h >= 0.999 && next.x < 0.001 && next.y < 0.001 ? undefined : next });
  };

  const beginCropDrag = (
    handle: "tl" | "tr" | "bl" | "br" | "body",
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    dragRef.current = {
      handle,
      startCrop: { ...crop },
      startClientX: e.clientX,
      startClientY: e.clientY,
      containerW: rect.width,
      containerH: rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCropPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / d.containerW;
    const dy = (e.clientY - d.startClientY) / d.containerH;
    let { x, y, w, h } = d.startCrop;

    if (d.handle === "body") {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - h);
    } else {
      // corner drag
      let nx = x, ny = y, nw = w, nh = h;
      if (d.handle === "tl" || d.handle === "bl") {
        nx = clamp(x + dx, 0, x + w - MIN_CROP);
        nw = w + (x - nx);
      }
      if (d.handle === "tr" || d.handle === "br") {
        nw = clamp(w + dx, MIN_CROP, 1 - x);
      }
      if (d.handle === "tl" || d.handle === "tr") {
        ny = clamp(y + dy, 0, y + h - MIN_CROP);
        nh = h + (y - ny);
      }
      if (d.handle === "bl" || d.handle === "br") {
        nh = clamp(h + dy, MIN_CROP, 1 - y);
      }

      // aspect ratio lock
      if (cropAspect != null && imgRef.current) {
        // cropAspect is pixel aspect target (w/h). Convert to normalized aspect using image natural size.
        const imgW = imgRef.current.naturalWidth || 1;
        const imgH = imgRef.current.naturalHeight || 1;
        const targetNormW_over_H = cropAspect * (imgH / imgW);
        // Decide which side to constrain. Compare which dim was dragged more.
        if (Math.abs(dx) > Math.abs(dy)) {
          // width-driven
          nh = nw / targetNormW_over_H;
          if (nh > 1 - ny) {
            nh = 1 - ny;
            nw = nh * targetNormW_over_H;
          }
          if (d.handle === "tl" || d.handle === "tr") ny = y + h - nh;
          if (d.handle === "tl" || d.handle === "bl") nx = x + w - nw;
        } else {
          // height-driven
          nw = nh * targetNormW_over_H;
          if (nw > 1 - nx) {
            nw = 1 - nx;
            nh = nw / targetNormW_over_H;
          }
          if (d.handle === "tl" || d.handle === "bl") nx = x + w - nw;
          if (d.handle === "tl" || d.handle === "tr") ny = y + h - nh;
        }
      }
      x = nx; y = ny; w = nw; h = nh;
    }
    setCrop({ x, y, w, h });
  };

  const endCropDrag = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
  };

  const applyAspectPreset = (aspect: number | null) => {
    setCropAspect(aspect);
    if (aspect == null || !imgRef.current) return;
    // Center a crop rect with the chosen aspect
    const imgW = imgRef.current.naturalWidth || 1;
    const imgH = imgRef.current.naturalHeight || 1;
    const targetNormWoverH = aspect * (imgH / imgW);
    // Start as large as possible within image bounds
    let nw = 1, nh = 1 / targetNormWoverH;
    if (nh > 1) { nh = 1; nw = targetNormWoverH; }
    const nx = (1 - nw) / 2;
    const ny = (1 - nh) / 2;
    setCrop({ x: nx, y: ny, w: nw, h: nh });
  };

  const resetCrop = () => {
    setCropAspect(null);
    onUpdatePhoto({ crop: undefined });
  };

  // ── Annotation arrow state ──────────────────
  const annotations: AnnotationArrow[] = photo.annotations ?? [];
  const [selectedArrow, setSelectedArrow] = useState<string | null>(null);
  const [showMoreArrowColors, setShowMoreArrowColors] = useState(false);
  const arrowDragRef = useRef<
    | null
    | {
        mode: "create" | "move-tip" | "move-label";
        id: string; // id of the arrow being edited
        startClientX: number;
        startClientY: number;
        imgRectLeft: number;
        imgRectTop: number;
        imgRectW: number;
        imgRectH: number;
      }
  >(null);

  const updateArrows = (next: AnnotationArrow[]) => {
    onUpdatePhoto({ annotations: next.length > 0 ? next : undefined });
  };

  const beginArrowDrag = (
    dmode: "create" | "move-tip" | "move-label",
    id: string,
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    arrowDragRef.current = {
      mode: dmode,
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      imgRectLeft: rect.left,
      imgRectTop: rect.top,
      imgRectW: rect.width,
      imgRectH: rect.height,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onArrowPointerMove = (e: React.PointerEvent) => {
    const d = arrowDragRef.current;
    if (!d) return;
    const x = clamp((e.clientX - d.imgRectLeft) / d.imgRectW, 0, 1);
    const y = clamp((e.clientY - d.imgRectTop) / d.imgRectH, 0, 1);
    const next = annotations.map((a) => {
      if (a.id !== d.id) return a;
      if (d.mode === "create" || d.mode === "move-tip") {
        return { ...a, tipX: x, tipY: y };
      } else {
        return { ...a, labelX: x, labelY: y };
      }
    });
    updateArrows(next);
  };

  const endArrowDrag = () => {
    const d = arrowDragRef.current;
    if (!d) return;
    arrowDragRef.current = null;
    // If the newly created arrow is too small (just a click with no drag), keep default offset
    if (d.mode === "create") {
      const a = (photo.annotations ?? []).find((x) => x.id === d.id);
      if (a && Math.hypot(a.tipX - a.labelX, a.tipY - a.labelY) < 0.04) {
        // Tiny drag → place tip a bit to the right of label so arrow is visible
        const nx = clamp(a.labelX + 0.15, 0, 1);
        const ny = a.labelY;
        updateArrows(
          (photo.annotations ?? []).map((x) => x.id === d.id ? { ...x, tipX: nx, tipY: ny } : x)
        );
      }
    }
  };

  // Pointer down on empty image area → start new arrow (label at click, tip follows drag)
  const onArrowCanvasPointerDown = (e: React.PointerEvent) => {
    if (mode !== "arrow") return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    const id = `ar${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const newArrow: AnnotationArrow = {
      id,
      labelX: x, labelY: y,
      tipX: x, tipY: y, // will follow drag; on release if tiny, nudged +0.15x
      label: "",
      style: "curve",
    };
    onUpdatePhoto({ annotations: [...annotations, newArrow] });
    setSelectedArrow(id);
    // Begin the drag
    arrowDragRef.current = {
      mode: "create",
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      imgRectLeft: rect.left,
      imgRectTop: rect.top,
      imgRectW: rect.width,
      imgRectH: rect.height,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const updateArrow = (id: string, patch: Partial<AnnotationArrow>) => {
    updateArrows(annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };
  const deleteArrow = (id: string) => {
    updateArrows(annotations.filter((a) => a.id !== id));
    if (selectedArrow === id) setSelectedArrow(null);
  };

  // Drop a preset into the image center; user then drags tip/label to fine-tune.
  // Stagger successive drops so they don't land on top of each other.
  const insertArrowPreset = (preset: ArrowPreset) => {
    const n = annotations.length;
    const jitter = (n % 4) * 0.06;
    const id = `ar${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const newArrow: AnnotationArrow = {
      id,
      labelX: 0.32 + jitter,
      labelY: 0.48 + jitter,
      tipX: 0.62 + jitter,
      tipY: 0.48 + jitter,
      label: "",
      style: preset.style,
      color: preset.color,
    };
    onUpdatePhoto({ annotations: [...annotations, newArrow] });
    setSelectedArrow(id);
  };

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
    if (mode === "crop" || mode === "arrow" || mode === "caption" || mode === "popout") return; // these have their own drag handlers
    const pos = getClickPos(e);
    if (!pos) return;

    if (mode === "focal") {
      onUpdatePhoto({ focalPoint: pos });
    } else if (mode === "spotlight") {
      const newSpot: SpotlightConfig = { x: pos.x, y: pos.y, radius: 0.25, strength: 0.55 };
      onUpdatePhoto({ spotlights: [...(photo.spotlights ?? []), newSpot] });
      setSelectedSpot((photo.spotlights ?? []).length);
    }
  };

  // ── Popout state ────────────────────────────
  const popouts: PopoutRegion[] = photo.popouts ?? [];
  const [selectedPopout, setSelectedPopout] = useState<string | null>(null);
  const popoutDragRef = useRef<
    | null
    | {
        id: string;
        handle: "tl" | "tr" | "bl" | "br" | "body";
        startRect: { x: number; y: number; w: number; h: number };
        startClientX: number;
        startClientY: number;
        containerW: number;
        containerH: number;
      }
  >(null);

  const makePopoutId = () => `po-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const updatePopout = (id: string, patch: Partial<PopoutRegion>) => {
    const next = popouts.map((p) => (p.id === id ? { ...p, ...patch } : p));
    onUpdatePhoto({ popouts: next });
  };
  const deletePopout = (id: string) => {
    onUpdatePhoto({ popouts: popouts.filter((p) => p.id !== id) });
    if (selectedPopout === id) setSelectedPopout(null);
  };
  const addPopoutAt = (cx: number, cy: number) => {
    const w = 0.22, h = 0.22;
    const x = clamp(cx - w / 2, 0, 1 - w);
    const y = clamp(cy - h / 2, 0, 1 - h);
    const newPop: PopoutRegion = {
      id: makePopoutId(),
      x, y, w, h,
      scale: 1.5,
      fromT: 0.3,
      toT: 0.7,
      shadow: "strong",
    };
    onUpdatePhoto({ popouts: [...popouts, newPop] });
    setSelectedPopout(newPop.id);
  };

  const beginPopoutDrag = (
    id: string,
    handle: "tl" | "tr" | "bl" | "br" | "body",
    e: React.PointerEvent,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const p = popouts.find((x) => x.id === id);
    if (!p) return;
    popoutDragRef.current = {
      id, handle,
      startRect: { x: p.x, y: p.y, w: p.w, h: p.h },
      startClientX: e.clientX,
      startClientY: e.clientY,
      containerW: rect.width,
      containerH: rect.height,
    };
    setSelectedPopout(id);
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };

  const onPopoutPointerMove = (e: React.PointerEvent) => {
    const d = popoutDragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / d.containerW;
    const dy = (e.clientY - d.startClientY) / d.containerH;
    let { x, y, w, h } = d.startRect;
    const MIN = 0.05;
    if (d.handle === "body") {
      x = clamp(d.startRect.x + dx, 0, 1 - w);
      y = clamp(d.startRect.y + dy, 0, 1 - h);
    } else {
      let nx = x, ny = y, nw = w, nh = h;
      if (d.handle === "tl" || d.handle === "bl") {
        nx = clamp(x + dx, 0, x + w - MIN);
        nw = w + (x - nx);
      }
      if (d.handle === "tr" || d.handle === "br") {
        nw = clamp(w + dx, MIN, 1 - x);
      }
      if (d.handle === "tl" || d.handle === "tr") {
        ny = clamp(y + dy, 0, y + h - MIN);
        nh = h + (y - ny);
      }
      if (d.handle === "bl" || d.handle === "br") {
        nh = clamp(h + dy, MIN, 1 - y);
      }
      x = nx; y = ny; w = nw; h = nh;
    }
    updatePopout(d.id, { x, y, w, h });
  };
  const endPopoutDrag = (e: React.PointerEvent) => {
    if (popoutDragRef.current) {
      popoutDragRef.current = null;
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }
  };

  const handlePopoutContainerClick = (e: React.MouseEvent) => {
    // Click on empty area of photo in popout mode → create new popout at click.
    // (Clicks on existing popout rectangles stopPropagate.)
    if (mode !== "popout") return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    if (cx < 0 || cx > 1 || cy < 0 || cy > 1) return;
    addPopoutAt(cx, cy);
  };

  // ── Caption drag state ─────────────────────
  const captionDragRef = useRef<
    | null
    | {
        capId: string;
        startClientX: number;
        startClientY: number;
        startX: number;
        startY: number;
        containerW: number;
        containerH: number;
      }
  >(null);
  const [selectedCaption, setSelectedCaption] = useState<string | null>(null);

  // Always derive captions via the defensive helper so editing a legacy caption persists
  // to `captions[]` on the very first interaction (and clears `caption`).
  const captions = useMemo(() => materializeCaptions(photo), [photo.captions, photo.caption]);

  // Scale font/padding in the caption-mode preview from 1920-canvas units to the
  // actual container width, so the drag preview matches what renders in the player.
  const [captionPreviewScale, setCaptionPreviewScale] = useState(1 / 3);
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const update = () => {
      const w = img.clientWidth;
      if (w > 0) setCaptionPreviewScale(w / 1920);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => ro.disconnect();
  }, []);

  const updateCaption = (capId: string, patch: Partial<CaptionEntry>) => {
    const next = captions.map((c) => (c.id === capId ? { ...c, ...patch } : c));
    onUpdatePhoto({ captions: next, caption: undefined });
  };

  const beginCaptionDrag = (capId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const img = imgRef.current;
    if (!img) return;
    const cap = captions.find((c) => c.id === capId);
    if (!cap) return;
    const rect = img.getBoundingClientRect();
    captionDragRef.current = {
      capId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: cap.x,
      startY: cap.y,
      containerW: rect.width,
      containerH: rect.height,
    };
    setSelectedCaption(capId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onCaptionPointerMove = (e: React.PointerEvent) => {
    const d = captionDragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / d.containerW;
    const dy = (e.clientY - d.startClientY) / d.containerH;
    updateCaption(d.capId, {
      x: Math.max(0, Math.min(1, d.startX + dx)),
      y: Math.max(0, Math.min(1, d.startY + dy)),
    });
  };
  const endCaptionDrag = (e: React.PointerEvent) => {
    if (captionDragRef.current) {
      captionDragRef.current = null;
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
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
  const previewStrength = spots.reduce((max, s) => Math.max(max, s.strength), 0);

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
              <button className={`tab ${mode === "crop" ? "tab-active" : ""}`} onClick={() => setMode("crop")}>
                자르기
              </button>
              <button className={`tab ${mode === "arrow" ? "tab-active" : ""}`} onClick={() => setMode("arrow")}>
                화살표
              </button>
              <button className={`tab ${mode === "popout" ? "tab-active" : ""}`} onClick={() => setMode("popout")}>
                들뜸
              </button>
              <button className={`tab ${mode === "caption" ? "tab-active" : ""}`} onClick={() => setMode("caption")}>
                텍스트 위치
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

              {/* Crop overlay: dim outside, rectangle with handles */}
              {mode === "crop" && (
                <>
                  {/* Dim backdrop in 4 pieces so the inside stays clear */}
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: `${crop.y * 100}%`, background: "rgba(0,0,0,0.55)" }} />
                    <div style={{ position: "absolute", left: 0, top: `${(crop.y + crop.h) * 100}%`, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)" }} />
                    <div style={{ position: "absolute", left: 0, top: `${crop.y * 100}%`, width: `${crop.x * 100}%`, height: `${crop.h * 100}%`, background: "rgba(0,0,0,0.55)" }} />
                    <div style={{ position: "absolute", left: `${(crop.x + crop.w) * 100}%`, top: `${crop.y * 100}%`, right: 0, height: `${crop.h * 100}%`, background: "rgba(0,0,0,0.55)" }} />
                  </div>
                  {/* Crop rect frame + body drag target */}
                  <div
                    onPointerDown={(e) => beginCropDrag("body", e)}
                    onPointerMove={onCropPointerMove}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    style={{
                      position: "absolute",
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.w * 100}%`,
                      height: `${crop.h * 100}%`,
                      border: "2px solid rgba(255,255,255,0.95)",
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                      cursor: "move",
                      touchAction: "none",
                    }}
                  >
                    {/* Rule-of-thirds guides */}
                    <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.35)", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.35)", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.35)", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.35)", pointerEvents: "none" }} />
                    {/* Corner handles */}
                    {(["tl", "tr", "bl", "br"] as const).map((h) => {
                      const pos =
                        h === "tl" ? { left: -9, top: -9, cursor: "nwse-resize" } :
                        h === "tr" ? { right: -9, top: -9, cursor: "nesw-resize" } :
                        h === "bl" ? { left: -9, bottom: -9, cursor: "nesw-resize" } :
                                     { right: -9, bottom: -9, cursor: "nwse-resize" };
                      return (
                        <div
                          key={h}
                          onPointerDown={(e) => beginCropDrag(h, e)}
                          onPointerMove={onCropPointerMove}
                          onPointerUp={endCropDrag}
                          onPointerCancel={endCropDrag}
                          style={{
                            position: "absolute",
                            width: 18, height: 18,
                            borderRadius: 2,
                            background: "#fff",
                            border: "2px solid #222",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                            touchAction: "none",
                            ...pos,
                          }}
                        />
                      );
                    })}
                  </div>
                </>
              )}

              {/* Arrow overlay: catches pointer-down on empty area + shows existing arrows + handles */}
              {mode === "arrow" && (
                <div
                  onPointerDown={onArrowCanvasPointerDown}
                  onPointerMove={onArrowPointerMove}
                  onPointerUp={endArrowDrag}
                  onPointerCancel={endArrowDrag}
                  style={{ position: "absolute", inset: 0, cursor: "crosshair", touchAction: "none" }}
                >
                  {/* SVG lines + arrowheads (WYSIWYG vs. video render) */}
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
                       viewBox="0 0 100 100" preserveAspectRatio="none">
                    {annotations.map((a) => {
                      const info = buildArrowPath(a);
                      const stroke = arrowStroke(a.style, a.color);
                      const selected = selectedArrow === a.id;
                      const dash = a.style === "dashed" ? "3 4" : undefined;
                      const curW = selected ? stroke.width + 1 : stroke.width;
                      const outline = arrowNeedsOutline(a.color);
                      return (
                        <g key={a.id} opacity={stroke.opacity}>
                          {outline && (
                            <path d={info.d} fill="none" stroke={ARROW_OUTLINE_COLOR}
                              strokeWidth={curW + 2.2}
                              strokeDasharray={dash}
                              strokeLinecap="round" strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke" />
                          )}
                          <path d={info.d} fill="none" stroke={stroke.color}
                            strokeWidth={curW}
                            strokeDasharray={dash}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke" />
                          <g transform={`translate(${a.tipX * 100} ${a.tipY * 100}) rotate(${info.tipAngleDeg})`}>
                            {outline && (
                              <path d={arrowHeadPath(a.style)}
                                fill={ARROW_OUTLINE_COLOR} stroke={ARROW_OUTLINE_COLOR}
                                strokeWidth={2.4} strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke" />
                            )}
                            <path d={arrowHeadPath(a.style)} fill={stroke.color}
                              vectorEffect="non-scaling-stroke" />
                          </g>
                        </g>
                      );
                    })}
                  </svg>
                  {/* Tip handles */}
                  {annotations.map((a) => (
                    <div
                      key={`tip-${a.id}`}
                      onPointerDown={(e) => { setSelectedArrow(a.id); beginArrowDrag("move-tip", a.id, e); }}
                      style={{
                        position: "absolute",
                        left: `${a.tipX * 100}%`,
                        top: `${a.tipY * 100}%`,
                        width: 16, height: 16,
                        borderRadius: "50%",
                        background: "#fff",
                        border: `3px solid ${selectedArrow === a.id ? "var(--gold)" : "#1a1510"}`,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                        transform: "translate(-50%, -50%)",
                        cursor: "grab",
                        touchAction: "none",
                      }}
                    />
                  ))}
                  {/* Label drag chips */}
                  {annotations.map((a) => (
                    <div
                      key={`lbl-${a.id}`}
                      onPointerDown={(e) => { setSelectedArrow(a.id); beginArrowDrag("move-label", a.id, e); }}
                      style={{
                        position: "absolute",
                        left: `${a.labelX * 100}%`,
                        top: `${a.labelY * 100}%`,
                        transform: "translate(-50%, -50%)",
                        fontFamily: "'Nanum Pen Script', cursive",
                        fontSize: 22,
                        color: "#1a1510",
                        background: a.label ? "rgba(251, 244, 220, 0.92)" : "rgba(251, 244, 220, 0.55)",
                        padding: a.label ? "3px 10px" : "4px",
                        borderRadius: 2,
                        border: selectedArrow === a.id ? "2px solid var(--gold)" : "1px dashed rgba(26,21,16,0.35)",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        cursor: "grab",
                        whiteSpace: "nowrap",
                        touchAction: "none",
                        minWidth: 18,
                        minHeight: 18,
                        lineHeight: 1.1,
                      }}
                    >
                      {a.label || "●"}
                    </div>
                  ))}
                </div>
              )}

              {/* Caption overlay: draggable text boxes over the photo */}
              {mode === "caption" && (
                <div
                  onPointerMove={onCaptionPointerMove}
                  onPointerUp={endCaptionDrag}
                  onPointerCancel={endCaptionDrag}
                  style={{ position: "absolute", inset: 0, touchAction: "none" }}
                >
                  {/* Scrim preview — matches CaptionsLayer in VideoComposition so the editor is WYSIWYG */}
                  {captions.some((c) => resolveCaptionBgKind(c) === "scrim-bottom") && (
                    <div style={{
                      position: "absolute", left: 0, right: 0, bottom: 0, height: "38%",
                      background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 40%, transparent 100%)",
                      pointerEvents: "none",
                    }} />
                  )}
                  {captions.some((c) => resolveCaptionBgKind(c) === "scrim-top") && (
                    <div style={{
                      position: "absolute", left: 0, right: 0, top: 0, height: "38%",
                      background: "linear-gradient(to bottom, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 40%, transparent 100%)",
                      pointerEvents: "none",
                    }} />
                  )}
                  {captions.map((cap) => {
                    const font = CAPTION_FONT_STACK[cap.fontFamily ?? "serif"];
                    const align = cap.align ?? "center";
                    const translate =
                      align === "left"  ? "translate(0, -50%)" :
                      align === "right" ? "translate(-100%, -50%)" :
                                           "translate(-50%, -50%)";
                    const isSelected = selectedCaption === cap.id;
                    const kind = resolveCaptionBgKind(cap);
                    const preview = `${cap.speaker ? cap.speaker + ": " : ""}${cap.text || "텍스트"}`;
                    const boxStyle: React.CSSProperties =
                      kind === "card" ? {
                        padding: `${(cap.bg?.paddingY ?? 10) * captionPreviewScale}px ${(cap.bg?.paddingX ?? 22) * captionPreviewScale}px`,
                        background: cap.bg?.color ?? "rgba(15,12,8,0.55)",
                        borderRadius: cap.bg?.radius ?? 4,
                      } :
                      kind === "none" ? { padding: "4px 8px" } :
                      { // shadow / scrim-bottom / scrim-top
                        padding: "4px 8px",
                        textShadow: "0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.7), 0 0 18px rgba(0,0,0,0.4)",
                      };
                    return (
                      <div
                        key={cap.id}
                        onPointerDown={(e) => beginCaptionDrag(cap.id, e)}
                        style={{
                          position: "absolute",
                          left: `${cap.x * 100}%`,
                          top: `${cap.y * 100}%`,
                          transform: translate,
                          fontFamily: font.fontFamily,
                          fontStyle: font.fontStyle,
                          letterSpacing: font.letterSpacing,
                          fontSize: Math.max(10, (cap.fontSize ?? 32) * captionPreviewScale),
                          color: cap.color ?? "#f5ecd7",
                          textAlign: align,
                          maxWidth: `${cap.maxWidthPct ?? 80}%`,
                          border: isSelected ? "2px solid var(--gold, #a88848)" : "1px dashed rgba(255,255,255,0.35)",
                          whiteSpace: "pre-wrap",
                          cursor: "grab",
                          touchAction: "none",
                          userSelect: "none",
                          lineHeight: 1.35,
                          ...boxStyle,
                        }}
                        title="드래그해서 위치 이동"
                      >
                        {preview}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Popout rectangles */}
              {mode === "popout" && (
                <div
                  onClick={handlePopoutContainerClick}
                  onPointerMove={onPopoutPointerMove}
                  onPointerUp={endPopoutDrag}
                  onPointerCancel={endPopoutDrag}
                  style={{ position: "absolute", inset: 0, touchAction: "none", cursor: popoutDragRef.current ? "grabbing" : "crosshair" }}
                >
                  {popouts.map((p) => {
                    const isSel = selectedPopout === p.id;
                    return (
                      <div
                        key={p.id}
                        onPointerDown={(e) => beginPopoutDrag(p.id, "body", e)}
                        onClick={(e) => { e.stopPropagation(); setSelectedPopout(p.id); }}
                        style={{
                          position: "absolute",
                          left: `${p.x * 100}%`, top: `${p.y * 100}%`,
                          width: `${p.w * 100}%`, height: `${p.h * 100}%`,
                          border: isSel ? "2px solid var(--gold, #a88848)" : "1.5px dashed rgba(255,255,255,0.75)",
                          background: isSel ? "rgba(168,136,72,0.14)" : "rgba(255,255,255,0.06)",
                          boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
                          cursor: "grab", touchAction: "none",
                        }}
                        title="드래그해서 이동, 모서리 핸들로 리사이즈"
                      >
                        {/* corner handles */}
                        {(["tl","tr","bl","br"] as const).map((h) => (
                          <div key={h}
                            onPointerDown={(e) => beginPopoutDrag(p.id, h, e)}
                            style={{
                              position: "absolute", width: 12, height: 12,
                              background: "#fff", border: "2px solid var(--gold, #a88848)",
                              borderRadius: 2,
                              top: h.startsWith("t") ? -6 : undefined,
                              bottom: h.startsWith("b") ? -6 : undefined,
                              left: h.endsWith("l") ? -6 : undefined,
                              right: h.endsWith("r") ? -6 : undefined,
                              cursor: (h === "tl" || h === "br") ? "nwse-resize" : "nesw-resize",
                              touchAction: "none",
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
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
                  {/* Per-photo zoom: defaults to global, but edit here affects THIS photo only. */}
                  {(() => {
                    const effective = photo.kenBurnsAmount ?? kenBurnsAmount;
                    const isOverridden = photo.kenBurnsAmount !== undefined;
                    const setPerPhoto = (v: number) => onUpdatePhoto({ kenBurnsAmount: v });
                    const clearOverride = () => onUpdatePhoto({ kenBurnsAmount: undefined });
                    return (
                      <>
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
                              transform: `scale(${1 + effective})`,
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
                            최대 scale {(1 + effective).toFixed(2)}×
                          </div>
                        </div>
                        <label className="slider-label">
                          <span>확대 (이 사진만)</span>
                          <input
                            type="range"
                            className="slider"
                            min={0}
                            max={1.0}
                            step={0.01}
                            value={effective}
                            onChange={(e) => setPerPhoto(parseFloat(e.target.value))}
                          />
                          <span>{(effective * 100).toFixed(1)}%</span>
                        </label>
                        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                          {[
                            { label: "없음", val: 0 },
                            { label: "4%", val: 0.04 },
                            { label: "15%", val: 0.15 },
                            { label: "30%", val: 0.30 },
                            { label: "50%", val: 0.50 },
                            { label: "100%", val: 1.00 },
                          ].map((p) => {
                            const active = Math.abs(effective - p.val) < 0.003;
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
                                onClick={() => setPerPhoto(p.val)}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="hint hint-dim" style={{ marginTop: 6 }}>
                          {isOverridden
                            ? <>이 사진은 개별 값 <b>{(effective * 100).toFixed(0)}%</b> 적용 중 · <button className="btn btn-xs" onClick={clearOverride} style={{ padding: "2px 8px" }}>기본값으로</button></>
                            : <>전체 기본값({(kenBurnsAmount * 100).toFixed(0)}%)을 따름</>}
                        </p>
                      </>
                    );
                  })()}
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

            {mode === "popout" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p className="hint" style={{ margin: 0 }}>
                    이미지를 클릭 = 들뜸 영역 추가 · 드래그로 이동 · 모서리로 리사이즈<br />
                    시간 창에 따라 그 부분이 앞으로 솟아올라 강조됩니다.
                  </p>
                  {popouts.length > 0 && (
                    <button
                      className="btn btn-xs"
                      style={{ flexShrink: 0, marginLeft: 10 }}
                      onClick={() => { onUpdatePhoto({ popouts: [] }); setSelectedPopout(null); }}
                    >
                      전체 리셋
                    </button>
                  )}
                </div>
                {popouts.length === 0 && (
                  <p className="hint hint-dim">아직 들뜸 영역이 없습니다. 이미지를 클릭해 추가하세요.</p>
                )}
                {popouts.map((p, i) => {
                  const isSel = selectedPopout === p.id;
                  return (
                    <div key={p.id} className={`spot-control ${isSel ? "spot-control--active" : ""}`}
                      onClick={() => setSelectedPopout(p.id)}>
                      <div className="spot-control-header">
                        <span>들뜸 #{i + 1}</span>
                        <button className="btn-icon btn-icon--danger" onClick={(e) => { e.stopPropagation(); deletePopout(p.id); }}>&#10005;</button>
                      </div>
                      <div className="coord-display" style={{ marginBottom: 4 }}>
                        x {(p.x * 100).toFixed(0)}% · y {(p.y * 100).toFixed(0)}% · w {(p.w * 100).toFixed(0)}% · h {(p.h * 100).toFixed(0)}%
                      </div>
                      <label className="slider-label">
                        <span>확대</span>
                        <input type="range" className="slider" min={1.1} max={2.5} step={0.05}
                          value={p.scale ?? 1.5}
                          onChange={(e) => updatePopout(p.id, { scale: parseFloat(e.target.value) })} />
                        <span>{(p.scale ?? 1.5).toFixed(2)}×</span>
                      </label>
                      <label className="slider-label">
                        <span>시작</span>
                        <input type="range" className="slider" min={0} max={1} step={0.01}
                          value={p.fromT ?? 0}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            const to = p.toT ?? 1;
                            updatePopout(p.id, { fromT: Math.min(v, to - 0.05) });
                          }} />
                        <span>{((p.fromT ?? 0) * 100).toFixed(0)}%</span>
                      </label>
                      <label className="slider-label">
                        <span>끝</span>
                        <input type="range" className="slider" min={0} max={1} step={0.01}
                          value={p.toT ?? 1}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            const from = p.fromT ?? 0;
                            updatePopout(p.id, { toT: Math.max(v, from + 0.05) });
                          }} />
                        <span>{((p.toT ?? 1) * 100).toFixed(0)}%</span>
                      </label>
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <button className="btn btn-xs" style={{ flex: 1, background: (p.shadow ?? "strong") === "soft" ? "var(--gold)" : undefined }}
                          onClick={() => updatePopout(p.id, { shadow: "soft" })}>
                          그림자 약
                        </button>
                        <button className="btn btn-xs" style={{ flex: 1, background: (p.shadow ?? "strong") === "strong" ? "var(--gold)" : undefined }}
                          onClick={() => updatePopout(p.id, { shadow: "strong" })}>
                          그림자 강
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {mode === "crop" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p className="hint" style={{ margin: 0 }}>
                    모서리를 드래그해서 영역을 조절하거나, 박스 내부를 드래그해서 이동하세요.
                  </p>
                  {photo.crop && (
                    <button className="btn btn-xs" style={{ flexShrink: 0, marginLeft: 10 }} onClick={resetCrop}>
                      전체 리셋
                    </button>
                  )}
                </div>
                <div className="coord-display">
                  x {(crop.x * 100).toFixed(0)}% · y {(crop.y * 100).toFixed(0)}% · w {(crop.w * 100).toFixed(0)}% · h {(crop.h * 100).toFixed(0)}%
                </div>
                <div style={{ marginTop: 14 }}>
                  <p className="hint" style={{ marginBottom: 6 }}>비율 잠금</p>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {[
                      { label: "자유", val: null as number | null },
                      { label: "16:9", val: 16 / 9 },
                      { label: "4:3", val: 4 / 3 },
                      { label: "1:1", val: 1 },
                      { label: "3:4", val: 3 / 4 },
                      { label: "9:16", val: 9 / 16 },
                    ].map((p) => {
                      const active = cropAspect === p.val || (cropAspect == null && p.val == null);
                      return (
                        <button
                          key={p.label}
                          className="btn btn-xs"
                          style={{
                            flex: 1, minWidth: 52,
                            background: active ? "var(--gold)" : undefined,
                            color: active ? "#111" : undefined,
                            fontWeight: active ? 700 : 500,
                          }}
                          onClick={() => applyAspectPreset(p.val)}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="hint hint-dim" style={{ marginTop: 8 }}>
                    16:9은 영상 출력 비율과 같아 레터박스 없이 채워집니다.
                  </p>
                </div>
              </>
            )}

            {mode === "arrow" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <p className="hint" style={{ margin: 0 }}>
                    프리셋을 눌러 추가하거나, 이미지 위에서 드래그해 직접 그리세요. 흰 원/라벨 박스를 드래그해 위치 조정.
                  </p>
                  {annotations.length > 0 && (
                    <button className="btn btn-xs" style={{ flexShrink: 0, marginLeft: 10 }}
                      onClick={() => { updateArrows([]); setSelectedArrow(null); }}>
                      전체 리셋
                    </button>
                  )}
                </div>
                {/* Preset palette — click to drop into image center */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                  gap: 6,
                  marginBottom: 10,
                  padding: 8,
                  background: "rgba(20,28,38,0.3)",
                  border: "1px dashed rgba(120,150,180,0.3)",
                  borderRadius: 4,
                }}>
                  {ARROW_PRESETS.map((preset) => {
                    const stroke = arrowStroke(preset.style, preset.color);
                    const dash = preset.style === "dashed" ? "3 4" : undefined;
                    const sample = { labelX: 0.08, labelY: 0.55, tipX: 0.82, tipY: 0.40, style: preset.style };
                    const info = buildArrowPath(sample);
                    const outline = arrowNeedsOutline(preset.color);
                    return (
                      <button key={`${preset.style}-${preset.color}`} className="btn btn-xs"
                        onClick={() => insertArrowPreset(preset)}
                        title={`${preset.label} — 클릭해서 추가`}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center",
                          gap: 2, padding: "6px 4px", cursor: "copy",
                        }}>
                        <svg viewBox="0 0 100 100" width="70" height="22" preserveAspectRatio="none"
                             style={{ opacity: stroke.opacity }}>
                          {outline && (
                            <path d={info.d} fill="none" stroke={ARROW_OUTLINE_COLOR}
                              strokeWidth={stroke.width + 2.2}
                              strokeDasharray={dash}
                              strokeLinecap="round" strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke" />
                          )}
                          <path d={info.d} fill="none" stroke={stroke.color}
                            strokeWidth={stroke.width}
                            strokeDasharray={dash}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke" />
                          <g transform={`translate(${sample.tipX * 100} ${sample.tipY * 100}) rotate(${info.tipAngleDeg})`}>
                            {outline && (
                              <path d={arrowHeadPath(preset.style)}
                                fill={ARROW_OUTLINE_COLOR} stroke={ARROW_OUTLINE_COLOR}
                                strokeWidth={2.4} strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke" />
                            )}
                            <path d={arrowHeadPath(preset.style)} fill={stroke.color}
                              vectorEffect="non-scaling-stroke" />
                          </g>
                        </svg>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
                {annotations.length === 0 && (
                  <p className="hint hint-dim">프리셋을 클릭해서 화살표를 추가하세요.</p>
                )}
                {annotations.map((a) => {
                  const isSel = selectedArrow === a.id;
                  return (
                    <div key={a.id}
                      className={`spot-control ${isSel ? "spot-control--active" : ""}`}
                      onClick={() => setSelectedArrow(a.id)}>
                      <div className="spot-control-header">
                        <span>화살표 #{annotations.indexOf(a) + 1}</span>
                        <button className="btn-icon btn-icon--danger"
                          onClick={(e) => { e.stopPropagation(); deleteArrow(a.id); }}>&#10005;</button>
                      </div>
                      <input className="input input-sm" placeholder="라벨 (비우면 화살표만)"
                        value={a.label ?? ""}
                        onChange={(e) => updateArrow(a.id, { label: e.target.value })} />
                      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        {ARROW_PRESETS.map((preset) => {
                          const active = (a.style ?? "curve") === preset.style;
                          return (
                            <button key={preset.style} className="btn btn-xs"
                              style={{
                                flex: 1, minWidth: 62,
                                background: active ? "var(--gold)" : undefined,
                                color: active ? "#111" : undefined,
                                fontWeight: active ? 700 : 500,
                              }}
                              onClick={(e) => { e.stopPropagation(); updateArrow(a.id, { style: preset.style }); }}>
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                      {/* Color swatches — primary (기본으로 쓰는 사람별 색) + 더보기 (기타) */}
                      <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 40 }}>색</span>
                        {(["ink", "white", "lilac", "lemon"] as ArrowColor[]).map((c) => {
                          const implicitDefault: ArrowColor = (a.style ?? "curve") === "brush" ? "gold" : "ink";
                          const active = (a.color ?? implicitDefault) === c;
                          return (
                            <button
                              key={c}
                              title={ARROW_COLOR_LABELS[c]}
                              onClick={(e) => { e.stopPropagation(); updateArrow(a.id, { color: c }); }}
                              style={{
                                width: 22, height: 22,
                                borderRadius: "50%",
                                background: ARROW_COLOR_MAP[c],
                                border: active ? "2px solid var(--gold)" : "1px solid rgba(0,0,0,0.2)",
                                boxShadow: active ? "0 0 0 2px rgba(232,208,155,0.25)" : "0 1px 2px rgba(0,0,0,0.15)",
                                cursor: "pointer", padding: 0,
                              }}
                            />
                          );
                        })}
                        <button
                          className="btn btn-xs"
                          style={{ fontSize: 10, padding: "2px 6px", marginLeft: 4 }}
                          onClick={(e) => { e.stopPropagation(); setShowMoreArrowColors((v) => !v); }}
                        >
                          {showMoreArrowColors ? "접기 ▲" : "더보기 ▼"}
                        </button>
                        {showMoreArrowColors && (["gold", "burgundy", "navy", "sage", "cream"] as ArrowColor[]).map((c) => {
                          const implicitDefault: ArrowColor = (a.style ?? "curve") === "brush" ? "gold" : "ink";
                          const active = (a.color ?? implicitDefault) === c;
                          return (
                            <button
                              key={c}
                              title={ARROW_COLOR_LABELS[c]}
                              onClick={(e) => { e.stopPropagation(); updateArrow(a.id, { color: c }); }}
                              style={{
                                width: 20, height: 20,
                                borderRadius: "50%",
                                background: ARROW_COLOR_MAP[c],
                                border: active ? "2px solid var(--gold)" : "1px solid rgba(0,0,0,0.2)",
                                boxShadow: active ? "0 0 0 2px rgba(232,208,155,0.25)" : "0 1px 2px rgba(0,0,0,0.15)",
                                cursor: "pointer", padding: 0,
                                opacity: 0.85,
                              }}
                            />
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, fontFamily: "monospace" }}>
                        tip ({(a.tipX * 100).toFixed(0)},{(a.tipY * 100).toFixed(0)}) · label ({(a.labelX * 100).toFixed(0)},{(a.labelY * 100).toFixed(0)})
                      </div>
                    </div>
                  );
                })}
                <p className="hint hint-dim" style={{ marginTop: 8 }}>
                  애니메이션: 사진 등장 뒤 화살표가 그려지고 라벨이 페이드인됨.
                </p>
              </>
            )}

            {mode === "caption" && (
              <>
                <p className="hint">
                  이미지 위 텍스트 박스를 드래그해서 위치를 조절하세요.
                  텍스트 내용/폰트/배경은 사진 카드의 캡션 리스트에서 편집합니다.
                </p>
                {captions.length === 0 ? (
                  <p className="hint hint-dim" style={{ marginTop: 8 }}>
                    이 사진에 아직 캡션이 없습니다. 사진 카드에서 "+ 텍스트 추가"로 먼저 만들어주세요.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                    {captions.map((cap) => (
                      <div key={cap.id} style={{
                        border: selectedCaption === cap.id ? "1px solid var(--gold, #a88848)" : "1px solid rgba(80,110,140,0.3)",
                        borderRadius: 4, padding: 6, background: "rgba(30,40,50,0.25)",
                        fontSize: 12,
                      }}
                        onClick={() => setSelectedCaption(cap.id)}>
                        <div style={{ color: "#6a8aa0", fontWeight: 600, marginBottom: 2 }}>
                          {cap.speaker ? `${cap.speaker}:` : "(화자 없음)"}
                        </div>
                        <div style={{ opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {cap.text || "(비어 있음)"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                          x {(cap.x * 100).toFixed(0)}% · y {(cap.y * 100).toFixed(0)}% · {cap.align ?? "center"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <span className="modal-footer-hint">
            {mode === "focal" ? "클릭 = 포커스 지정 · 변경사항은 실시간 반영됨"
              : mode === "spotlight" ? "클릭 = 강조 추가 · 변경사항은 실시간 반영됨"
              : mode === "crop" ? "드래그 = 자르기 영역 조절 · 변경사항은 실시간 반영됨"
              : mode === "caption" ? "텍스트 박스 드래그 = 위치 이동 · 변경사항은 실시간 반영됨"
              : mode === "popout" ? "클릭 = 들뜸 영역 추가 · 드래그 = 이동 · 모서리 = 리사이즈"
              : "드래그 = 화살표 그리기 · 끝점/라벨 드래그로 조정"}
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

// ─── Caption editor (multi-caption list per photo) ───

// Shared empty array so photos with no captions don't churn references every render.
const EMPTY_CAPTIONS: CaptionEntry[] = [];

// Stable cache for legacy-materialized arrays, keyed on the legacy caption object.
// Same caption object → same array reference → React.memo can skip subtrees.
const _legacyMaterializeCache = new WeakMap<object, CaptionEntry[]>();

// Defensive: always return an array, materializing any legacy `caption` on the fly.
// Used by mutations so "edit the legacy caption" never silently drops the write.
// The legacy id is deterministic so React keys stay stable across renders
// (a random id would remount inputs and kill focus mid-typing).
const materializeCaptions = (p: PhotoEntry): CaptionEntry[] => {
  if (p.captions && p.captions.length > 0) return p.captions;
  if (p.caption) {
    const cached = _legacyMaterializeCache.get(p.caption);
    if (cached) return cached;
    const pos = p.caption.position;
    const fresh: CaptionEntry[] = [{
      id: "cap-legacy",
      text: p.caption.text,
      x: 0.5,
      y: pos === "top" ? 0.08 : pos === "center" ? 0.5 : 0.92,
      align: "center",
      fontFamily: "serif",
      fontSize: 32,
      // Pick a scrim that matches where the caption sits so the legacy row is readable.
      // "center" has no edge to darken, so fall back to a shadow.
      bg: { kind: pos === "top" ? "scrim-top" : pos === "center" ? "shadow" : "scrim-bottom" },
    }];
    _legacyMaterializeCache.set(p.caption, fresh);
    return fresh;
  }
  return EMPTY_CAPTIONS;
};

const CAPTION_FONT_OPTIONS: { value: CaptionFont; label: string }[] = [
  { value: "serif",     label: "영문 세리프 (이탤릭)" },
  { value: "serif-kr",  label: "한글 명조" },
  { value: "script-kr", label: "한글 손글씨" },
  { value: "brush-kr",  label: "한글 붓글씨" },
  { value: "sans-kr",   label: "한글 산세리프" },
];

// 9-cell preset grid for x/y positioning.
const CAPTION_POSITION_PRESETS: { label: string; x: number; y: number; align: CaptionAlign }[] = [
  { label: "↖", x: 0.06, y: 0.08, align: "left"   },
  { label: "↑", x: 0.50, y: 0.08, align: "center" },
  { label: "↗", x: 0.94, y: 0.08, align: "right"  },
  { label: "←", x: 0.06, y: 0.50, align: "left"   },
  { label: "•", x: 0.50, y: 0.50, align: "center" },
  { label: "→", x: 0.94, y: 0.50, align: "right"  },
  { label: "↙", x: 0.06, y: 0.92, align: "left"   },
  { label: "↓", x: 0.50, y: 0.92, align: "center" },
  { label: "↘", x: 0.94, y: 0.92, align: "right"  },
];

// Ordered most-readable-first. First two (scrim-bottom / scrim-top) are the new defaults —
// a gradient darkens the edge of the photo so captions stay legible on any background.
const CAPTION_BG_PRESETS: { label: string; bg: CaptionBackground }[] = [
  { label: "스크림 하단 (기본)", bg: { kind: "scrim-bottom" } },
  { label: "스크림 상단",        bg: { kind: "scrim-top" } },
  { label: "어두운 카드",        bg: { kind: "card", color: "rgba(15,12,8,0.55)", paddingX: 22, paddingY: 10, radius: 4, blur: true } },
  { label: "크림 카드",          bg: { kind: "card", color: "rgba(245,236,215,0.92)", paddingX: 22, paddingY: 10, radius: 4 } },
  { label: "투명 블러 카드",     bg: { kind: "card", color: "rgba(255,255,255,0.18)", paddingX: 22, paddingY: 10, radius: 4, blur: true } },
  { label: "그림자만",           bg: { kind: "shadow" } },
  { label: "없음",               bg: { kind: "none" } },
];

const CAPTION_SPEAKER_PRESETS = ["예찬", "슬기"];

// Typed CaptionsEditor takes photoIdx + stable top-level callbacks so we can
// React.memo it and skip re-render when only another photo's state changes.
type CaptionsEditorProps = {
  photoIdx: number;
  captions: CaptionEntry[];
  onAdd: (idx: number, preset?: Partial<CaptionEntry>) => void;
  onUpdate: (idx: number, capId: string, patch: Partial<CaptionEntry>) => void;
  onDelete: (idx: number, capId: string) => void;
  onOpenPositionEditor: (idx: number) => void;
};

const CaptionsEditor = React.memo<CaptionsEditorProps>(({ photoIdx, captions, onAdd, onUpdate, onDelete, onOpenPositionEditor }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
      {captions.map((cap) => {
        const effectiveKind = resolveCaptionBgKind(cap);
        const bgIdx = CAPTION_BG_PRESETS.findIndex((p) => {
          if ((p.bg.kind ?? "card") !== effectiveKind) return false;
          // For card preset, also match by color so the dropdown picks the right variant.
          if (effectiveKind === "card") return (p.bg.color ?? "") === (cap.bg?.color ?? "");
          return true;
        });
        const bgIsCustom = bgIdx < 0;
        return (
          <div key={cap.id} style={{
            border: "1px solid rgba(80,110,140,0.25)",
            borderRadius: 4, padding: 6, background: "rgba(30,40,50,0.18)",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input className="input input-sm" placeholder="화자 (예: 예찬)"
                value={cap.speaker ?? ""}
                list={`speaker-suggestions-${cap.id}`}
                onChange={(e) => onUpdate(photoIdx, cap.id, { speaker: e.target.value || undefined })}
                style={{ flex: 1, minWidth: 0 }} />
              <datalist id={`speaker-suggestions-${cap.id}`}>
                {CAPTION_SPEAKER_PRESETS.map((s) => <option key={s} value={s} />)}
              </datalist>
              <button className="btn-icon btn-icon--danger" onClick={() => onDelete(photoIdx, cap.id)}>&#10005;</button>
            </div>
            <textarea className="input input-sm" placeholder="텍스트"
              value={cap.text} rows={2}
              onChange={(e) => onUpdate(photoIdx, cap.id, { text: e.target.value })}
              style={{ resize: "vertical" }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <select className="select select-sm" value={cap.fontFamily ?? "serif"}
                onChange={(e) => onUpdate(photoIdx, cap.id, { fontFamily: e.target.value as CaptionFont })}
                style={{ flex: 2, minWidth: 0 }}>
                {CAPTION_FONT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input className="input input-sm" type="number" min={12} max={96} step={2}
                value={cap.fontSize ?? 32}
                onChange={(e) => onUpdate(photoIdx, cap.id, { fontSize: parseInt(e.target.value, 10) || 32 })}
                title="크기 (px @ 1920×1080)" style={{ width: 60 }} />
              <select className="select select-sm" value={bgIsCustom ? -1 : bgIdx}
                onChange={(e) => {
                  const i = parseInt(e.target.value, 10);
                  if (i < 0) return; // "커스텀" is display-only; no-op on select
                  onUpdate(photoIdx, cap.id, { bg: CAPTION_BG_PRESETS[i].bg });
                }}
                title="배경">
                {bgIsCustom && <option value={-1}>배경: 커스텀</option>}
                {CAPTION_BG_PRESETS.map((p, i) => <option key={i} value={i}>배경: {p.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", marginRight: 2 }}>위치:</span>
              {CAPTION_POSITION_PRESETS.map((p) => {
                const active = Math.abs((cap.x ?? 0.5) - p.x) < 0.02 && Math.abs((cap.y ?? 0.92) - p.y) < 0.02 && (cap.align ?? "center") === p.align;
                return (
                  <button key={p.label} className="btn btn-xs"
                    onClick={() => onUpdate(photoIdx, cap.id, { x: p.x, y: p.y, align: p.align })}
                    style={{
                      width: 22, minWidth: 22, padding: "2px 0",
                      opacity: active ? 1 : 0.6,
                      background: active ? "rgba(80,120,160,0.45)" : undefined,
                    }}
                    title={`x=${p.x}, y=${p.y}, align=${p.align}`}>
                    {p.label}
                  </button>
                );
              })}
              <button className="btn btn-xs" onClick={() => onOpenPositionEditor(photoIdx)}
                title="이미지에서 드래그해서 미세 조정">
                드래그 편집
              </button>
            </div>
          </div>
        );
      })}
      <button className="btn btn-xs btn-moment-add"
        onClick={() => onAdd(photoIdx)}
        style={{ alignSelf: "flex-start" }}>
        + 텍스트 추가
      </button>
      {captions.length === 0 && CAPTION_SPEAKER_PRESETS.length > 0 && (
        <div style={{ display: "flex", gap: 4 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", alignSelf: "center" }}>빠른 시작:</span>
          <button className="btn btn-xs" onClick={() => {
            onAdd(photoIdx, { speaker: "예찬", y: 0.82, align: "center" });
            onAdd(photoIdx, { speaker: "슬기", y: 0.90, align: "center" });
          }}>대화 (예찬 / 슬기)</button>
        </div>
      )}
    </div>
  );
});

// ─── Journey Map field editor ────────────────
//   Keep labels in sync with JOURNEY_LOCATIONS in VideoComposition.tsx (5 fixed stops)

const JOURNEY_LOCATION_LABELS = ["성모병원", "분당", "청춘", "뉴욕 · 서울", "여기, 오늘"];

const JourneyMapFields: React.FC<{
  m: JourneyMap;
  acts: number[];
  photosByAct: Record<number, { photo: PhotoEntry; idx: number }[]>;
  updateJourneyMap: (id: string, patch: Partial<{ title: string; subtitle: string; caption: string; durationSec: number; visibleCount: number; afterPhotoIndex: number }>) => void;
}> = ({ m, acts, photosByAct, updateJourneyMap }) => {
  return (
    <>
      <input className="input input-sm" placeholder="상단 영문 제목" value={m.title ?? ""}
        onChange={(e) => updateJourneyMap(m.id, { title: e.target.value })} />
      <input className="input input-sm" placeholder="한글 부제 (비워두면 자동)" value={m.subtitle ?? ""}
        onChange={(e) => updateJourneyMap(m.id, { subtitle: e.target.value })} />
      <input className="input input-sm" placeholder="하단 캡션 (이탤릭)" value={m.caption ?? ""}
        onChange={(e) => updateJourneyMap(m.id, { caption: e.target.value })} />
      <div style={{ display: "flex", gap: 6 }}>
        <select className="select select-sm" value={m.visibleCount ?? 5}
          onChange={(e) => updateJourneyMap(m.id, { visibleCount: Number(e.target.value) })}
          style={{ flex: 2 }} title="강조할 현재 위치 (이전은 진하게, 이후는 미리보기)">
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>현재: {JOURNEY_LOCATION_LABELS[n - 1]}</option>
          ))}
        </select>
        <input className="input input-sm" type="number" step="0.5" min="3" max="15"
          value={m.durationSec ?? 8.0}
          onChange={(e) => updateJourneyMap(m.id, { durationSec: parseFloat(e.target.value) })}
          style={{ flex: 1 }} title="지속(초)" />
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#6a8aa0" }}>Act 시작 위치로 이동:</span>
        {acts.map((a) => {
          const firstIdx = photosByAct[a]?.[0]?.idx;
          if (firstIdx === undefined) return null;
          const target = firstIdx - 1;
          const isActive = m.afterPhotoIndex === target;
          return (
            <button key={a} className="btn btn-xs"
              onClick={() => updateJourneyMap(m.id, { afterPhotoIndex: target })}
              disabled={isActive}
              style={isActive ? { opacity: 0.5 } : undefined}
              title={`Act ${a} 시작 직후로 이동 (afterPhotoIndex=${target})`}>
              Act {ROMAN[a] ?? a}
            </button>
          );
        })}
      </div>
    </>
  );
};

// ─── Name selector modal (first-visit gate) ──

const NAME_PRESETS = ["예찬", "슬기", "향기"];

const NameSelectorModal: React.FC<{ onSelect: (name: string) => void }> = ({ onSelect }) => {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const submitCustom = () => {
    const v = customValue.trim();
    if (v) onSelect(v);
  };

  return (
    <div className="name-modal-backdrop">
      <div className="name-modal">
        <h2 className="name-modal-title">이름을 선택하세요</h2>
        <p className="name-modal-sub">다른 사람에게 이 이름으로 표시됩니다.</p>
        <div className="name-modal-buttons">
          {NAME_PRESETS.map((p) => (
            <button key={p} className="btn btn-name-preset" onClick={() => onSelect(p)}>
              {p}
            </button>
          ))}
        </div>
        {!customMode ? (
          <button className="btn btn-ghost btn-name-custom-toggle" onClick={() => setCustomMode(true)}>
            기타 (직접 입력)
          </button>
        ) : (
          <div className="name-modal-custom">
            <input
              className="input"
              autoFocus
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitCustom(); }}
              placeholder="이름 입력"
            />
            <button className="btn btn-save" onClick={submitCustom} disabled={!customValue.trim()}>
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Presence chips (header) ─────────────────

const PresenceChips: React.FC<{
  me: { sessionId: string; name: string; color: string };
  others: PresenceUser[];
  photos: PhotoEntry[];
  followSessionId: string | null;
  onToggleFollow: (id: string) => void;
  onRename: (next: string) => void;
}> = ({ me, others, photos, followSessionId, onToggleFollow, onRename }) => {
  const handleRename = () => {
    const next = window.prompt("이름 변경", me.name);
    if (next && next.trim()) onRename(next.trim());
  };
  return (
    <div className="presence">
      <button
        className="presence-chip presence-chip--me"
        style={{ ["--presence-color" as any]: me.color }}
        title="클릭해서 이름 변경"
        onClick={handleRename}
      >
        <span className="presence-dot" />
        {me.name} (나)
      </button>
      {others.map((u) => {
        const viewing = u.currentPhotoIdx !== null && u.currentPhotoIdx !== undefined
          ? photos[u.currentPhotoIdx]?.tag ?? "—"
          : "—";
        const isFollowed = followSessionId === u.sessionId;
        return (
          <button
            key={u.sessionId}
            className={`presence-chip ${isFollowed ? "presence-chip--followed" : ""}`}
            style={{ ["--presence-color" as any]: u.color }}
            title={`${u.name} · ${viewing} 보는 중${isFollowed ? " · 팔로우 중 (클릭해 해제)" : " · 클릭해 팔로우"}`}
            onClick={() => onToggleFollow(u.sessionId)}
          >
            <span className="presence-dot" />
            {u.name}
            {isFollowed && <span className="presence-follow-mark">↪</span>}
          </button>
        );
      })}
    </div>
  );
};

// ─── Comments drawer (right side) ────────────

const CommentsDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  comments: Comment[];
  tab: "current" | "all" | "open";
  setTab: (t: "current" | "all" | "open") => void;
  draft: string;
  setDraft: (s: string) => void;
  currentPhotoTag: string | null;
  authorName: string;
  addComment: (input: NewCommentInput) => Promise<Comment | null>;
  toggleResolved: (id: string, resolved: boolean) => Promise<boolean>;
}> = ({ open, onClose, comments, tab, setTab, draft, setDraft, currentPhotoTag, authorName, addComment, toggleResolved }) => {
  const [anchorChoice, setAnchorChoice] = useState<"photo" | "general">("photo");

  const visible = useMemo(() => {
    if (tab === "open") return comments.filter((c) => !c.resolved);
    if (tab === "current") {
      if (!currentPhotoTag) return comments.filter((c) => c.anchor_type === "general");
      return comments.filter(
        (c) =>
          (c.anchor_type === "photo" && c.anchor_id === currentPhotoTag) ||
          c.anchor_type === "general"
      );
    }
    return comments;
  }, [comments, tab, currentPhotoTag]);

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    const anchor: "photo" | "general" =
      anchorChoice === "photo" && currentPhotoTag ? "photo" : "general";
    const input: NewCommentInput = {
      anchor_type: anchor,
      anchor_id: anchor === "photo" ? currentPhotoTag : null,
      author_name: authorName,
      body,
    };
    const row = await addComment(input);
    if (row) setDraft("");
  };

  if (!open) return null;

  return (
    <aside className="comments-drawer" role="complementary">
      <header className="comments-drawer-header">
        <strong>코멘트</strong>
        <button className="btn-icon" onClick={onClose} title="닫기">✕</button>
      </header>
      <div className="comments-tabs">
        <button className={`tab ${tab === "current" ? "tab--active" : ""}`} onClick={() => setTab("current")}>
          현재 사진
        </button>
        <button className={`tab ${tab === "open" ? "tab--active" : ""}`} onClick={() => setTab("open")}>
          미해결
        </button>
        <button className={`tab ${tab === "all" ? "tab--active" : ""}`} onClick={() => setTab("all")}>
          전체
        </button>
      </div>
      <div className="comments-list">
        {visible.length === 0 && (
          <div className="comments-empty">아직 코멘트가 없습니다.</div>
        )}
        {visible.map((c) => (
          <div key={c.id} className={`comment ${c.resolved ? "comment--resolved" : ""}`}>
            <div className="comment-meta">
              <span className="comment-author">{c.author_name}</span>
              <span className="comment-time">
                {new Date(c.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              {c.anchor_type === "photo" && c.anchor_id && (
                <span className="comment-anchor">📷 {c.anchor_id}</span>
              )}
              {c.anchor_type === "general" && (
                <span className="comment-anchor comment-anchor--general">전체</span>
              )}
            </div>
            <div className="comment-body">{c.body}</div>
            <div className="comment-actions">
              <button
                className="btn btn-xs"
                onClick={() => toggleResolved(c.id, !c.resolved)}
                title={c.resolved ? "다시 열기" : "해결됨으로 표시"}
              >
                {c.resolved ? "↺ 열기" : "✓ 해결"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="comments-composer">
        <div className="composer-anchor-row">
          <label>
            <input
              type="radio"
              name="comment-anchor"
              checked={anchorChoice === "photo" && !!currentPhotoTag}
              disabled={!currentPhotoTag}
              onChange={() => setAnchorChoice("photo")}
            />
            현재 사진 ({currentPhotoTag ?? "없음"})
          </label>
          <label>
            <input
              type="radio"
              name="comment-anchor"
              checked={anchorChoice === "general" || !currentPhotoTag}
              onChange={() => setAnchorChoice("general")}
            />
            전체
          </label>
        </div>
        <textarea
          className="composer-textarea"
          placeholder="코멘트..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
        />
        <div className="composer-actions">
          <span className="composer-hint">⌘/Ctrl + Enter</span>
          <button className="btn btn-save" onClick={submit} disabled={!draft.trim()}>
            전송
          </button>
        </div>
      </div>
    </aside>
  );
};

// ─── App ─────────────────────────────────────

export const App: React.FC = () => {
  // ── All state declarations FIRST ────────────
  const [config, setConfig] = useState<VideoConfig>(defaultConfig);
  const [openActs, setOpenActs] = useState<Set<number>>(new Set());
  const [openEnding, setOpenEnding] = useState(false);
  const [editorTarget, setEditorTarget] = useState<number | null>(null);
  const [editorInitialMode, setEditorInitialMode] = useState<EditorMode | null>(null);
  const [panelTab, setPanelTab] = useState<"edit" | "assets">("edit");
  const [assetTarget, setAssetTarget] = useState<"global" | "current">("current");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("theme") as "dark" | "light") ?? "light";
  });
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  // Realtime collaboration state
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentTab, setCommentTab] = useState<"current" | "all" | "open">("current");
  const [commentDraft, setCommentDraft] = useState("");
  const [followSessionId, setFollowSessionId] = useState<string | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstSave = useRef(true);
  // Points at the VideoConfig object that was last applied from a peer broadcast.
  // The auto-save and broadcast effects skip when config === this ref value,
  // preventing a remote edit from being echoed back or re-saved by this client.
  const remoteAppliedConfigRef = useRef<VideoConfig | null>(null);
  const lastFollowedIdxRef = useRef<number | null>(null);

  // ── Derived values ──────────────────────────
  const currentPhotoIdx = getPhotoIndexAtFrame(currentFrame, config);
  const currentPhoto = currentPhotoIdx !== null ? config.photos[currentPhotoIdx] : null;
  const totalFrames = computeTotalFrames(config);
  const totalSec = totalFrames / config.fps;

  // ── Realtime: identity, broadcast+presence, comments ──
  const identity = useDisplayIdentity();
  const hasName = !!identity.name;
  const { others } = useEditorChannel({
    identity,
    config,
    setConfig,
    loading,
    currentPhotoIdx,
    remoteAppliedConfigRef,
    enabled: hasName,
  });
  const { comments, addComment, toggleResolved } = useComments();

  // Unresolved comment count per photo.tag (+ "__general__" bucket).
  const commentCountByTag = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of comments) {
      if (c.resolved) continue;
      const key = c.anchor_type === "photo" && c.anchor_id ? c.anchor_id : "__general__";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [comments]);

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

  // ── Load from Supabase on mount (공유 편집 모드) ─────────────
  useEffect(() => {
    loadConfig().then((saved) => {
      if (saved) {
        // Mark the loaded config as "remote-applied" so the broadcast effect
        // skips sending it. Without this, each tab that opens would immediately
        // broadcast its freshly-loaded (potentially stale) config and wipe any
        // unsaved edits other peers are currently typing.
        remoteAppliedConfigRef.current = saved;
        setConfig(saved);
      }
      setLoading(false);
    });
  }, []);

  // ── Auto-save to Supabase (debounced 2s) ────
  useEffect(() => {
    if (loading) return;
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    // Skip when this config arrived from a peer broadcast — the peer that
    // originated the edit will save it; duplicate saves waste requests and
    // can lose writes under concurrent edits.
    if (config === remoteAppliedConfigRef.current) return;
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

  // ── Follow mode: seek Player to followed peer's photo ──
  useEffect(() => {
    if (!followSessionId) { lastFollowedIdxRef.current = null; return; }
    const target = others.find((o) => o.sessionId === followSessionId);
    if (!target || target.currentPhotoIdx === null || target.currentPhotoIdx === undefined) return;
    if (target.currentPhotoIdx === lastFollowedIdxRef.current) return;
    lastFollowedIdxRef.current = target.currentPhotoIdx;
    const frame = getPhotoStartFrame(target.currentPhotoIdx, config);
    try { playerRef.current?.seekTo(frame); } catch {}
  }, [others, followSessionId, config]);

  // Drop follow when the followed user leaves.
  useEffect(() => {
    if (followSessionId && !others.some((o) => o.sessionId === followSessionId)) {
      setFollowSessionId(null);
    }
  }, [others, followSessionId]);

  // ── Preload ALL images upfront so polaroid pairs sync and collages don't pop in late ──
  // Includes: photos, collage slot photos. (Interstitial assets like letters don't use images.)
  useEffect(() => {
    if (loading) return;
    const urls = new Set<string>();
    for (const p of config.photos) {
      if (p.file) urls.add(p.file);
    }
    for (const c of config.collages ?? []) {
      for (const s of c.slots) {
        if (s.file) urls.add(s.file);
      }
    }
    urls.forEach((url) => {
      const img = new Image();
      img.src = url.startsWith("http") ? url : `/${url}`;
    });
  }, [loading, config.photos, config.collages]);

  // Open the image editor modal from the caption list's "드래그 편집" button —
  // force the caption tab so the drag UI is immediately usable.
  const openCaptionPositionEditor = useCallback((idx: number) => {
    setEditorInitialMode("caption");
    setEditorTarget(idx);
  }, []);

  // ── updaters ────────────────────────────────

  // Auto-fit photo durationSec to caption length so typing animation has enough room.
  // Target ~3.75 Korean chars/sec typing (matches typedTextSlice's 8 fpc @ 30fps) so
  // guests of all ages can follow live. Formula tuned to give comfortable hold + fade.
  //   pair-left : dur ≥ 0.35 × max(L,R)자 + 4       (each caption gets ~43% of scene)
  //   single    : dur ≥ 0.28 × max_cap_len자 + 4    (caption uses most of scene)
  // Only BUMPS upward — if user has already set a longer dur we respect it, and we
  // never shrink after caption is shortened/deleted (they can manually dial down).
  const maxCaptionLen = (photo: PhotoEntry | undefined): number => {
    if (!photo) return 0;
    let m = 0;
    for (const c of photo.captions ?? []) m = Math.max(m, (c.text ?? "").length);
    if (photo.caption?.text) m = Math.max(m, photo.caption.text.length);
    return m;
  };

  const withEnforcedDurs = useCallback((photos: PhotoEntry[]): PhotoEntry[] => {
    return photos.map((p, i) => {
      const isLeft  = !!p.splitPair && i + 1 < photos.length;
      const isRight = i > 0 && !!photos[i - 1]?.splitPair;
      if (isRight) return p; // right-of-pair dur is ignored by renderer
      const ownMax = maxCaptionLen(p);
      let requiredDur = 0;
      if (isLeft) {
        const partnerMax = maxCaptionLen(photos[i + 1]);
        const len = Math.max(ownMax, partnerMax);
        if (len > 0) requiredDur = 0.35 * len + 4;
      } else if (ownMax > 0) {
        requiredDur = 0.28 * ownMax + 4;
      }
      if (requiredDur > 0 && p.durationSec < requiredDur) {
        return { ...p, durationSec: Math.round(requiredDur * 10) / 10 };
      }
      return p;
    });
  }, []);

  const updatePhoto = useCallback((idx: number, patch: Partial<PhotoEntry>) => {
    setConfig((c) => {
      let photos = c.photos.map((p, i) => (i === idx ? { ...p, ...patch } : p));
      // Re-fit durs whenever anything that affects the formula changes.
      if ("captions" in patch || "caption" in patch || "splitPair" in patch) {
        photos = withEnforcedDurs(photos);
      }
      return { ...c, photos };
    });
  }, [withEnforcedDurs]);

  const updateCaption = useCallback((idx: number, patch: Partial<CaptionConfig> | null) => {
    setConfig((c) => {
      const photos: PhotoEntry[] = c.photos.map((p, i) => {
        if (i !== idx) return p;
        if (patch === null) return { ...p, caption: undefined };
        const merged: CaptionConfig = { text: "", position: "bottom", ...p.caption, ...patch };
        return { ...p, caption: merged };
      });
      return { ...c, photos: withEnforcedDurs(photos) };
    });
  }, [withEnforcedDurs]);

  // ── Multi-caption (CaptionEntry[]) ───────────
  const makeCaptionId = () => `cap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const addCaptionEntry = useCallback((idx: number, preset?: Partial<CaptionEntry>) => {
    setConfig((c) => {
      const target = c.photos[idx];
      if (!target) return c;
      // Polaroid/split pair: left & right captions merge onto one canvas in render.
      // Count BOTH sides so a cap added to one side doesn't collide with the other.
      // Also bias x to the side the photo is on, so pair captions don't pile in one column.
      const isLeftOfPair  = !!target.splitPair;
      const isRightOfPair = idx > 0 && !!c.photos[idx - 1]?.splitPair;
      const partner =
        isLeftOfPair  ? c.photos[idx + 1] :
        isRightOfPair ? c.photos[idx - 1] : null;
      const ownCount     = materializeCaptions(target).length;
      const partnerCount = partner ? materializeCaptions(partner).length : 0;
      const totalCount   = ownCount + partnerCount;

      // Auto-stack y: each extra caption (across the pair) sits ~0.075 higher.
      const yBase = 0.88;
      const yStep = 0.075;
      const stackedY = Math.max(0.08, yBase - totalCount * yStep);
      // Bias x column so left-side captions visually live on the left half, right on right.
      const defaultX =
        isLeftOfPair  ? 0.30 :
        isRightOfPair ? 0.70 : 0.50;

      const newCap: CaptionEntry = {
        id: makeCaptionId(),
        text: "",
        x: defaultX,
        y: stackedY,
        align: "center",
        fontFamily: "serif",
        fontSize: 32,
        ...preset,
      };
      const photos = c.photos.map((p, i) => {
        if (i !== idx) return p;
        const existing = materializeCaptions(p);
        return { ...p, captions: [...existing, newCap], caption: undefined };
      });
      return { ...c, photos: withEnforcedDurs(photos) };
    });
  }, [withEnforcedDurs]);

  const updateCaptionEntry = useCallback((idx: number, capId: string, patch: Partial<CaptionEntry>) => {
    setConfig((c) => {
      const photos = c.photos.map((p, i) => {
        if (i !== idx) return p;
        // Materialize first so edits to a legacy-derived caption actually persist.
        const current = materializeCaptions(p);
        const next = current.map((cap) => cap.id === capId ? { ...cap, ...patch } : cap);
        // If the passed capId didn't match any (e.g. stale "legacy-view"), fall back to
        // patching the first entry — keeps the edit from being silently dropped.
        const matched = next.some((cap, j) => cap !== current[j]);
        const finalList = matched ? next
          : current.length ? [{ ...current[0], ...patch }, ...current.slice(1)]
          : current;
        return { ...p, captions: finalList, caption: undefined };
      });
      return { ...c, photos: withEnforcedDurs(photos) };
    });
  }, [withEnforcedDurs]);

  const deleteCaptionEntry = useCallback((idx: number, capId: string) => {
    setConfig((c) => {
      const photos = c.photos.map((p, i) => {
        if (i !== idx) return p;
        const current = materializeCaptions(p);
        const remaining = current.filter((cap) => cap.id !== capId);
        // If capId didn't match (stale view id), fall back to removing the first entry.
        const finalList = remaining.length !== current.length ? remaining : current.slice(1);
        return { ...p, captions: finalList.length ? finalList : undefined, caption: undefined };
      });
      // Note: deletion never shrinks dur — enforce only bumps upward.
      return { ...c, photos: withEnforcedDurs(photos) };
    });
  }, [withEnforcedDurs]);

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

  const addJourneyMapAfter = (photoIdx: number, visibleCount?: number) => {
    const newMap: JourneyMap = {
      id: `jm${Date.now()}`,
      afterPhotoIndex: photoIdx,
      title: "Our Journey",
      durationSec: 8.0,
      ...(visibleCount !== undefined ? { visibleCount } : {}),
    };
    setConfig((c) => ({ ...c, journeyMaps: [...(c.journeyMaps ?? []), newMap] }));
  };
  const updateJourneyMap = (id: string, patch: Partial<{ title: string; subtitle: string; caption: string; durationSec: number; visibleCount: number; afterPhotoIndex: number }>) => {
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

  // ── Chat interlude ───────────────────────────
  const addChatAfter = (photoIdx: number) => {
    const newChat: ChatInterlude = {
      id: `ci${Date.now()}`,
      afterPhotoIndex: photoIdx,
      header: "",
      messages: [
        { speaker: "예찬", side: "left", text: "" },
        { speaker: "슬기", side: "right", text: "" },
      ],
      durationSec: 12.0,
    };
    setConfig((c) => ({ ...c, chatInterludes: [...(c.chatInterludes ?? []), newChat] }));
  };
  const updateChat = (id: string, patch: Partial<Pick<ChatInterlude, "header" | "durationSec" | "afterPhotoIndex">>) => {
    setConfig((c) => ({
      ...c,
      chatInterludes: (c.chatInterludes ?? []).map((ch) => ch.id === id ? { ...ch, ...patch } : ch),
    }));
  };
  const deleteChat = (id: string) => {
    setConfig((c) => ({ ...c, chatInterludes: (c.chatInterludes ?? []).filter((ch) => ch.id !== id) }));
  };
  const addChatMessage = (id: string) => {
    setConfig((c) => ({
      ...c,
      chatInterludes: (c.chatInterludes ?? []).map((ch) => ch.id === id
        ? { ...ch, messages: [...ch.messages, { speaker: "", side: "left", text: "" }] }
        : ch),
    }));
  };
  const updateChatMessage = (id: string, msgIdx: number, patch: Partial<ChatMessage>) => {
    setConfig((c) => ({
      ...c,
      chatInterludes: (c.chatInterludes ?? []).map((ch) => {
        if (ch.id !== id) return ch;
        return {
          ...ch,
          messages: ch.messages.map((m, i) => i === msgIdx ? { ...m, ...patch } : m),
        };
      }),
    }));
  };
  const removeChatMessage = (id: string, msgIdx: number) => {
    setConfig((c) => ({
      ...c,
      chatInterludes: (c.chatInterludes ?? []).map((ch) => {
        if (ch.id !== id) return ch;
        return { ...ch, messages: ch.messages.filter((_, i) => i !== msgIdx) };
      }),
    }));
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
  const updateCollage = (id: string, patch: Partial<{ durationSec: number; caption: string }>) => {
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

  // afterPhotoIndex values that correspond to "right after an Act title card"
  //   (one per Act). Items at these positions render in the Act-start panel,
  //   not attached to any photo card.
  const actStartIndices = new Set<number>(
    acts.map((a) => (photosByAct[a]?.[0]?.idx ?? 0) - 1)
  );

  // ── render ──────────────────────────────────

  if (loading) {
    return (
      <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#e8d09b", fontSize: 18 }}>불러오는 중...</div>
        {!hasName && <NameSelectorModal onSelect={identity.rename} />}
      </div>
    );
  }

  return (
    <div className="app">
      {!hasName && <NameSelectorModal onSelect={identity.rename} />}
      <header className="header">
        <h1 className="logo">식전영상 에디터</h1>
        <div className="header-info">
          {Math.floor(totalSec / 60)}분 {Math.round(totalSec % 60)}초 &middot; {config.photos.length}장 &middot; {acts.length} Acts
          {saveStatus === "saving" && <span className="save-dot saving">저장 중...</span>}
          {saveStatus === "saved" && <span className="save-dot saved">저장 완료</span>}
          {saveStatus === "idle" && <span className="save-dot idle">자동 저장</span>}
        </div>
        <PresenceChips
          me={{ sessionId: identity.sessionId, name: identity.name, color: identity.color }}
          others={others}
          photos={config.photos}
          followSessionId={followSessionId}
          onToggleFollow={(id) => setFollowSessionId((cur) => (cur === id ? null : id))}
          onRename={identity.rename}
        />
        <div className="header-actions">
          <button
            className="btn btn-ghost btn-comments"
            onClick={() => setCommentsOpen((v) => !v)}
            title="코멘트"
          >
            💬 {comments.filter((c) => !c.resolved).length > 0 ? comments.filter((c) => !c.resolved).length : ""}
          </button>
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

      <CommentsDrawer
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={comments}
        tab={commentTab}
        setTab={setCommentTab}
        draft={commentDraft}
        setDraft={setCommentDraft}
        currentPhotoTag={currentPhoto?.tag ?? null}
        authorName={identity.name}
        addComment={addComment}
        toggleResolved={toggleResolved}
      />

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
                    <input type="range" className="slider" min={0} max={1.0} step={0.01}
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

                    {/* Act-start interstitials (shown right after the Act title card) */}
                    {(() => {
                      const firstIdx = actPhotos[0]?.idx;
                      if (firstIdx === undefined) return null;
                      const actStartIdx = firstIdx - 1;
                      const actStartMaps = (config.journeyMaps ?? []).filter((m) => m.afterPhotoIndex === actStartIdx);
                      const actStartChats = (config.chatInterludes ?? []).filter((ch) => ch.afterPhotoIndex === actStartIdx);
                      return (
                        <div className="moment-editor" style={{ borderColor: "#5a7a8a", borderStyle: "dashed", marginBottom: 10 }}>
                          <div className="moment-editor-header">
                            <span className="moment-editor-label" style={{ color: "#6a8aa0" }}>
                              ▸ Act {ROMAN[act] ?? act} 시작 직후 (타이틀 카드 다음)
                            </span>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-xs btn-moment-add"
                                onClick={() => addJourneyMapAfter(actStartIdx, act)}
                                title="이 Act 시작 직후에 여정 지도 삽입">
                                + 지도
                              </button>
                              <button className="btn btn-xs btn-moment-add"
                                onClick={() => addChatAfter(actStartIdx)}
                                title="이 Act 시작 직후에 대화 씬 삽입">
                                + 대화
                              </button>
                            </div>
                          </div>
                          {actStartMaps.length === 0 && actStartChats.length === 0 && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 0" }}>
                              아직 인터스티셜이 없습니다.
                            </div>
                          )}
                          {actStartMaps.map((m) => (
                            <div key={m.id} className="moment-editor" style={{ borderColor: "#5a7a8a", marginTop: 8 }}>
                              <div className="moment-editor-header">
                                <span className="moment-editor-label" style={{ color: "#6a8aa0" }}>여정 지도</span>
                                <button className="btn-icon btn-icon--danger" onClick={() => deleteJourneyMap(m.id)}>&#10005;</button>
                              </div>
                              <JourneyMapFields
                                m={m}
                                acts={acts}
                                photosByAct={photosByAct}
                                updateJourneyMap={updateJourneyMap}
                              />
                            </div>
                          ))}
                          {actStartChats.map((ch) => (
                            <div key={ch.id} className="moment-editor" style={{ borderColor: "#3a7a8a", marginTop: 8 }}>
                              <div className="moment-editor-header">
                                <span className="moment-editor-label" style={{ color: "#5aa0b0" }}>대화 씬 ({ch.messages.length}개 메시지)</span>
                                <button className="btn-icon btn-icon--danger" onClick={() => deleteChat(ch.id)}>&#10005;</button>
                              </div>
                              <input className="input input-sm" placeholder="상단 헤더 (예: 성모병원 · 1988)" value={ch.header ?? ""}
                                onChange={(e) => updateChat(ch.id, { header: e.target.value })} />
                              {ch.messages.map((m, mi) => (
                                <div key={mi} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 6, background: "var(--bg-surface)", borderRadius: 4 }}>
                                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                    <input className="input input-sm" placeholder="화자" value={m.speaker}
                                      onChange={(e) => updateChatMessage(ch.id, mi, { speaker: e.target.value })}
                                      style={{ flex: 1 }} />
                                    <select className="select select-sm" value={m.side ?? "left"}
                                      onChange={(e) => updateChatMessage(ch.id, mi, { side: e.target.value as "left" | "right" })}
                                      style={{ flex: 1 }} title="버블 방향">
                                      <option value="left">← 왼쪽</option>
                                      <option value="right">오른쪽 →</option>
                                    </select>
                                    <button className="btn-icon btn-icon--danger" onClick={() => removeChatMessage(ch.id, mi)}
                                      disabled={ch.messages.length <= 1} title="메시지 삭제">&#10005;</button>
                                  </div>
                                  <textarea className="input input-sm" placeholder="메시지 (비우면 ... 타이핑 인디케이터)"
                                    value={m.text} rows={2}
                                    onChange={(e) => updateChatMessage(ch.id, mi, { text: e.target.value })} />
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: 4 }}>
                                <button className="btn btn-xs btn-moment-add" onClick={() => addChatMessage(ch.id)} style={{ flex: 2 }}>
                                  + 메시지 추가
                                </button>
                                <input className="input input-sm" type="number" step="0.5" min="4" max="30"
                                  value={ch.durationSec ?? 12.0}
                                  onChange={(e) => updateChat(ch.id, { durationSec: parseFloat(e.target.value) })}
                                  style={{ flex: 1 }} title="지속(초)" />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {actPhotos.map(({ photo, idx }, localIdx) => {
                      const openCount = commentCountByTag.get(photo.tag) ?? 0;
                      return (
                      <div key={idx} className="photo-card">
                        <div className="thumb-wrap" onClick={() => setEditorTarget(idx)} title="이미지 편집">
                          <img src={photoSrc(photo.file)} alt={photo.tag} className="photo-thumb" />
                          <div className="focal-dot" style={{ left: `${photo.focalPoint.x * 100}%`, top: `${photo.focalPoint.y * 100}%` }} />
                          {(photo.spotlights?.length ?? 0) > 0 && (
                            <div className="spot-badge">{photo.spotlights?.length}</div>
                          )}
                          {openCount > 0 && (
                            <div
                              className="comment-badge"
                              title={`미해결 코멘트 ${openCount}건`}
                              onClick={(e) => { e.stopPropagation(); setCommentsOpen(true); setCommentTab("current"); setEditorTarget(idx); }}
                            >
                              💬 {openCount}
                            </div>
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
                          <CaptionsEditor
                            photoIdx={idx}
                            captions={materializeCaptions(photo)}
                            onAdd={addCaptionEntry}
                            onUpdate={updateCaptionEntry}
                            onDelete={deleteCaptionEntry}
                            onOpenPositionEditor={openCaptionPositionEditor}
                          />
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
                          {/* Journey map editor — skip maps at act-start positions (they render in the Act-start panel above) */}
                          {(config.journeyMaps ?? [])
                            .filter((m) => m.afterPhotoIndex === idx && !actStartIndices.has(idx))
                            .map((m) => (
                            <div key={m.id} className="moment-editor" style={{ borderColor: "#5a7a8a" }}>
                              <div className="moment-editor-header">
                                <span className="moment-editor-label" style={{ color: "#6a8aa0" }}>여정 지도 (다음 사진 직전)</span>
                                <button className="btn-icon btn-icon--danger" onClick={() => deleteJourneyMap(m.id)}>&#10005;</button>
                              </div>
                              <JourneyMapFields
                                m={m}
                                acts={acts}
                                photosByAct={photosByAct}
                                updateJourneyMap={updateJourneyMap}
                              />
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
                          {/* Chat interlude editor — skip chats at act-start positions (rendered in Act-start panel above) */}
                          {(config.chatInterludes ?? [])
                            .filter((ch) => ch.afterPhotoIndex === idx && !actStartIndices.has(idx))
                            .map((ch) => (
                            <div key={ch.id} className="moment-editor" style={{ borderColor: "#3a7a8a" }}>
                              <div className="moment-editor-header">
                                <span className="moment-editor-label" style={{ color: "#5aa0b0" }}>대화 씬 ({ch.messages.length}개 메시지)</span>
                                <button className="btn-icon btn-icon--danger" onClick={() => deleteChat(ch.id)}>&#10005;</button>
                              </div>
                              <input className="input input-sm" placeholder="상단 헤더 (예: 성모병원 · 1988)" value={ch.header ?? ""}
                                onChange={(e) => updateChat(ch.id, { header: e.target.value })} />
                              {ch.messages.map((m, mi) => (
                                <div key={mi} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 6, background: "var(--bg-surface)", borderRadius: 4 }}>
                                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                    <input className="input input-sm" placeholder="화자" value={m.speaker}
                                      onChange={(e) => updateChatMessage(ch.id, mi, { speaker: e.target.value })}
                                      style={{ flex: 1 }} />
                                    <select className="select select-sm" value={m.side ?? "left"}
                                      onChange={(e) => updateChatMessage(ch.id, mi, { side: e.target.value as "left" | "right" })}
                                      style={{ flex: 1 }} title="버블 방향">
                                      <option value="left">← 왼쪽</option>
                                      <option value="right">오른쪽 →</option>
                                    </select>
                                    <button className="btn-icon btn-icon--danger" onClick={() => removeChatMessage(ch.id, mi)}
                                      disabled={ch.messages.length <= 1} title="메시지 삭제">&#10005;</button>
                                  </div>
                                  <textarea className="input input-sm" placeholder="메시지 (비우면 ... 타이핑 인디케이터)"
                                    value={m.text} rows={2}
                                    onChange={(e) => updateChatMessage(ch.id, mi, { text: e.target.value })} />
                                </div>
                              ))}
                              <div style={{ display: "flex", gap: 4 }}>
                                <button className="btn btn-xs btn-moment-add" onClick={() => addChatMessage(ch.id)} style={{ flex: 2 }}>
                                  + 메시지 추가
                                </button>
                                <input className="input input-sm" type="number" step="0.5" min="4" max="30"
                                  value={ch.durationSec ?? 12.0}
                                  onChange={(e) => updateChat(ch.id, { durationSec: parseFloat(e.target.value) })}
                                  style={{ flex: 1 }} title="지속(초)" />
                              </div>
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
                              <textarea className="input input-sm" placeholder="하단 씬 캡션 (선택) — 박스 아래에 손글씨체로 표시"
                                rows={2}
                                value={col.caption ?? ""}
                                onChange={(e) => updateCollage(col.id, { caption: e.target.value })}
                                style={{ resize: "vertical", marginTop: 4 }} />
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
                            <button className="btn btn-xs btn-moment-add" onClick={() => addChatAfter(idx)} title="대화 씬 삽입 (타이핑 연출)" style={{ flex: 1, minWidth: 80 }}>+ 대화</button>
                            <button className="btn btn-xs btn-moment-add" onClick={() => addCollageAfter(idx)} title="폴라로이드 콜라주 삽입" style={{ flex: 1, minWidth: 80 }}>+ 콜라주</button>
                          </div>
                        </div>
                      </div>
                      );
                    })}
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
          initialMode={editorInitialMode ?? undefined}
          onUpdatePhoto={(patch) => updatePhoto(editorTarget, patch)}
          onUpdateKenBurnsAmount={(val) => setConfig((c) => ({ ...c, kenBurnsAmount: val }))}
          onClose={() => { setEditorTarget(null); setEditorInitialMode(null); }}
        />
      )}
    </div>
  );
};
