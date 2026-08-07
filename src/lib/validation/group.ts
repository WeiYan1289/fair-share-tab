import { z } from "zod";
import { MAX_MEMBER_NAME_LENGTH } from "@/lib/constants";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
  creatorName: z
    .string()
    .trim()
    .min(1, "Your name is required")
    .max(MAX_MEMBER_NAME_LENGTH, `Name must be ${MAX_MEMBER_NAME_LENGTH} characters or less`),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const shareLinkRoleSchema = z.enum(["editor", "viewer"]);

export const regenerateLinkSchema = z.object({
  role: shareLinkRoleSchema,
});

export type RegenerateLinkInput = z.infer<typeof regenerateLinkSchema>;

export const groupStatusSchema = z.enum(["active", "archived"]);

// PATCH /api/account/groups/{groupId} — owner-only rename/archive/restore
// (spec 2026-08-06 features A + C). No length cap for the same reason
// RenameEventModal has none: group names are never rendered into narrow
// chips or settlement rows. Mirrors updateEventSchema's at-least-one-field
// refine.
export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Group name is required").optional(),
    status: groupStatusSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.status !== undefined, {
    message: "At least one field must be provided",
  });

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
