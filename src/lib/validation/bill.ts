import { z } from "zod";

const baseBillFields = z.object({
  title: z.string().trim().min(1, "Title is required"),
  // Sen, integer, > 0 (data-model.md §5, §6 invariant 1).
  totalAmount: z.number().int().positive("totalAmount must be a positive integer"),
  payerId: z.string().uuid(),
  category: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional(),
});

const equalSplitFields = z.object({
  splitMethod: z.literal("equal"),
  // At least one participant per bill (system-design.md §7).
  participantIds: z.array(z.string().uuid()).min(1, "At least one participant is required"),
});

const customSplitFields = z.object({
  splitMethod: z.literal("custom"),
  customShares: z
    .array(
      z.object({
        memberId: z.string().uuid(),
        shareAmount: z.number().int().nonnegative(),
      }),
    )
    .min(1, "At least one participant is required"),
});

// Shared shape for both create and edit (system-design.md §5 "Bills" gives
// one body example for both). Edits are a full replace, not a partial patch
// -- the whole split configuration is resent and revalidated every time.
export const billSchema = z.discriminatedUnion("splitMethod", [
  baseBillFields.merge(equalSplitFields),
  baseBillFields.merge(customSplitFields),
]);

export type BillInput = z.infer<typeof billSchema>;
