import { searchQuickbooksAccounts } from "../handlers/search-quickbooks-accounts.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { filterSchema, filterValueSchema, operatorSchema, paginationFields } from "../helpers/search-schema.js";
import { z } from "zod";

const toolName = "search_accounts";
const toolDescription = "Search chart‑of‑accounts entries using criteria.";

// Allowed field lists based on QuickBooks Online Account entity documentation. Only these can be
// used in the search criteria.
const ALLOWED_FILTER_FIELDS = [
  "Id",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "Name",
  "SubAccount",
  "ParentRef",
  "Description",
  "Active",
  "Classification",
  "AccountType",
  "CurrentBalance",
] as const;

const ALLOWED_SORT_FIELDS = [
  "Id",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "Name",
  "SubAccount",
  "ParentRef",
  "Description",
  "CurrentBalance",
] as const;

// BEGIN ADD FIELD TYPE MAP
const ACCOUNT_FIELD_TYPE_MAP: Record<string, "string" | "number" | "boolean" | "date"> = {
  Id: "string",
  "MetaData.CreateTime": "date",
  "MetaData.LastUpdatedTime": "date",
  Name: "string",
  SubAccount: "boolean",
  ParentRef: "string",
  Description: "string",
  Active: "boolean",
  Classification: "string",
  AccountType: "string",
  CurrentBalance: "number",
};

function isValidValueType(field: string, value: any): boolean {
  const expected = ACCOUNT_FIELD_TYPE_MAP[field];
  if (!expected) return true; // If field not in map, skip type check.
  switch (expected) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "date":
      return typeof value === "string"; // assume ISO date string
    default:
      return true;
  }
}
// END ADD FIELD TYPE MAP

// Zod schemas that validate the fields against the above white-lists
const filterableField = () =>
  z.enum(ALLOWED_FILTER_FIELDS).describe(
    "Account property to filter on. Value types: Id, Name, Description: string; ParentRef: string Id of the parent account; Classification: string (Asset, Liability, Equity, Revenue, Expense); AccountType: string (e.g. Bank, Expense, Accounts Receivable); SubAccount, Active: boolean; CurrentBalance: number; MetaData.CreateTime, MetaData.LastUpdatedTime: ISO 8601 date-time."
  );

const sortableField = () => z.enum(ALLOWED_SORT_FIELDS).describe("Account property to sort by.");

const pagingKey = () =>
  z.enum(["limit", "offset", "asc", "desc", "count", "fetchAll"]).describe("Paging/sorting key when used in the array form.");

// Advanced criteria shape
const runtimeFilterSchema = z.object({
  field: filterableField(),
  value: z.any(),
  operator: operatorSchema(),
}).superRefine((obj, ctx) => {
  if (!isValidValueType(obj.field, obj.value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Value type does not match expected type for field ${obj.field}`,
    });
  }
});

const advancedCriteriaSchema = z.object({
  filters: z.array(runtimeFilterSchema).optional(),
  asc: sortableField().optional(),
  desc: sortableField().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  count: z.boolean().optional(),
  fetchAll: z.boolean().optional(),
});

// Runtime schema keeps full validation
const RUNTIME_CRITERIA_SCHEMA = z.union([
  z.record(z.any()),
  z.array(z.record(z.any())),
  advancedCriteriaSchema,
]);

// ---------- Coercion & Normalization ----------
function coerceAccountFieldValue(field: string, value: any): any {
  const expected = ACCOUNT_FIELD_TYPE_MAP[field as keyof typeof ACCOUNT_FIELD_TYPE_MAP];
  if (!expected) return value;

  const convert = (v: any): any => {
    switch (expected) {
      case "string":
        return typeof v === "string" ? v : String(v);
      case "number":
        return typeof v === "number" ? v : Number(v);
      case "boolean":
        return typeof v === "boolean" ? v : (v === "true" || v === 1 || v === "1");
      case "date":
        return typeof v === "string" ? v : String(v);
      default:
        return v;
    }
  };
  return Array.isArray(value) ? value.map(convert) : convert(value);
}

function normalizeAccountCriteria(criteria: any): any {
  if (!criteria) return criteria;

  // Advanced format with filters
  if (criteria.filters && Array.isArray(criteria.filters)) {
    return {
      ...criteria,
      filters: criteria.filters.map((f: any) => ({
        ...f,
        value: coerceAccountFieldValue(f.field, f.value),
      })),
    };
  }

  // Array of criteria objects
  if (Array.isArray(criteria)) {
    return criteria.map(normalizeAccountCriteria);
  }

  // Simple key-value map criteria
  if (typeof criteria === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(criteria)) {
      out[k] = coerceAccountFieldValue(k, v);
    }
    return out;
  }

  return criteria;
}

// Exposed schema. The object variant must be passthrough: the SDK hands the
// handler the parsed value, and a plain z.object would strip simple-form keys.
const toolSchema = z.object({
  criteria: z
    .union([
      z
        .object({
          filters: z
            .array(filterSchema(filterableField()))
            .optional()
            .describe("Filters ANDed together. Each is {field, value, operator?}; operator defaults to '='."),
          ...paginationFields(sortableField),
        })
        .passthrough()
        .describe("Advanced form: filters plus paging/sorting."),
      z
        .array(
          z.object({
            field: z.union([filterableField(), pagingKey()]),
            value: filterValueSchema(),
            operator: operatorSchema(),
          })
        )
        .describe(
          "Array form: filters ANDed together; may also include {field:\"limit\"|\"offset\"|\"asc\"|\"desc\"|\"count\"|\"fetchAll\", value}."
        ),
      z
        .record(z.any())
        .describe(
          "Simple form: {FieldName: value, ...}; equality only, an array value means IN. Do not combine with limit/offset/asc/desc/count/fetchAll keys (use the advanced form instead)."
        ),
    ])
    .optional()
    .describe(
      "Search criteria in one of three forms (see variants). Omit to return the first 1000 accounts. limit defaults to and is capped at 1000; offset is 1-based."
    ),
});

// Tool handler with runtime validation & coercion
const toolHandler = async ({ params }: any) => {
  const { criteria } = params;
  const parsed = RUNTIME_CRITERIA_SCHEMA.safeParse(criteria);
  if (!parsed.success) {
    return { content: [{ type: "text" as const, text: `Invalid criteria: ${parsed.error.message}` }] };
  }
  const normalized = normalizeAccountCriteria(criteria);
  const response = await searchQuickbooksAccounts(normalized);
  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error searching accounts: ${response.error}` }] };
  }
  const accounts = response.result;
  return {
    content: [
      { type: "text" as const, text: `Found ${accounts?.length || 0} accounts:` },
      ...(accounts?.map((acc: any) => ({ type: "text" as const, text: JSON.stringify(acc) })) || []),
    ],
  };
};

// Update export
export const SearchAccountsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 