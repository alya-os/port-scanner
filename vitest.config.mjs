import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Les tests d'interface vivent à part des tests de logique pure : ceux-ci
// tournent sous `node --test` et ne doivent jamais croiser un environnement DOM.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.jsx"],
    restoreMocks: true,
  },
});
