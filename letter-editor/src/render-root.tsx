import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./VideoComposition";
import { computeTotalFrames, defaultConfig, VideoConfig } from "./data";

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
