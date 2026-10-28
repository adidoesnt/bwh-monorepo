const TOAST_DURATION_MS = 3000;

let current = $state<{ id: number; message: string } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

/** The one toast on screen, rendered by the `(app)` layout. Only ever set from
 * the browser (action callbacks), so server renders always see `null`. */
export const toast = {
	get current() {
		return current;
	}
};

export const showToast = (message: string) => {
	clearTimeout(timer);
	current = { id: Date.now(), message };
	timer = setTimeout(() => (current = null), TOAST_DURATION_MS);
};
