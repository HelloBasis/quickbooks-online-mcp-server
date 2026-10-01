import { searchQuickbooksBillPayments } from "../handlers/search-quickbooks-bill-payments.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { filterSchema, paginationFields } from "../helpers/search-schema.js";
import { z } from "zod";

// Define the tool metadata
const toolName = "search_bill_payments";
const toolDescription = "Search bill payments in QuickBooks Online that match given criteria.";

// Define the expected input schema for searching bill payments
const toolSchema = z.object({
  criteria: z
    .array(
      filterSchema(
        z.string().describe("BillPayment property to filter on, e.g. TxnDate, VendorRef, TotalAmt, DocNumber, MetaData.LastUpdatedTime")
      )
    )
    .optional()
    .describe("Filters ANDed together. Each is {field, value, operator?}; operator defaults to '='. Omit to return the first 1000 bill payments."),
  ...paginationFields(),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  const response = await searchQuickbooksBillPayments(args.params);

  if (response.isError) {
    return {
      content: [
        { type: "text" as const, text: `Error searching bill payments: ${response.error}` },
      ],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Bill payments found:` },
      { type: "text" as const, text: JSON.stringify(response.result) },
    ],
  };
};

export const SearchBillPaymentsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 