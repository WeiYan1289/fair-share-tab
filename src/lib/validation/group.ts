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
