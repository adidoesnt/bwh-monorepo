export type NavLink = {
  href: string;
  label: string;
};

export const allNavLinks: NavLink[] = [
  { href: "/", label: "home" },
  { href: "/about", label: "about" },
  { href: "/blog", label: "blog" },
  { href: "/training", label: "training" },
  { href: "/activewear", label: "activewear" },
  { href: "/contact", label: "contact us" },
];

export function getNavLinks(options?: { blogEnabled?: boolean }) {
  const blogEnabled = options?.blogEnabled ?? true;

  if (blogEnabled) {
    return allNavLinks;
  }

  return allNavLinks.filter((link) => link.href !== "/blog");
}

const footerLabels: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/blog": "Blog",
  "/training": "Training",
  "/activewear": "Activewear",
  "/contact": "Contact Us",
};

export function getFooterLinks(options?: { blogEnabled?: boolean }) {
  return getNavLinks(options).map((link) => ({
    href: link.href,
    label: footerLabels[link.href] ?? link.label,
  }));
}
