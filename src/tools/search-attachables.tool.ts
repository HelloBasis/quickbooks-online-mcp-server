import { searchQuickbooksAttachables } from "../handlers/search-quickbooks-attachables.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "search_attachables";
const toolDescription = "Search for attachables in QuickBooks Online with optional filters.";
const toolSchema = z.object({
  file_name: z.string().optional().describe("Filter by FileName (exact match, including extension, e.g. \"invoice.pdf\"; no wildcards)"),
  content_type: z.string().optional().describe("Filter by MIME ContentType (exact match, e.g. \"application/pdf\")"),
  limit: z.number().optional().describe("Maximum rows to return (default and max 1000)"),
});

const toolHandler = async ({ params }: any) => {
  const response = await searchQuickbooksAttachables(params);
  if (response.isError) return { content: [{ type: "text" as const, text: `Error: ${response.error}` }] };
  return { content: [{ type: "text" as const, text: `Found ${response.result.length} attachables:` }, { type: "text" as const, text: JSON.stringify(response.result, null, 2) }] };
};

export const SearchAttachablesTool: ToolDefinition<typeof toolSchema> = { name: toolName, description: toolDescription, schema: toolSchema, handler: toolHandler };
