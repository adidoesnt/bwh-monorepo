import { getSecret } from "astro:env/server";

const isEnabled = (value: string | undefined) => value === "true";

export const SHOP_ENABLED = isEnabled(getSecret("SHOP_ENABLED"));
export const PT_ENABLED = isEnabled(getSecret("PT_ENABLED"));
export const BLOG_ENABLED = isEnabled(getSecret("BLOG_ENABLED"));
export const SEARCH_ENABLED = isEnabled(getSecret("SEARCH_ENABLED"));
