import { z } from "zod";

/** Reusable password field: min 6 characters. Use in sign-up, reset password, etc. */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters");

/** Schema for reset-password form: password + confirm, must match. */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
