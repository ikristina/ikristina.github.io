import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://ikristina.github.io",
  server: {
    port: 4321,
    strict: true,
  },
  markdown: {
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['mermaid']
    }
  }
});
