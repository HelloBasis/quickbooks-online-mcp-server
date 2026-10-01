import { searchQuickbooksClasses } from "../handlers/search-quickbooks-classes.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "search_classes";
const toolDescription = "Search for classes in QuickBooks Online with optional filters.";
const toolSchema = z.object({
  name: z.string().optional().describe("Filter by class Name (exact match, no wildcards)"),
  active: z.boolean().optional().describe("Filter by active status"),
  limit: z.number().optional().describe("Maximum rows to return (default and max 1000)"),
});

const toolHandler = async ({ params }: any) => {
  const response = await searchQuickbooksClasses(params);
  if (response.isError) return { content: [{ type: "text" as const, text: `Error: ${response.error}` }] };
  return { content: [{ type: "text" as const, text: `Found ${response.result.length} classes:` }, { type: "text" as const, text: JSON.stringify(response.result, null, 2) }] };
};

export const SearchClassesTool: ToolDefinition<typeof toolSchema> = { name: toolName, description: toolDescription, schema: toolSchema, handler: toolHandler };
