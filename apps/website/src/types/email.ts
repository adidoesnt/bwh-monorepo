import { z } from "astro/zod";

const requiredString = (message: string) =>
  z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().min(1, { message }),
  );

const requiredCheckbox = (message: string) =>
  z
    .preprocess((value) => value === true || value === "true", z.boolean())
    .refine((value) => value, { message });

export const contactSchema = z.object({
  firstName: requiredString("Please enter your first name."),
  lastName: requiredString("Please enter your last name."),
  email: z.preprocess(
    (value) => (value == null ? "" : value),
    z.email({ message: "Please enter a valid email address." }),
  ),
  subject: requiredString("Please enter a subject."),
  message: requiredString("Please enter your message."),
  isHuman: requiredCheckbox(
    "Please check the box to verify that you are human.",
  ),
});

export type ContactInput = z.infer<typeof contactSchema>;
