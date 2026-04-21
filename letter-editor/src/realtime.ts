// Realtime collaboration hooks (Supabase Realtime).
// - useDisplayIdentity: display name + stable per-tab sessionId + color
// - useEditorChannel:   broadcasts config edits + tracks presence of other viewers
// - useComments:        live-synced comment list (postgres_changes subscription)

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, CONFIG_ID, listComments, addComment as addCommentApi, toggleResolved as toggleResolvedApi } from "./supabase";
import type { Comment, NewCommentInput } from "./supabase";
import type { VideoConfig } from "./data";

// ─── Display identity ────────────────────────

const STORAGE_NAME_KEY = "letter-editor.displayName";

function pickColor(seed: string): string {
  // Deterministic hue from sessionId hash — pleasant pastel.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function loadName(): string {
  if (typeof window === "undefined") return "익명";
  const existing = localStorage.getItem(STORAGE_NAME_KEY);
  if (existing && existing.trim()) return existing.trim();
  const entered = window.prompt("이 창에서 사용할 이름을 입력하세요 (다른 사람에게 표시됩니다)", "");
  const name = (entered ?? "").trim() || `익명-${Math.random().toString(36).slice(2, 5)}`;
  localStorage.setItem(STORAGE_NAME_KEY, name);
  return name;
}

export type Identity = {
  sessionId: string;
  name: string;
  color: string;
  rename: (next: string) => void;
};

export function useDisplayIdentity(): Identity {
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) {
    sessionIdRef.current = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  const [name, setName] = useState<string>(() => loadName());

  const rename = useCallback((next: string) => {
    const v = next.trim();
    if (!v) return;
    localStorage.setItem(STORAGE_NAME_KEY, v);
    setName(v);
  }, []);

  return {
    sessionId: sessionIdRef.current,
    name,
    color: pickColor(sessionIdRef.current),
    rename,
  };
}

// ─── Editor channel: config broadcast + presence ─

export type PresenceUser = {
  sessionId: string;
  name: string;
  color: string;
  currentPhotoIdx: number | null;
};

type UseEditorChannelArgs = {
  identity: Identity;
  config: VideoConfig;
  setConfig: (next: VideoConfig) => void;
  loading: boolean;
  currentPhotoIdx: number | null;
  // Shared ref: set to the config object that was applied from a remote broadcast.
  // App.tsx's auto-save effect reads this to skip redundant saves of remote edits.
  remoteAppliedConfigRef: React.MutableRefObject<VideoConfig | null>;
};

const BROADCAST_INTERVAL_MS = 150;

export function useEditorChannel({
  identity,
  config,
  setConfig,
  loading,
  currentPhotoIdx,
  remoteAppliedConfigRef,
}: UseEditorChannelArgs): { others: PresenceUser[] } {
  const { sessionId, name, color } = identity;
  const [others, setOthers] = useState<PresenceUser[]>([]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentTsRef = useRef(0);
  const pendingRef = useRef<VideoConfig | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest presence fields in a ref so the initial track() on subscribe
  // can include them without re-subscribing.
  const presenceRef = useRef({ sessionId, name, color, currentPhotoIdx });
  presenceRef.current = { sessionId, name, color, currentPhotoIdx };

  // Set up the channel once (per session).
  useEffect(() => {
    const channel = supabase.channel(`letter-editor:${CONFIG_ID}`, {
      config: {
        broadcast: { self: false },
        presence: { key: sessionId },
      },
    });

    channel.on("broadcast", { event: "config" }, ({ payload }: { payload: { senderId: string; config: VideoConfig } }) => {
      if (!payload || payload.senderId === sessionId) return;
      remoteAppliedConfigRef.current = payload.config;
      setConfig(payload.config);
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const list: PresenceUser[] = [];
      for (const key in state) {
        const metas = state[key] as unknown as PresenceUser[];
        for (const m of metas) {
          if (m && m.sessionId && m.sessionId !== sessionId) list.push(m);
        }
      }
      // Deduplicate by sessionId (multiple metas can appear during reconnects).
      const seen = new Set<string>();
      setOthers(list.filter((u) => (seen.has(u.sessionId) ? false : (seen.add(u.sessionId), true))));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track(presenceRef.current);
      }
    });

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Broadcast config changes (leading + trailing throttle).
  useEffect(() => {
    if (loading) return;
    const channel = channelRef.current;
    if (!channel) return;
    // Skip broadcasting a config object we just received from a peer.
    if (config === remoteAppliedConfigRef.current) return;

    const now = Date.now();
    const elapsed = now - lastSentTsRef.current;

    const send = (cfg: VideoConfig) => {
      lastSentTsRef.current = Date.now();
      channel.send({ type: "broadcast", event: "config", payload: { senderId: sessionId, config: cfg } });
    };

    if (elapsed >= BROADCAST_INTERVAL_MS) {
      send(config);
      pendingRef.current = null;
    } else {
      pendingRef.current = config;
      if (!pendingTimerRef.current) {
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          if (pendingRef.current) {
            send(pendingRef.current);
            pendingRef.current = null;
          }
        }, BROADCAST_INTERVAL_MS - elapsed);
      }
    }
  }, [config, loading, sessionId, remoteAppliedConfigRef]);

  // Update presence when view/name/color changes.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    // track() is safe to call even before SUBSCRIBED — supabase-js queues it.
    channel.track({ sessionId, name, color, currentPhotoIdx }).catch(() => {});
  }, [sessionId, name, color, currentPhotoIdx]);

  return { others };
}

// ─── Comments (postgres_changes subscription) ────

export function useComments(): {
  comments: Comment[];
  addComment: (input: NewCommentInput) => Promise<Comment | null>;
  toggleResolved: (id: string, resolved: boolean) => Promise<boolean>;
} {
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    let cancelled = false;
    listComments().then((list) => {
      if (!cancelled) setComments(list);
    });

    const channel = supabase.channel("letter-comments-sync");
    // supabase-js's .on() overload resolution for postgres_changes has historically
    // been fragile; call via an untyped wrapper to sidestep the TS inference issue.
    (channel.on as unknown as (
      type: "postgres_changes",
      filter: { event: "*"; schema: string; table: string },
      cb: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Comment; old: { id: string } }) => void
    ) => typeof channel)(
      "postgres_changes",
      { event: "*", schema: "public", table: "letter_comments" },
      (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new;
          setComments((cs) => (cs.some((c) => c.id === row.id) ? cs : [row, ...cs]));
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new;
          setComments((cs) => cs.map((c) => (c.id === row.id ? row : c)));
        } else if (payload.eventType === "DELETE") {
          const id = payload.old.id;
          setComments((cs) => cs.filter((c) => c.id !== id));
        }
      }
    );
    channel.subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, []);

  const add = useCallback(async (input: NewCommentInput) => {
    const row = await addCommentApi(input);
    if (row) {
      // Optimistic local insert — subscription will de-dup via id check.
      setComments((cs) => (cs.some((c) => c.id === row.id) ? cs : [row, ...cs]));
    }
    return row;
  }, []);

  const toggle = useCallback(async (id: string, resolved: boolean) => {
    const ok = await toggleResolvedApi(id, resolved);
    if (ok) {
      setComments((cs) => cs.map((c) => (c.id === id ? { ...c, resolved } : c)));
    }
    return ok;
  }, []);

  return { comments, addComment: add, toggleResolved: toggle };
}
