import { fail } from "@sveltejs/kit";
import { z } from "zod";
import type { Actions } from "./$types";

export type SignupErrorValues = {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  password?: string;
  agreedToTerms?: string;
};

export type LoginErrorValues = {
  email?: string;
  password?: string;
};

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "email is required")
    .email("enter a valid email"),
  password: z.string().min(1, "password is required"),
});

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "first name is required"),
  lastName: z.string().trim().min(1, "last name is required"),
  email: z
    .string()
    .trim()
    .min(1, "email is required")
    .email("enter a valid email"),
  mobile: z.string().trim().min(1, "mobile number is required"),
  password: z.string().min(8, "password must be at least 8 characters"),
  agreedToTerms: z.literal("on", {
    message: "you must agree to the terms to continue",
  }),
});

export const actions: Actions = {
  login: async ({ request }) => {
    const formData = await request.formData();
    const result = loginSchema.safeParse(Object.fromEntries(formData));

    if (!result.success) {
      return fail(400, {
        mode: "login" as const,
        errors: z.flattenError(result.error).fieldErrors,
        values: {
          email: formData.get("email")?.toString() ?? "",
        } satisfies LoginErrorValues,
      });
    }

    // placeholder: no auth wired up yet
    console.log("login action placeholder", result.data);

    return { mode: "login" as const, success: true };
  },

  signup: async ({ request }) => {
    const formData = await request.formData();
    const result = signupSchema.safeParse(Object.fromEntries(formData));

    if (!result.success) {
      return fail(400, {
        mode: "signup" as const,
        errors: z.flattenError(result.error).fieldErrors,
        values: {
          firstName: formData.get("firstName")?.toString() ?? "",
          lastName: formData.get("lastName")?.toString() ?? "",
          email: formData.get("email")?.toString() ?? "",
          mobile: formData.get("mobile")?.toString() ?? "",
        } satisfies SignupErrorValues,
      });
    }

    // placeholder: no auth wired up yet
    console.log("signup action placeholder", result.data);

    return { mode: "signup" as const, success: true };
  },
};
