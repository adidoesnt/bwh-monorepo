const TOAST_DURATION_MS = 3000;

type ToastVariant = 'success' | 'error';

let current = $state<{ id: number; message: string; variant: ToastVariant } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

/** The one toast on screen, rendered by the `(app)` layout. Only ever set from
 * the browser (action callbacks), so server renders always see `null`. */
export const toast = {
	get current() {
		return current;
	}
};

export const showToast = (message: string, variant: ToastVariant = 'success') => {
	clearTimeout(timer);
	current = { id: Date.now(), message, variant };
	timer = setTimeout(() => (current = null), TOAST_DURATION_MS);
};
