import { z } from "zod";

export const settlementBillsSchema = z.object({
  billIds: z.array(z.string().uuid()).min(1, "At least one bill is required"),
});

export type SettlementBillsInput = z.infer<typeof settlementBillsSchema>;
