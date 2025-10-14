import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
	plugins: [react()],
	base: "./",
	build: {
		outDir: "dist",
		target: "es2022",
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
			},
		},
	},
	server: {
		port: 0,
		host: true,
	},
	esbuild: {
		target: "es2022",
	},
});
