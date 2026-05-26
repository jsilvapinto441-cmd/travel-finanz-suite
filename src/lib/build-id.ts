// Build ID baked at compile time. See vite.config.ts `define` block.
declare const __BUILD_ID__: string;

export const BUILD_ID: string =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
