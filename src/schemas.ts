import { z } from "zod";

export const CustomerIdSchema = z
  .string({
    required_error: "customer_id is required",
    invalid_type_error: "customer_id must be a string",
  })
  .regex(/^CUST-\d{5}$/, {
    message: "customer_id must match format CUST-XXXXX with exactly 5 digits",
  });

export const AmountSchema = z
  .number({
    required_error: "amount is required",
    invalid_type_error: "amount must be a number",
  })
  .refine((val) => Number.isFinite(val), {
    message: "amount must be a finite number",
  })
  .refine((val) => val > 0, {
    message: "amount must be strictly greater than 0",
  })
  .refine((val) => val <= 10000, {
    message: "amount cannot exceed 10000",
  })
  .refine(
    (val) => {
      const cents = Math.round(val * 100);
      return Math.abs(val * 100 - cents) < 1e-6;
    },
    {
      message: "amount must have at most 2 decimal places",
    }
  );

export const ReasonSchema = z
  .string({
    required_error: "reason is required",
    invalid_type_error: "reason must be a string",
  })
  .refine((val) => val.trim().length >= 10, {
    message: "reason must be at least 10 characters long after trimming whitespace",
  })
  .refine((val) => val.length <= 500, {
    message: "reason cannot exceed 500 characters",
  });

export const GetCustomerRecordInputSchema = z
  .object({
    customer_id: CustomerIdSchema,
  })
  .strict();

export type GetCustomerRecordInput = z.infer<typeof GetCustomerRecordInputSchema>;

export const TriggerRefundInputSchema = z
  .object({
    customer_id: CustomerIdSchema,
    amount: AmountSchema,
    reason: ReasonSchema,
  })
  .strict();

export type TriggerRefundInput = z.infer<typeof TriggerRefundInputSchema>;
