import { searchQuickbooksCreditMemos } from "../handlers/search-quickbooks-credit-memos.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "search_credit_memos";
const toolDescription = "Search for credit memos in QuickBooks Online.";

const toolSchema = z.object({
  customer_ref: z.string().optional().describe("Filter by customer Id (numeric string, e.g. \"123\"); exact match on CustomerRef"),
  txn_date_from: z.string().optional().describe("Earliest TxnDate, inclusive (YYYY-MM-DD)"),
  txn_date_to: z.string().optional().describe("Latest TxnDate, inclusive (YYYY-MM-DD)"),
  limit: z.number().optional().describe("Maximum rows to return (default and max 1000)"),
});

const toolHandler = async ({ params }: any) => {
  const response = await searchQuickbooksCreditMemos(params);
  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error searching credit memos: ${response.error}` }] };
  }
  return {
    content: [
      { type: "text" as const, text: `Found ${response.result.length} credit memo(s):` },
      { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
    ],
  };
};

export const SearchCreditMemosTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
