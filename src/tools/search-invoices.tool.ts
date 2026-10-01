import { searchQuickbooksInvoices } from "../handlers/search-quickbooks-invoices.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { filterSchema, filterValueSchema, operatorSchema, paginationFields } from "../helpers/search-schema.js";
import { z } from "zod";

const toolName = "search_invoices";
const toolDescription = "Search invoices in QuickBooks Online using criteria (maps to node-quickbooks findInvoices).";

// ALLOWED FIELD LISTS (derived from Quickbooks Invoice entity docs – Filterable and Sortable columns)
const ALLOWED_FILTER_FIELDS = [
  "Id",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "DocNumber",
  "TxnDate",
  "DueDate",
  "CustomerRef",
  "ClassRef",
  "DepartmentRef",
  "Balance",
  "TotalAmt",
] as const;

const ALLOWED_SORT_FIELDS = [
  "Id",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "DocNumber",
  "TxnDate",
  "Balance",
  "TotalAmt",
] as const;

// FIELD TYPE MAP
const FIELD_TYPE_MAP = {
  "Id": "string",
  "MetaData.CreateTime": "date",
  "MetaData.LastUpdatedTime": "date",
  "DocNumber": "string",
  "TxnDate": "date",
  "DueDate": "date",
  "CustomerRef": "string",
  "ClassRef": "string",
  "DepartmentRef": "string",
  "Balance": "number",
  "TotalAmt": "number",
} as const;

// Helper function to check if the value type matches the expected type for the field
const isValidInvoiceValueType = (field: string, value: any): boolean => {
  const expectedType = FIELD_TYPE_MAP[field as keyof typeof FIELD_TYPE_MAP];
  return typeof value === expectedType;
};

// Zod schemas that validate the fields against the white-lists
const filterableField = () =>
  z.enum(ALLOWED_FILTER_FIELDS).describe(
    "Invoice property to filter on. Value types: Id, DocNumber: string; CustomerRef, ClassRef, DepartmentRef: string Id of the referenced entity; TxnDate, DueDate: YYYY-MM-DD; MetaData.CreateTime, MetaData.LastUpdatedTime: ISO 8601 date-time; Balance, TotalAmt: number."
  );

const sortableField = () => z.enum(ALLOWED_SORT_FIELDS).describe("Invoice property to sort by.");

const pagingKey = () =>
  z.enum(["limit", "offset", "asc", "desc", "count", "fetchAll"]).describe("Paging/sorting key when used in the array form.");

// Criteria can be advanced
const runtimeFilterSchema = z.object({
  field: filterableField(),
  value: z.any(),
  operator: operatorSchema(),
}).superRefine((obj, ctx) => {
  if (!isValidInvoiceValueType(obj.field as string, obj.value)) {
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

// Runtime schema used internally for validation
const RUNTIME_CRITERIA_SCHEMA = z.union([
  z.record(z.any()),
  z.array(z.record(z.any())),
  advancedCriteriaSchema,
]);

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
      "Search criteria in one of three forms (see variants). Omit to return the first 1000 invoices. Dates are YYYY-MM-DD; limit defaults to and is capped at 1000; offset is 1-based."
    ),
});

const toolHandler = async ({ params }: any) => {
  const { criteria } = params;

  // Validate runtime schema
  const parsed = RUNTIME_CRITERIA_SCHEMA.safeParse(criteria);
  if (!parsed.success) {
    return {
      content: [
        { type: "text" as const, text: `Invalid criteria: ${parsed.error.message}` },
      ],
    };
  }

  const response = await searchQuickbooksInvoices(criteria);

  if (response.isError) {
    return {
      content: [
        { type: "text" as const, text: `Error searching invoices: ${response.error}` },
      ],
    };
  }
  const invoices = response.result;
  return {
    content: [
      { type: "text" as const, text: `Found ${invoices?.length || 0} invoices` },
      ...(invoices?.map((inv) => ({ type: "text" as const, text: JSON.stringify(inv) })) || []),
    ],
  };
};

export const SearchInvoicesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 