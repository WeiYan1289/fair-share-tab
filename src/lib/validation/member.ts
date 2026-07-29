import { z } from "zod";
import { MAX_MEMBER_NAME_LENGTH } from "@/lib/constants";

// Treats "" and null the same as an omitted email — clients that always
// send the field shouldn't have to special-case an empty value.
const optionalEmail = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().toLowerCase().email("Invalid email").optional(),
);

const memberNameLength = z
  .string()
  .trim()
  .min(1, "Member name is required")
  .max(MAX_MEMBER_NAME_LENGTH, `Name must be ${MAX_MEMBER_NAME_LENGTH} characters or less`);

export const createMemberSchema = z.object({
  name: memberNameLength,
  email: optionalEmail,
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z
  .object({
    name: memberNameLength.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.isActive !== undefined, {
    message: "At least one of name or isActive must be provided",
  });

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
