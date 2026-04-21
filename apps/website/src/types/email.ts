import { z } from "astro/zod";

export const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  subject: z.string().min(1),
  message: z.string().min(1),
  isHuman: z.boolean(),
});

export type ContactInput = z.infer<typeof contactSchema>;
