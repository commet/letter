// Shared arrow geometry / style helpers.
// Used by both the editor preview (App.tsx) and the video renderer (VideoComposition.tsx)
// so the editor's WYSIWYG matches what plays back in the timeline.

import {
  AnnotationArrow,
  ArrowStyle,
  ArrowColor,
  ARROW_COLOR_MAP,
} from "./data";

export type ArrowPathInfo = {
  d: string;           // SVG path in viewBox 0-100 units
  tipAngleDeg: number; // tangent at the tip (arrowhead rotation)
};

export const buildArrowPath = (a: Pick<AnnotationArrow, "labelX" | "labelY" | "tipX" | "tipY" | "style">): ArrowPathInfo => {
  const lx = a.labelX * 100, ly = a.labelY * 100;
  const tx = a.tipX * 100, ty = a.tipY * 100;
  // Shrink start slightly so arrow doesn't start under the label box
  const sx = lx + (tx - lx) * 0.08;
  const sy = ly + (ty - ly) * 0.08;
  const isCurve = a.style === "curve" || a.style === "bold-curve" || !a.style;
  if (isCurve) {
    const mx = (sx + tx) / 2, my = (sy + ty) / 2;
    const dx = tx - sx, dy = ty - sy;
    const normLen = Math.hypot(dx, dy) || 1;
    const perpX = -dy / normLen, perpY = dx / normLen;
    const bow = normLen * 0.18;
    const cx = mx + perpX * bow;
    const cy = my + perpY * bow;
    return {
      d: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`,
      tipAngleDeg: Math.atan2(ty - cy, tx - cx) * 180 / Math.PI,
    };
  }
  return {
    d: `M ${sx} ${sy} L ${tx} ${ty}`,
    tipAngleDeg: Math.atan2(ty - sy, tx - sx) * 180 / Math.PI,
  };
};

export const arrowStroke = (style?: ArrowStyle, color?: ArrowColor) => {
  // Implicit per-style default color (preserves legacy untagged arrows: brush→gold, else→ink).
  const defaultColor = style === "brush" ? ARROW_COLOR_MAP.gold : ARROW_COLOR_MAP.ink;
  const finalColor = color ? (ARROW_COLOR_MAP[color] ?? defaultColor) : defaultColor;
  switch (style) {
    case "marker":        return { color: finalColor, width: 7.5, opacity: 0.88 };
    case "bold-curve":    return { color: finalColor, width: 5.0, opacity: 0.95 };
    case "bold-straight": return { color: finalColor, width: 5.0, opacity: 0.95 };
    case "brush":         return { color: finalColor, width: 4.5, opacity: 0.92 };
    case "dashed":        return { color: finalColor, width: 2,   opacity: 1 };
    case "straight":      return { color: finalColor, width: 2.2, opacity: 1 };
    case "curve":
    default:              return { color: finalColor, width: 2.4, opacity: 1 };
  }
};

// Arrowhead triangle path in viewBox units; size tracks stroke weight so bold
// bodies don't get anemic heads.
export const arrowHeadPath = (style?: ArrowStyle): string => {
  switch (style) {
    case "marker":        return "M 0 0 L -4.8 -3.0 L -4.8 3.0 Z";
    case "bold-curve":
    case "bold-straight": return "M 0 0 L -4.0 -2.4 L -4.0 2.4 Z";
    case "brush":         return "M 0 0 L -3.5 -2.0 L -3.5 2.0 Z";
    default:              return "M 0 0 L -2.6 -1.5 L -2.6 1.5 Z";
  }
};

export type ArrowPreset = {
  style: ArrowStyle;
  color: ArrowColor;
  label: string;
};

// Preset palette — pick one and drop it on the image.
// Order: thin classics first, bold bodies second (what the user asked for).
export const ARROW_PRESETS: ArrowPreset[] = [
  { style: "curve",         color: "ink",  label: "곡선" },
  { style: "straight",      color: "ink",  label: "직선" },
  { style: "dashed",        color: "ink",  label: "점선" },
  { style: "brush",         color: "gold", label: "붓질" },
  { style: "bold-curve",    color: "ink",  label: "굵은 곡선" },
  { style: "bold-straight", color: "ink",  label: "굵은 직선" },
  { style: "marker",        color: "ink",  label: "마커" },
];
