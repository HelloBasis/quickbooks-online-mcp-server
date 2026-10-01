import { searchQuickbooksEstimates } from "../handlers/search-quickbooks-estimates.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { filterValueSchema, operatorSchema, paginationFields } from "../helpers/search-schema.js";
import { z } from "zod";

const toolName = "search_estimates";
const toolDescription = "Search estimates in QuickBooks Online that match given criteria.";

// A subset of commonly‑used Estimate fields that can be filtered on.
// This is *not* an exhaustive list, but provides helpful IntelliSense / docs
// to users of the tool.  Any field returned in the Quickbooks Estimate entity is
// technically valid.
const estimateFieldEnum = z.enum([
  "Id",
  "DocNumber",
  "TxnDate",
  "TxnStatus",
  "CustomerRef",
  "TotalAmt",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
]).describe(
  "Common filterable properties of the QuickBooks Online Estimate entity. Not exhaustive: the simple {key,value} form accepts any Estimate property name."
);

const criterionSchema = z.object({
  key: z.string().describe("Simple key (legacy) – any Estimate property name."),
  value: filterValueSchema(),
});

// Advanced criterion schema with operator support.
const advancedCriterionSchema = z.object({
  field: estimateFieldEnum,
  value: filterValueSchema(),
  operator: operatorSchema(),
});

const toolSchema = z.object({
  // Allow advanced criteria array like [{field,value,operator}]
  criteria: z
    .array(advancedCriterionSchema.or(criterionSchema))
    .optional()
    .describe(
      "Filters, ANDed together. Two forms: advanced {field, value, operator?} (operator defaults to '='; supports < > <= >= LIKE IN) or simple {key, value} (equality; an array value means IN). Do not mix the two forms in one call. Omit to return the first 1000 estimates."
    ),

  ...paginationFields(),
});

export const SearchEstimatesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: async (args) => {
    const { criteria = [], ...options } = (args.params ?? {}) as z.infer<typeof toolSchema>;

    // build criteria to pass to SDK, supporting advanced operator syntax
    let criteriaToSend: any;
    if (Array.isArray(criteria) && criteria.length > 0) {
      const first = criteria[0] as any;
      if (typeof first === "object" && "field" in first) {
        criteriaToSend = [...criteria, ...Object.entries(options).map(([key, value]) => ({ field: key, value }))];
      } else {
        criteriaToSend = (criteria as Array<{ key: string; value: any }>).reduce<Record<string, any>>((acc, { key, value }) => {
          if (value !== undefined && value !== null) acc[key] = value;
          return acc;
        }, { ...options });
      }
    } else {
      criteriaToSend = { ...options };
    }

    const response = await searchQuickbooksEstimates(criteriaToSend);
    if (response.isError) {
      return {
        content: [{ type: "text" as const, text: `Error searching estimates: ${response.error}` }],
      };
    }
    return {
      content: [
        { type: "text" as const, text: Array.isArray(response.result) ? `Found ${response.result.length} estimates:` : `Count: ${response.result}` },
        ...(Array.isArray(response.result)
          ? response.result.map((e) => ({ type: "text" as const, text: JSON.stringify(e) }))
          : []),
      ],
    };
  },
}; 