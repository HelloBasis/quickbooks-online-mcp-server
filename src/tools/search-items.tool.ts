import { searchQuickbooksItems } from "../handlers/search-quickbooks-items.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { filterSchema, filterValueSchema, operatorSchema, paginationFields } from "../helpers/search-schema.js";
import { z } from "zod";

const toolName = "search_items";
const toolDescription = "Search items in QuickBooks Online using criteria (maps to node-quickbooks findItems).";

// Allowed field lists derived from QuickBooks Online Item entity documentation (Filterable/Sortable columns)
const ALLOWED_FILTER_FIELDS = [
  "Id",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "Name",
  "Active",
  "Type",
  "Sku",
] as const;

const ALLOWED_SORT_FIELDS = [
  "Id",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "Name",
  "ParentRef",
  "PrefVendorRef",
  "UnitPrice",
  "Type",
  "QtyOnHand",
] as const;

const ITEM_FIELD_TYPE_MAP = {
  "Id": "string",
  "MetaData.CreateTime": "date",
  "MetaData.LastUpdatedTime": "date",
  "Name": "string",
  "Active": "boolean",
  "Type": "string",
  "Sku": "string",
  "ParentRef": "string",
  "PrefVendorRef": "string",
  "UnitPrice": "number",
  "QtyOnHand": "number",
};

const filterableField = () =>
  z.enum(ALLOWED_FILTER_FIELDS).describe(
    "Item property to filter on. Value types: Id, Name, Sku: string; Type: string (e.g. Inventory, NonInventory, Service); Active: boolean; MetaData.CreateTime, MetaData.LastUpdatedTime: ISO 8601 date-time."
  );

const sortableField = () => z.enum(ALLOWED_SORT_FIELDS).describe("Item property to sort by.");

const pagingKey = () =>
  z.enum(["limit", "offset", "asc", "desc", "count", "fetchAll"]).describe("Paging/sorting key when used in the array form.");

// Advanced criteria validations
const runtimeFilterSchema = z.object({
  field: filterableField(),
  value: z.any(),
  operator: operatorSchema(),
}).superRefine((obj, ctx) => {
  if (!isValidItemValueType(obj.field as string, obj.value)) {
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
      "Search criteria in one of three forms (see variants). Omit to return the first 1000 items. limit defaults to and is capped at 1000; offset is 1-based."
    ),
});

const toolHandler = async ({ params }: any) => {
  const { criteria } = params;

  // Validate against runtime schema
  const parsed = RUNTIME_CRITERIA_SCHEMA.safeParse(criteria);
  if (!parsed.success) {
    return {
      content: [
        { type: "text" as const, text: `Invalid criteria: ${parsed.error.message}` },
      ],
    };
  }

  const response = await searchQuickbooksItems(criteria);

  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error searching items: ${response.error}` }] };
  }
  const items = response.result;
  return {
    content: [
      { type: "text" as const, text: `Found ${items?.length || 0} items` },
      ...(items?.map((item) => ({ type: "text" as const, text: JSON.stringify(item) })) || []),
    ],
  };
};

function isValidItemValueType(field: string, value: any): boolean {
  const expected = ITEM_FIELD_TYPE_MAP[field as keyof typeof ITEM_FIELD_TYPE_MAP];
  if (!expected) return true;
  const check = (v: any): boolean => {
    switch (expected) {
      case "string":
        return typeof v === "string";
      case "number":
        return typeof v === "number";
      case "boolean":
        return typeof v === "boolean";
      case "date":
        return typeof v === "string";
      default:
        return true;
    }
  };
  return Array.isArray(value) ? value.every(check) : check(value);
}

export const SearchItemsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 