/**
 * Formats an error into a standardized error message
 * @param error Any error object to format
 * @returns A formatted error message as a string
 */
export function formatError(error: unknown): string {
  const fault = formatQuickbooksFault(error);
  if (fault) {
    return fault;
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  } else if (typeof error === 'string') {
    return `Error: ${error}`;
  } else {
    return `Unknown error: ${JSON.stringify(error)}`;
  }
}

// node-quickbooks reports API failures either as an axios error whose response body
// holds the QuickBooks Fault, or as the Fault body itself; the axios message alone
// ("Request failed with status code 400") hides why QuickBooks rejected the call.
function formatQuickbooksFault(error: unknown): string | null {
  const anyError = error as any;
  const body = anyError?.response?.data ?? anyError;
  const faultErrors = body?.Fault?.Error;
  if (!Array.isArray(faultErrors) || faultErrors.length === 0) {
    return null;
  }
  const details = faultErrors
    .map((entry: any) =>
      [entry?.Message, entry?.Detail, entry?.code !== undefined ? `(code ${entry.code})` : ""]
        .filter((part) => typeof part === "string" && part.length > 0)
        .join(" - ")
    )
    .join("; ");
  const status = anyError?.response?.status;
  const type = typeof body?.Fault?.type === "string" ? ` ${body.Fault.type}` : "";
  return `Error: QuickBooks${type} fault${status ? ` (HTTP ${status})` : ""}: ${details}`;
}
