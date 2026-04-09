import { config as baseConfig } from "@repo/eslint-config/base";
import eslintPluginSvelte from "eslint-plugin-svelte";
import globals from "globals";
import svelteParser from "svelte-eslint-parser";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
	...baseConfig,
	...eslintPluginSvelte.configs["flat/recommended"],
	{
		files: ["**/*.svelte"],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tseslint.parser,
				extraFileExtensions: [".svelte"],
			},
			globals: {
				...globals.browser,
			},
		},
	},
];
