// Render client-side so all date/time formatting resolves in the viewer's
// timezone. `booking.starts_at` et al. are now `timestamptz`, so the Date
// objects are correct instants — the browser just displays them locally.
export const ssr = false;
