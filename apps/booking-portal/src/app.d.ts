// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { auth } from "$lib/server/auth";

type AuthSession = typeof auth.$Infer.Session;

declare global {
	namespace App {
		interface Error {
			message: string;
			/** Set by `handleError` for unexpected server errors, to quote in a report. */
			errorId?: string;
		}
		interface Locals {
			user: AuthSession["user"] | null;
			session: AuthSession["session"] | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
