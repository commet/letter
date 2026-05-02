import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./VideoComposition";
import { computeTotalFrames, defaultConfig, VideoConfig } from "./data";

// Load Google Fonts via @remotion/google-fonts. The editor preview gets these
// via index.html, but Remotion's bundled HTML doesn't carry that <link> tag, so
// 'Nanum Brush Script' (ending name calligraphy) etc. fall back to generic
// cursive in headless Chrome. The official package handles delayRender +
// font-face loading correctly across both Studio and bundled-render contexts.
import { loadFont as loadNanumBrushScript } from "@remotion/google-fonts/NanumBrushScript";
import { loadFont as loadNanumPenScript } from "@remotion/google-fonts/NanumPenScript";
import { loadFont as loadNanumMyeongjo } from "@remotion/google-fonts/NanumMyeongjo";
import { loadFont as loadGowunBatang } from "@remotion/google-fonts/GowunBatang";
import { loadFont as loadGowunDodum } from "@remotion/google-fonts/GowunDodum";
import { loadFont as loadGaegu } from "@remotion/google-fonts/Gaegu";
import { loadFont as loadCormorantGaramond } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadEBGaramond } from "@remotion/google-fonts/EBGaramond";

loadNanumBrushScript();
loadNanumPenScript();
loadNanumMyeongjo();
loadGowunBatang();
loadGowunDodum();
loadGaegu();
loadCormorantGaramond();
loadEBGaramond();

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Main"
      component={MainVideo as React.ComponentType<Record<string, unknown>>}
      durationInFrames={1}
      fps={defaultConfig.fps}
      width={1920}
      height={1080}
      defaultProps={defaultConfig as unknown as Record<string, unknown>}
      calculateMetadata={({ props }) => {
        const cfg = props as unknown as VideoConfig;
        return {
          durationInFrames: Math.max(1, computeTotalFrames(cfg)),
          fps: cfg.fps,
        };
      }}
    />
  );
};
