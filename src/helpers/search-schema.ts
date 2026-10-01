import { z } from "zod";

export const QUERY_OPERATORS = ["=", "<", ">", "<=", ">=", "LIKE", "IN"] as const;

// These are factories rather than shared instances on purpose: zod-to-json-schema
// emits a `$ref` for a schema object that appears twice in one tool, and several
// MCP clients cannot resolve those.
export function operatorSchema() {
  return z
    .enum(QUERY_OPERATORS)
    .optional()
    .describe(
      "Comparison operator, default '='. LIKE requires % wildcards inside value (e.g. \"%Smith%\"); matching is case-insensitive. IN requires value to be an array."
    );
}

export function filterValueSchema() {
  return z
    .union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
    .describe(
      "Value to compare against. Dates are YYYY-MM-DD (TxnDate, DueDate); MetaData.CreateTime/LastUpdatedTime take ISO 8601 date-times such as 2024-01-31T00:00:00-08:00. *Ref fields (CustomerRef, VendorRef, ...) take the referenced entity's Id. Use an array only with operator IN."
    );
}

export function filterSchema<T extends z.ZodTypeAny>(field: T) {
  return z.object({ field, value: filterValueSchema(), operator: operatorSchema() });
}

export function paginationFields<T extends z.ZodTypeAny = z.ZodString>(sortField?: () => T) {
  const asc = sortField ? sortField() : z.string();
  const desc = sortField ? sortField() : z.string();
  return {
    limit: z
      .number()
      .optional()
      .describe("Maximum rows to return (QuickBooks maxresults). Default and hard maximum 1000."),
    offset: z
      .number()
      .optional()
      .describe(
        "1-based position of the first row to return (QuickBooks startposition). Default 1. Page with offset 1, 1001, 2001, ..."
      ),
    asc: asc.optional().describe("Sort ascending by this field name (e.g. \"TxnDate\"). Use asc or desc, not both."),
    desc: desc.optional().describe("Sort descending by this field name (e.g. \"TxnDate\"). Use asc or desc, not both."),
    fetchAll: z
      .boolean()
      .optional()
      .describe(
        "If true, keep requesting pages until every matching row is returned. Can be slow and large; prefer limit/offset."
      ),
    count: z
      .boolean()
      .optional()
      .describe("If true, return only the number of matching rows instead of the rows themselves."),
  };
}
