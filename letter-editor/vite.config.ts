import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Dev: serve photos from letter-video/public. Build: empty (photos from Supabase)
  publicDir:
    command === "serve"
      ? path.resolve(__dirname, "../letter-video/public")
      : "public",
  server: {
    port: 3001,
  },
}));
