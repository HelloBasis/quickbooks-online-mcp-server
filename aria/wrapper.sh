#!/bin/sh
# quickbooks — the read-only QuickBooks Online CLI, wired for the Aria sandbox:
#   1. connection — realm id + Intuit environment come from the per-org file
#                   aria-letta-service uploads when the owner connects QuickBooks
#   2. credential — QUICKBOOKS_ACCESS_TOKEN is an OpenShell provider placeholder;
#                   the egress proxy swaps in the real token only for the pinned
#                   binary below, so nothing here (or in the agent's shell) can
#                   spend it directly
#
# Usage: quickbooks --help | quickbooks <command> --help | quickbooks <command> --params '<json>'

CONNECTION=/sandbox/.aria/quickbooks.json
BIN=/usr/local/bin/quickbooks-cli

case "$1" in
    ""|-h|--help|__mcporter_inspect) exec "$BIN" "$@" ;;
esac
case "$2" in
    -h|--help) exec "$BIN" "$@" ;;
esac

if [ ! -r "$CONNECTION" ] || [ -z "$QUICKBOOKS_ACCESS_TOKEN" ]; then
    echo "QuickBooks Online is not connected for this practice. Ask the user to connect it in Settings -> Connections (Connect QuickBooks)." >&2
    exit 2
fi

QUICKBOOKS_REALM_ID=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["realmId"])' "$CONNECTION") || exit 2
QUICKBOOKS_ENVIRONMENT=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("environment","production"))' "$CONNECTION") || exit 2
export QUICKBOOKS_REALM_ID QUICKBOOKS_ENVIRONMENT

# exec so the pinned ELF is the process the proxy sees, not this shell.
exec "$BIN" "$@"
