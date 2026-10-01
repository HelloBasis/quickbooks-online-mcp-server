import { searchQuickbooksBudgets } from "../handlers/search-quickbooks-budgets.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "search_budgets";
const toolDescription = "Search for budgets in QuickBooks Online. Returns Budget records with nested BudgetDetail line items (Amount, BudgetDate, AccountRef, ClassRef, CustomerRef, DepartmentRef, LocationRef). Budget is read-only in the QBO v3 API.";
const toolSchema = z.object({
  name: z.string().optional().describe("Filter by budget Name (exact match, no wildcards)"),
  active: z.boolean().optional().describe("Filter by active status"),
  limit: z.number().optional().describe("Maximum rows to return (default and max 1000)"),
});

const toolHandler = async ({ params }: any) => {
  const response = await searchQuickbooksBudgets(params);
  if (response.isError) return { content: [{ type: "text" as const, text: `Error: ${response.error}` }] };
  return { content: [{ type: "text" as const, text: `Found ${response.result.length} budgets:` }, { type: "text" as const, text: JSON.stringify(response.result, null, 2) }] };
};

export const SearchBudgetsTool: ToolDefinition<typeof toolSchema> = { name: toolName, description: toolDescription, schema: toolSchema, handler: toolHandler };
