import { searchQuickbooksJournalEntries } from "../handlers/search-quickbooks-journal-entries.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { filterSchema, paginationFields } from "../helpers/search-schema.js";
import { z } from "zod";

// Define the tool metadata
const toolName = "search_journal_entries";
const toolDescription = "Search journal entries in QuickBooks Online that match given criteria.";

// Define the expected input schema for searching journal entries
const toolSchema = z.object({
  criteria: z
    .array(
      filterSchema(
        z.string().describe("JournalEntry property to filter on, e.g. TxnDate, DocNumber, Adjustment, MetaData.LastUpdatedTime")
      )
    )
    .optional()
    .describe("Filters ANDed together. Each is {field, value, operator?}; operator defaults to '='. Omit to return the first 1000 journal entries."),
  ...paginationFields(),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  const response = await searchQuickbooksJournalEntries(args.params);

  if (response.isError) {
    return {
      content: [
        { type: "text" as const, text: `Error searching journal entries: ${response.error}` },
      ],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Journal entries found:` },
      { type: "text" as const, text: JSON.stringify(response.result) },
    ],
  };
};

export const SearchJournalEntriesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 