import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
  creatorName: z.string().trim().min(1, "Your name is required"),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const shareLinkRoleSchema = z.enum(["editor", "viewer"]);

export const regenerateLinkSchema = z.object({
  role: shareLinkRoleSchema,
});

export type RegenerateLinkInput = z.infer<typeof regenerateLinkSchema>;
