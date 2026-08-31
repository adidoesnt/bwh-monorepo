export type Role = "client" | "trainer" | "admin";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  /**
   * Whether this destination is built yet. Only `/dashboard` is live today;
   * the rest render as disabled placeholders until their roadmap phase lands.
   */
  enabled: boolean;
  badge?: string | null;
};

/** Badge values resolved server-side and merged into the nav for the current user. */
export type NavBadges = {
  bookings?: string | null;
  packages?: string | null;
  intake?: string | null;
  trainerRequests?: string | null;
  trainerClients?: string | null;
};

type NavDef = Omit<NavItem, "badge"> & { badgeKey?: keyof NavBadges };

const NAV: Record<Role, NavDef[]> = {
  client: [
    { id: "dashboard", label: "dashboard", href: "/dashboard", enabled: true },
    { id: "bookings", label: "bookings", href: "/bookings", enabled: true, badgeKey: "bookings" },
    { id: "packages", label: "packages & credits", href: "/packages", enabled: false, badgeKey: "packages" },
    { id: "payments", label: "payments", href: "/payments", enabled: false },
    { id: "progress", label: "progress", href: "/progress", enabled: false },
    { id: "intake", label: "health screening", href: "/intake", enabled: false, badgeKey: "intake" },
    { id: "help", label: "help", href: "/help", enabled: false },
  ],
  trainer: [
    { id: "tdash", label: "today & requests", href: "/trainer", enabled: false, badgeKey: "trainerRequests" },
    { id: "tclients", label: "my clients", href: "/trainer/clients", enabled: false, badgeKey: "trainerClients" },
    { id: "tprogress", label: "client progress", href: "/trainer/progress", enabled: false },
    { id: "tpayouts", label: "my payouts", href: "/trainer/payouts", enabled: false },
    { id: "help", label: "help", href: "/help", enabled: false },
  ],
  admin: [
    { id: "overview", label: "overview", href: "/admin", enabled: false },
    { id: "users", label: "people & roles", href: "/admin/users", enabled: false },
    { id: "coachview", label: "coach view", href: "/admin/coach-view", enabled: false },
    { id: "revenue", label: "revenue", href: "/admin/revenue", enabled: false },
    { id: "help", label: "help", href: "/help", enabled: false },
  ],
};

export const roleLabel = (role: Role) =>
  role === "client" ? "client portal" : role === "trainer" ? "coach portal" : "admin";

export function buildNav(role: Role, badges: NavBadges = {}): NavItem[] {
  return NAV[role].map(({ badgeKey, ...item }) => ({
    ...item,
    badge: badgeKey ? (badges[badgeKey] ?? null) : null,
  }));
}
