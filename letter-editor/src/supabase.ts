import { createClient } from "@supabase/supabase-js";
import { VideoConfig } from "./data";

const SUPABASE_URL = "https://hgltvdshuyfffskvjmst.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnbHR2ZHNodXlmZmZza3ZqbXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0ODk1MzEsImV4cCI6MjA2ODA2NTUzMX0.PyoZ0e0P5NtWjMimxGimsJQ6nfFNRFmT4i0bRMEjxTk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CONFIG_ID = "6551e0e3-cf5a-465b-89cc-58c597471a1e";

// ─── Config save / load ──────────────────────

export async function loadConfig(): Promise<VideoConfig | null> {
  const { data, error } = await supabase
    .from("letter_video_configs")
    .select("config")
    .eq("id", CONFIG_ID)
    .single();

  if (error || !data?.config) return null;

  // If config is an empty object (initial state), return null so defaults are used
  const cfg = data.config as VideoConfig;
  if (!cfg.photos || cfg.photos.length === 0) return null;

  return cfg;
}

export async function saveConfig(config: VideoConfig): Promise<boolean> {
  const { error } = await supabase
    .from("letter_video_configs")
    .update({ config })
    .eq("id", CONFIG_ID);

  return !error;
}

// ─── Photo upload ────────────────────────────

const PHOTO_BUCKET = "letter-photos";

export async function uploadPhoto(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `uploads/${name}`;

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type });

  if (error) {
    console.error("Upload failed:", error);
    return null;
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
