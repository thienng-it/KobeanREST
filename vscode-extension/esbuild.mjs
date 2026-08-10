import * as esbuild from "esbuild";

const isProduction = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "es2022",
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
  logLevel: "info",
  metafile: true,
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(extensionConfig);
    await ctx.watch();
    console.log("[esbuild] Watching for changes...");
  } else {
    const result = await esbuild.build(extensionConfig);
    if (result.metafile) {
      const analysis = await esbuild.analyzeMetafile(result.metafile);
      console.log(analysis);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
