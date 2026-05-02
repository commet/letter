// Render a single frame to PNG for fast verification (font loading, layout, etc.)
// Usage: node scripts/render-still.mjs [frameOffset]
//   frameOffset: frames from end (default 60 = 2s before end)

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
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

async function main() {
  const fromEnd = parseInt(process.argv[2] ?? "60", 10);

  const { data, error } = await supabase
    .from("letter_video_configs")
    .select("config")
    .eq("id", CONFIG_ID)
    .single();
  if (error) throw error;
  const config = data.config;

  console.log("→ Bundling…");
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src/render-entry.ts"),
    publicDir: path.join(ROOT, "public"),
    webpackOverride: (c) => c,
  });

  const composition = await selectComposition({
    serveUrl,
    id: "Main",
    inputProps: config,
  });
  const frame = Math.max(0, composition.durationInFrames - fromEnd);
  console.log(`  frame ${frame} / ${composition.durationInFrames}`);

  const out = path.join(ROOT, "out", `still-${frame}.png`);
  await mkdir(path.dirname(out), { recursive: true });

  console.log(`→ Rendering still → ${out}`);
  await renderStill({
    composition,
    serveUrl,
    output: out,
    inputProps: config,
    frame,
  });
  console.log(`✓ ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
