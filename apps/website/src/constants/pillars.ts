export type Pillar = {
  title: string;
  subtitle: string;
  href: string;
  img: {
    src: string;
    alt: string;
  };
  description: string;
};

export const pillars: Pillar[] = [
  {
    title: "learn",
    subtitle: "blog",
    href: "/blog",
    img: {
      src: "/pillars-learn.jpg",
      alt: "learn",
    },
    description:
      "learn about all things wellness, sustainability and entrepreneurship!",
  },
  {
    title: "train",
    subtitle: "training",
    href: "/training",
    img: {
      src: "/pillars-training.jpeg",
      alt: "training",
    },
    description:
      "explore our personal training packages to improve strength, conditioning and mobility!",
  },
  {
    title: "shop",
    subtitle: "activewear",
    href: "/activewear",
    img: {
      src: "/pillars-shop.jpg",
      alt: "activewear",
    },
    description:
      "join our waitlist for updates on our upcoming skin-safe activewear launch!",
  },
];

export function getPillars(options?: { blogEnabled?: boolean }) {
  const blogEnabled = options?.blogEnabled ?? true;

  if (blogEnabled) {
    return pillars;
  }

  return pillars.filter((pillar) => pillar.href !== "/blog");
}
