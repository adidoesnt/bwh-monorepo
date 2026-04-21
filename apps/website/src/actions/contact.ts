import { defineAction } from "astro:actions";
import { sendContactFormEmail } from "../utils";
import { type ContactInput, contactSchema } from "../types";

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
