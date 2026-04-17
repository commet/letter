import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Serve photos from the existing letter-video/public directory.
  publicDir: path.resolve(__dirname, "../letter-video/public"),
  server: {
    port: 3001,
  },
});
