import { createClient } from "@supabase/supabase-js";
import { VideoConfig, defaultConfig, PhotoEntry, CaptionEntry } from "./data";

const SUPABASE_URL = "https://hgltvdshuyfffskvjmst.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnbHR2ZHNodXlmZmZza3ZqbXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0ODk1MzEsImV4cCI6MjA2ODA2NTUzMX0.PyoZ0e0P5NtWjMimxGimsJQ6nfFNRFmT4i0bRMEjxTk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const CONFIG_ID = "6551e0e3-cf5a-465b-89cc-58c597471a1e";

// ─── Config save / load ──────────────────────

export async function loadConfig(): Promise<VideoConfig | null> {
  const { data, error } = await supabase
    .from("letter_video_configs")
    .select("config")
    .eq("id", CONFIG_ID)
    .single();

  if (error || !data?.config) return null;

  // If config is an empty object (initial state), return null so defaults are used
  const raw = data.config as Partial<VideoConfig>;
  if (!raw.photos || raw.photos.length === 0) return null;

  // Merge with defaults to ensure all fields exist (handles schema evolution)
  return {
    ...defaultConfig,
    ...raw,
    photos: raw.photos.map((p) => {
      // Fill missing fields via nullish fallback instead of spread-over-spread.
      // (Avoids TS2783 duplicate-key warnings and makes "use p's value if set" explicit.)
      const base: PhotoEntry = {
        ...p,
        focalPoint: p.focalPoint ?? { x: 0.5, y: 0.5 },
        transition: p.transition ?? "fade",
        filter: p.filter ?? "none",
        spotlights: p.spotlights ?? [],
      };
      // Migrate legacy single caption → captions[0] if not already present.
      // Always drop `caption` after processing so a deleted caption can't
      // be resurrected on the next load.
      if (base.caption) {
        if (!base.captions || base.captions.length === 0) {
          const legacy: CaptionEntry = {
            id: `cap-legacy-${Math.random().toString(36).slice(2, 9)}`,
            text: base.caption.text,
            x: 0.5,
            y: base.caption.position === "top" ? 0.08 : base.caption.position === "center" ? 0.5 : 0.92,
            align: "center",
            fontFamily: "serif",
            fontSize: 32,
          };
          base.captions = [legacy];
        }
        base.caption = undefined;
      }
      return base;
    }),
  };
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

// ─── AI prompt editing ───────────────────────

const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/video-ai-edit`;

export async function aiEditConfig(
  config: VideoConfig,
  prompt: string
): Promise<VideoConfig | null> {
  try {
    const res = await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, prompt }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error("AI edit error:", err);
      return null;
    }
    const data = await res.json();
    return data.config ?? null;
  } catch (err) {
    console.error("AI edit failed:", err);
    return null;
  }
}

// ─── Photo upload ────────────────────────────

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

// ─── Comments ────────────────────────────────

export type CommentAnchor = "photo" | "general";

export type Comment = {
  id: string;
  config_id: string;
  anchor_type: CommentAnchor;
  anchor_id: string | null;
  author_name: string;
  body: string;
  resolved: boolean;
  created_at: string;
};

export type NewCommentInput = {
  anchor_type: CommentAnchor;
  anchor_id: string | null;
  author_name: string;
  body: string;
};

export async function listComments(): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("letter_comments")
    .select("*")
    .eq("config_id", CONFIG_ID)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Comment[];
}

export async function addComment(input: NewCommentInput): Promise<Comment | null> {
  const { data, error } = await supabase
    .from("letter_comments")
    .insert({
      config_id: CONFIG_ID,
      anchor_type: input.anchor_type,
      anchor_id: input.anchor_id,
      author_name: input.author_name,
      body: input.body,
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as Comment;
}

export async function toggleResolved(id: string, resolved: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("letter_comments")
    .update({ resolved })
    .eq("id", id);
  return !error;
}

export async function deleteComment(id: string): Promise<boolean> {
  const { error } = await supabase.from("letter_comments").delete().eq("id", id);
  return !error;
}
