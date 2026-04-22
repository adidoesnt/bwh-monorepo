import { getSecret } from "astro:env/server";

export const SHOP_URL =
  getSecret("SHOP_URL") ?? "https://shop.builtwithhabit.com";
export const PT_URL = getSecret("PT_URL") ?? "https://pt.builtwithhabit.com";
