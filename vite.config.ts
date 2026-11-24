import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const siteUrl = loadEnv(mode, process.cwd(), "SHIFTCHESS_").SHIFTCHESS_SITE_URL?.trim();
  const socialImage = siteUrl
    ? new URL("social-preview.jpg", siteUrl.replace(/\/?$/, "/")).href
    : "./social-preview.jpg";
  return {
    base: "./",
    plugins: [
      {
        name: "shiftchess-social-preview",
        transformIndexHtml: {
          order: "pre",
          handler: () => [
            { tag: "meta", attrs: { property: "og:image", content: socialImage }, injectTo: "head" },
            { tag: "meta", attrs: { property: "og:image:width", content: "1200" }, injectTo: "head" },
            { tag: "meta", attrs: { property: "og:image:height", content: "630" }, injectTo: "head" },
            { tag: "meta", attrs: { property: "og:image:alt", content: "ShiftChess title screen with a 3D chessboard" }, injectTo: "head" },
            ...(siteUrl ? [{ tag: "meta", attrs: { property: "og:url", content: siteUrl }, injectTo: "head" as const }] : []),
          ],
        },
      },
      {
        name: "shiftchess-offline",
        apply: "build",
        enforce: "post",
        generateBundle(_, bundle) {
          const worker = readFileSync(new URL("./build/offline-worker.js", import.meta.url), "utf8");
          const staticFiles = ["favicon.png", "icon-192.png", "icon-512.png", "manifest.webmanifest"];
          const hash = createHash("sha256").update(worker);
          for (const name of staticFiles) hash.update(readFileSync(new URL("./public/" + name, import.meta.url)));
          const output = Object.values(bundle);
          for (const file of output) hash.update(file.type === "chunk" ? file.code : file.source);
          const files = [...output.map((file) => file.fileName), ...staticFiles];
          const id = hash.digest("hex").slice(0, 16);
          this.emitFile({
            type: "asset",
            fileName: "sw.js",
            source: `const FILES = ${JSON.stringify(files)};\nconst BUILD_ID = "${id}";\n${worker}`,
          });
        },
      },
    ],
  };
});
