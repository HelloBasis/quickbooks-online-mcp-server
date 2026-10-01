import { searchQuickbooksPurchases } from "../handlers/search-quickbooks-purchases.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { filterSchema, paginationFields } from "../helpers/search-schema.js";
import { z } from "zod";

// Define the tool metadata
const toolName = "search_purchases";
const toolDescription = "Search purchases in QuickBooks Online that match given criteria.";

// Define the expected input schema for searching purchases
const toolSchema = z.object({
  criteria: z
    .array(
      filterSchema(
        z.string().describe("Purchase property to filter on, e.g. TxnDate, AccountRef, PaymentType, TotalAmt, EntityRef")
      )
    )
    .optional()
    .describe("Filters ANDed together. Each is {field, value, operator?}; operator defaults to '='. Omit to return the first 1000 purchases."),
  ...paginationFields(),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  const response = await searchQuickbooksPurchases(args.params);

  if (response.isError) {
    return {
      content: [
        { type: "text" as const, text: `Error searching purchases: ${response.error}` },
      ],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Purchases found:` },
      { type: "text" as const, text: JSON.stringify(response.result) },
    ],
  };
};

export const SearchPurchasesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 