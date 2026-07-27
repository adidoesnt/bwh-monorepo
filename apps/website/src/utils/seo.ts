import {
  BUSINESS_ADDRESS,
  BUSINESS_EMAIL,
  BUSINESS_PHONE,
  FOUNDER_NAME,
  SITE_NAME,
  SITE_URL,
  SOCIAL_LINKS,
} from "../constants/site";

const toAbsoluteUrl = (path: string) =>
  path.startsWith("http") ? path : `${SITE_URL}${path}`;

export function getBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE_NAME,
    url: SITE_URL,
    logo: toAbsoluteUrl("/bwh-logo.jpeg"),
    image: toAbsoluteUrl("/bwh-logo.jpeg"),
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_PHONE,
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS_ADDRESS,
      addressCountry: "SG",
    },
    areaServed: "Singapore",
    description:
      "Personal training and skin-safe activewear from builtwithhabit.",
    sameAs: SOCIAL_LINKS,
  };
}

export function getPersonJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: FOUNDER_NAME,
    jobTitle: "Personal Trainer",
    worksFor: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    image: toAbsoluteUrl("/headshot.png"),
    url: `${SITE_URL}/about`,
    sameAs: SOCIAL_LINKS,
  };
}

type BlogPostingInput = {
  title: string;
  description: string;
  pubDate: Date;
  slug: string;
  tags: string[];
  thumbnail: { src: string; alt: string };
};

export function getBlogPostingJsonLd(post: BlogPostingInput) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: toAbsoluteUrl(post.thumbnail.src),
    datePublished: post.pubDate.toISOString(),
    author: {
      "@type": "Person",
      name: FOUNDER_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    keywords: post.tags.join(", "),
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };
}
