import { searchQuickbooksTransfers } from "../handlers/search-quickbooks-transfers.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "search_transfers";
const toolDescription = "Search for transfers in QuickBooks Online.";
const toolSchema = z.object({
  txn_date_from: z.string().optional().describe("Earliest TxnDate, inclusive (YYYY-MM-DD)"),
  txn_date_to: z.string().optional().describe("Latest TxnDate, inclusive (YYYY-MM-DD)"),
  limit: z.number().optional().describe("Maximum rows to return (default and max 1000)"),
});

const toolHandler = async ({ params }: any) => {
  const response = await searchQuickbooksTransfers(params);
  if (response.isError) return { content: [{ type: "text" as const, text: `Error: ${response.error}` }] };
  return { content: [{ type: "text" as const, text: `Found ${response.result.length} transfer(s):` }, { type: "text" as const, text: JSON.stringify(response.result, null, 2) }] };
};

export const SearchTransfersTool: ToolDefinition<typeof toolSchema> = { name: toolName, description: toolDescription, schema: toolSchema, handler: toolHandler };
