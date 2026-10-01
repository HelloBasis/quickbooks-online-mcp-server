import { searchQuickbooksTimeActivities } from "../handlers/search-quickbooks-time-activities.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "search_time_activities";
const toolDescription = "Search for time activities in QuickBooks Online.";
const toolSchema = z.object({
  employee_ref: z.string().optional().describe("Filter by employee Id (numeric string); exact match on EmployeeRef"),
  vendor_ref: z.string().optional().describe("Filter by vendor Id (numeric string); exact match on VendorRef"),
  customer_ref: z.string().optional().describe("Filter by customer Id (numeric string); exact match on CustomerRef"),
  txn_date_from: z.string().optional().describe("Earliest TxnDate, inclusive (YYYY-MM-DD)"),
  txn_date_to: z.string().optional().describe("Latest TxnDate, inclusive (YYYY-MM-DD)"),
  limit: z.number().optional().describe("Maximum rows to return (default and max 1000)"),
});

const toolHandler = async ({ params }: any) => {
  const response = await searchQuickbooksTimeActivities(params);
  if (response.isError) return { content: [{ type: "text" as const, text: `Error: ${response.error}` }] };
  return { content: [{ type: "text" as const, text: `Found ${response.result.length} time activity(ies):` }, { type: "text" as const, text: JSON.stringify(response.result, null, 2) }] };
};

export const SearchTimeActivitiesTool: ToolDefinition<typeof toolSchema> = { name: toolName, description: toolDescription, schema: toolSchema, handler: toolHandler };
