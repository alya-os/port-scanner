import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    strictPort: true,
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  plugins: [react()],
});
