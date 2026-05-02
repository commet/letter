// Render the live editor composition (with Supabase config) to MP4.
// Usage: node scripts/render.mjs [outputPath]
//
// Fetches the saved video config from Supabase, applies the same audio-deep-merge
// as supabase.ts loadConfig, then bundles + renders via Remotion.

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SUPABASE_URL = "https://hgltvdshuyfffskvjmst.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnbHR2ZHNodXlmZmZza3ZqbXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0ODk1MzEsImV4cCI6MjA2ODA2NTUzMX0.PyoZ0e0P5NtWjMimxGimsJQ6nfFNRFmT4i0bRMEjxTk";
const CONFIG_ID = "6551e0e3-cf5a-465b-89cc-58c597471a1e";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchConfig() {
  const { data, error } = await supabase
    .from("letter_video_configs")
    .select("config")
    .eq("id", CONFIG_ID)
    .single();
  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  if (!data?.config) throw new Error("Empty config in Supabase");
  return data.config;
}

// We use the raw saved config from Supabase. The DB row is already migrated
// (the editor auto-saves migrated state on load) and we just SQL-updated audio
// to have the latest fade/offset values. No client-side merge needed here —
// importing data.ts from a plain .mjs would require a TS loader anyway.
async function loadAndMerge() {
  return await fetchConfig();
}

async function main() {
  const outputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(ROOT, "out", `letter-${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`);

  await mkdir(path.dirname(outputPath), { recursive: true });

  console.log("→ Fetching live config from Supabase…");
  const config = await loadAndMerge();
  console.log(`  photos=${config.photos?.length ?? 0}  fps=${config.fps}  audio.trackBStartSec=${config.audio?.trackBStartSec}`);

  console.log("→ Bundling Remotion entry…");
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src/render-entry.ts"),
    publicDir: path.join(ROOT, "public"),
    webpackOverride: (c) => c,
  });
  console.log(`  bundled at ${serveUrl}`);

  console.log("→ Resolving composition (this computes total frames)…");
  const composition = await selectComposition({
    serveUrl,
    id: "Main",
    inputProps: config,
  });
  console.log(`  ${composition.durationInFrames} frames @ ${composition.fps}fps = ${(composition.durationInFrames / composition.fps).toFixed(1)}s, ${composition.width}x${composition.height}`);

  console.log(`→ Rendering MP4 → ${outputPath}`);
  console.log("  (this can take 20-60 minutes for a 5+ min 1080p video)");
  const startedAt = Date.now();

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: config,
    onProgress: ({ progress, renderedFrames, encodedFrames }) => {
      const pct = (progress * 100).toFixed(1);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
      process.stdout.write(`\r  ${pct}%  rendered=${renderedFrames}/${composition.durationInFrames}  encoded=${encodedFrames}  ${elapsed}s elapsed   `);
    },
    chromiumOptions: {
      headless: true,
    },
    concurrency: null,
  });

  const totalSec = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(`\n✓ Done in ${totalSec}s → ${outputPath}`);
}

main().catch((err) => {
  console.error("\n✗ Render failed:", err);
  process.exit(1);
});
