import { defineConfig } from "astro/config";

import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: "https://ikristina.github.io",
  server: {
    port: 4321,
    strict: true,
  },
  markdown: {
    syntaxHighlight: {
      type: 'shiki',
      theme: 'material-theme-palenight',
      excludeLangs: ['mermaid']
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex]
  }
});
