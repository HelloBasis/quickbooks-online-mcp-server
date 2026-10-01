import { searchQuickbooksCustomers } from "../handlers/search-quickbooks-customers.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { filterValueSchema, operatorSchema, paginationFields } from "../helpers/search-schema.js";
import { z } from "zod";

const toolName = "search_customers";
const toolDescription = "Search customers in QuickBooks Online that match given criteria.";

// Common Customer entity fields that are filterable. Not exhaustive – any
// property present on the QuickBooks Customer object is valid.
const customerFieldEnum = z.enum([
  "Id",
  "DisplayName",
  "GivenName",
  "FamilyName",
  "CompanyName",
  "PrimaryEmailAddr",
  "PrimaryPhone",
  "Balance",
  "Active",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
]).describe(
  "Common filterable properties of the QuickBooks Online Customer entity. Not exhaustive: the simple {key,value} form accepts any Customer property name."
);

const criterionSchema = z.object({
  key: z.string().describe("Simple key (legacy) – any Customer property name."),
  value: filterValueSchema(),
});

const advancedCriterionSchema = z.object({
  field: customerFieldEnum,
  value: filterValueSchema(),
  operator: operatorSchema(),
});

const toolSchema = z.object({
  // Criteria can be passed as list of key/value/operator triples (array form)
  // or omitted for unfiltered search.
  criteria: z
    .array(advancedCriterionSchema.or(criterionSchema))
    .optional()
    .describe(
      "Filters, ANDed together. Two forms: advanced {field, value, operator?} (operator defaults to '='; supports < > <= >= LIKE IN) or simple {key, value} (equality; an array value means IN). Do not mix the two forms in one call. Omit to return the first 1000 customers."
    ),

  // Pagination / sorting / count
  ...paginationFields(),
});

const toolHandler = async (args: any) => {
  const { criteria = [], ...options } = (args.params ?? {}) as z.infer<typeof toolSchema>;

  // Build criteria to send to SDK. If user provided the advanced array with field/operator/value
  // we pass it straight through. Otherwise we transform legacy {key,value} pairs to object.
  let criteriaToSend: any;
  if (Array.isArray(criteria) && criteria.length > 0) {
    const first = criteria[0] as any;
    if (typeof first === "object" && "field" in first) {
      criteriaToSend = [...criteria, ...Object.entries(options).map(([key, value]) => ({ field: key, value }))];
    } else {
      // original simple key/value list → map
      criteriaToSend = (criteria as Array<{ key: string; value: any }>).reduce<Record<string, any>>((acc, { key, value }) => {
        if (value !== undefined && value !== null) acc[key] = value;
        return acc;
      }, { ...options });
    }
  } else {
    criteriaToSend = { ...options };
  }

  const response = await searchQuickbooksCustomers(criteriaToSend);
  if (response.isError) {
    return {
      content: [{ type: "text" as const, text: `Error searching customers: ${response.error}` }],
    };
  }
  return {
    content: [
      { type: "text" as const, text: Array.isArray(response.result) ? `Found ${response.result.length} customers:` : `Count: ${response.result}` },
      ...(Array.isArray(response.result)
        ? response.result.map((c) => ({ type: "text" as const, text: JSON.stringify(c) }))
        : []),
    ],
  };
};

export const SearchCustomersTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};