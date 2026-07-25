import { z } from "zod";
import { CURRENCY_CODES, DEFAULT_CURRENCY } from "@/lib/currency";

export function datesInOrder(data: {
  startDate?: string | null;
  endDate?: string | null;
}): boolean {
  if (!data.startDate || !data.endDate) return true;
  return data.startDate <= data.endDate;
}

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required"),
    currency: z.enum(CURRENCY_CODES).default(DEFAULT_CURRENCY),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    // Optional per system-design.md §5; the current UI (Screen Spec P3-04)
    // never sends this and expects every active group member included by
    // default -- see route.ts for that fallback.
    memberIds: z.array(z.string().uuid()).optional(),
  })
  .refine(datesInOrder, {
    message: "Start date must be on or before the end date",
    path: ["endDate"],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const eventStatusSchema = z.enum(["active", "archived"]);

export const updateEventSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required").optional(),
    // null clears a previously-set date; undefined leaves it untouched.
    startDate: z.iso.date().nullable().optional(),
    endDate: z.iso.date().nullable().optional(),
    status: eventStatusSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.status !== undefined,
    { message: "At least one field must be provided" },
  )
  .refine(datesInOrder, {
    message: "Start date must be on or before the end date",
    path: ["endDate"],
  });

export type UpdateEventInput = z.infer<typeof updateEventSchema>;
