import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: { resolve: true },
  entry: {
    index: "src/index.ts",
    react: "src/react.ts",
    server: "src/server.ts",
    runtime: "src/runtime.ts",
    "adapters-memory": "src/adapters-memory.ts",
  },
  external: ["react", "react-dom"],
  noExternal: [/^@pagebldr\//u],
  format: ["esm"],
  sourcemap: true,
  splitting: false,
  target: "es2022",
  treeshake: true,
});
