import { defineConfig } from "tsup";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export default defineConfig({
  clean: true,
  dts: { resolve: true },
  entry: {
    index: "src/index.ts",
    react: "src/react.ts",
    "react-server": "src/react-server.ts",
    server: "src/server.ts",
    "server-next": "src/server-next.ts",
    runtime: "src/runtime.ts",
    "runtime-next": "src/runtime-next.ts",
    "adapters-memory": "src/adapters-memory.ts",
    "adapters-prisma": "src/adapters-prisma.ts",
  },
  external: ["react", "react-dom"],
  noExternal: [/^@pagebldr\//u],
  onSuccess: async () => {
    await mkdir("dist", { recursive: true });
    const [baseStyles, editorStyles] = await Promise.all([
      readFile("src/styles.css", "utf8"),
      readFile("../react/dist/editor.css", "utf8"),
    ]);
    await writeFile("dist/styles.css", `${baseStyles}\n${editorStyles}`);
  },
  format: ["esm"],
  sourcemap: true,
  splitting: false,
  target: "es2022",
  treeshake: true,
});
