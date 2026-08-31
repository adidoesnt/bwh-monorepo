import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";
import { APIError } from "better-auth/api";
import { auth } from "$lib/server/auth";
import type { Actions } from "./$types";

export type SignupErrorValues = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  agreedToTerms?: string;
};

export type LoginErrorValues = {
  email?: string;
  password?: string;
};

type FieldErrors<T> = Partial<Record<keyof T, string[]>>;

const loginSchema = z.object({
  email: z
    .email()
    .trim()
    .min(1, "email is required"),
  password: z.string().min(1, "password is required"),
});

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "first name is required"),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "last name is required"),
  email: z.email().trim().min(1, "email is required"),
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

    const { email, password } = result.data;

    try {
      await auth.api.signInEmail({
        body: {
          email,
          password,
          rememberMe: formData.get("keepLoggedIn") === "on",
        },
      });
    } catch (error) {
      if (error instanceof APIError) {
        const errors: FieldErrors<LoginErrorValues> = {
          password: [error.body?.message ?? error.message],
        };

        return fail(400, {
          mode: "login" as const,
          errors,
          values: { email } satisfies LoginErrorValues,
        });
      }
      throw error;
    }

    redirect(303, "/dashboard");
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
          middleName: formData.get("middleName")?.toString() ?? "",
          lastName: formData.get("lastName")?.toString() ?? "",
          email: formData.get("email")?.toString() ?? "",
        } satisfies SignupErrorValues,
      });
    }

    const { firstName, middleName, lastName, email, password } = result.data;
    const name = [firstName, middleName, lastName].filter(Boolean).join(" ");

    try {
      await auth.api.signUpEmail({ body: { name, email, password } });
    } catch (error) {
      if (error instanceof APIError) {
        const errors: FieldErrors<SignupErrorValues> = {
          email: [error.body?.message ?? error.message],
        };

        return fail(400, {
          mode: "signup" as const,
          errors,
          values: {
            firstName,
            middleName,
            lastName,
            email,
          } satisfies SignupErrorValues,
        });
      }
      throw error;
    }

    redirect(303, "/dashboard");
  },
};
