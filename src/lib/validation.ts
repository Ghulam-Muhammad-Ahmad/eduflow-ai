import { z } from "zod";

/** Reusable password field: min 6 characters. Use in sign-up, reset password, etc. */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters");

/** Strong password for registration: min 8 chars, uppercase, lowercase, and number. */
export const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one number");

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
