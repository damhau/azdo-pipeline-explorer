import { build } from "esbuild";

await build({
	entryPoints: ["src/extension.ts"],   // your main TS file
	outfile: "dist/extension.js",
	bundle: true,
	minify: true,
	platform: "node",
	target: "node20",
	format: "cjs",
	external: ["vscode", "fsevents"],    // never bundle VS Code API
	logLevel: "info"
});