import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { sendContactFormEmail } from "../utils";

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
  console.log("Handling contact form submission...");

  try {
    const { isHuman } = input;
    if (!isHuman) {
      return { error: "Please verify that you are human" };
    }

    await sendContactFormEmail(input);
    console.log("Email sent successfully");

    return { success: true };
  } catch (error) {
    console.error("Error sending contact form email:", error);
    return { error: "Failed to send contact form email" };
  }
};

export const contact = defineAction({
  accept: "form",
  input: contactSchema,
  handler: handleContact,
});
