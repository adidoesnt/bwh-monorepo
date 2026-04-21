import { defineAction } from "astro:actions";
import { z } from "astro/zod";

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  subject: z.string().min(1),
  message: z.string().min(1),
  isHuman: z.boolean(),
});

type ContactInput = z.infer<typeof contactSchema>;

const handleContact = async (input: ContactInput) => {
  const { firstName, lastName, email, subject, message, isHuman } = input;

  if (!isHuman) {
    return { error: "Please verify that you are human" };
  }

  console.log(firstName, lastName, email, subject, message);
  
  return { success: true };
};

export const contact = defineAction({
  accept: "form",
  input: contactSchema,
  handler: handleContact,
});
