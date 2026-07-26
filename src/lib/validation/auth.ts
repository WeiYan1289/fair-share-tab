import { z } from "zod";

// Normalized to lowercase here (not just at the DB layer) so validation,
// uniqueness checks, and lookups all agree on the same casing
// (data-model.md §6 invariant 11).
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address");

// Matches password.ts's MAX_PASSWORD_LENGTH — kept independent rather than
// imported since this is a client-shared Zod schema and password.ts pulls
// in the (server-only, native-binding) argon2 package.
const MAX_PASSWORD_LENGTH = 256;

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(MAX_PASSWORD_LENGTH),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(MAX_PASSWORD_LENGTH),
});

export type LoginInput = z.infer<typeof loginSchema>;
