import { getSecret } from "astro:env/server";

export const SES_SMTP_HOST =
  getSecret("SES_SMTP_HOST") ?? "email-smtp.us-east-1.amazonaws.com";
export const SES_SMTP_PORT = getSecret("SES_SMTP_PORT") ?? "587";
export const SES_SMTP_USER = getSecret("SES_SMTP_USER");
export const SES_SMTP_PASS = getSecret("SES_SMTP_PASS");
export const SENDER_EMAIL = getSecret("SENDER_EMAIL");
export const RECEIVER_EMAIL = getSecret("RECEIVER_EMAIL");
