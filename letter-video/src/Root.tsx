import React from "react";
import { Composition } from "remotion";
import { MainVideo, totalFrames } from "./Composition";
import { FPS } from "./manifest";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={MainVideo}
        durationInFrames={Math.max(totalFrames, 1)}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
