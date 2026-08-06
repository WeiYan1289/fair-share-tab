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

export const forgotSchema = z.object({
  email: emailSchema,
});

export type ForgotInput = z.infer<typeof forgotSchema>;

// Matches reset-token.ts's RESET_TOKEN_LENGTH — kept independent rather
// than imported for the same reason MAX_PASSWORD_LENGTH is: this is a
// client-shared Zod schema, and reset-token.ts pulls in node:crypto.
// Validating the exact shape here means malformed guessing traffic is
// rejected before it ever reaches the token index.
const RESET_TOKEN_LENGTH = 32;

export const resetSchema = z.object({
  token: z
    .string()
    .length(RESET_TOKEN_LENGTH)
    .regex(/^[0-9A-Za-z]+$/),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(MAX_PASSWORD_LENGTH),
});

export type ResetInput = z.infer<typeof resetSchema>;
