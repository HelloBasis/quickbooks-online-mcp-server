import { searchQuickbooksEmployees } from "../handlers/search-quickbooks-employees.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { filterSchema, paginationFields } from "../helpers/search-schema.js";
import { z } from "zod";

// Define the tool metadata
const toolName = "search_employees";
const toolDescription = "Search employees in QuickBooks Online that match given criteria.";

// Define the expected input schema for searching employees
const toolSchema = z.object({
  criteria: z
    .array(
      filterSchema(
        z.string().describe("Employee property to filter on, e.g. DisplayName, GivenName, FamilyName, Active, MetaData.LastUpdatedTime")
      )
    )
    .optional()
    .describe("Filters ANDed together. Each is {field, value, operator?}; operator defaults to '='. Omit to return the first 1000 employees."),
  ...paginationFields(),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  const response = await searchQuickbooksEmployees(args.params);

  if (response.isError) {
    return {
      content: [
        { type: "text" as const, text: `Error searching employees: ${response.error}` },
      ],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Employees found:` },
      { type: "text" as const, text: JSON.stringify(response.result) },
    ],
  };
};

export const SearchEmployeesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 