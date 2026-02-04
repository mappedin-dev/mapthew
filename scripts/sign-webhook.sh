#!/bin/bash
# Compute HMAC-SHA256 signature for webhook testing
# Usage: ./scripts/sign-webhook.sh [json-file]
#
# Reads JIRA_WEBHOOK_SECRET from .env and writes REQUESTS_HTTP_JIRA_WEBHOOK_SIGNATURE back to .env

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
OUTPUT_VAR="REQUESTS_HTTP_JIRA_WEBHOOK_SIGNATURE"

# Load .env
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

source "$ENV_FILE"

if [ -z "$JIRA_WEBHOOK_SECRET" ]; then
  echo "Error: JIRA_WEBHOOK_SECRET not set in .env"
  exit 1
fi

# Get JSON body from file or use default test payload
if [ -n "$1" ]; then
  if [ ! -f "$1" ]; then
    echo "Error: File not found: $1"
    exit 1
  fi
  BODY=$(cat "$1" | tr -d '\n' | tr -s ' ')
else
  # Default test payload
  BODY='{"webhookEvent":"comment_created","comment":{"body":"@mapthew implement the change described in this ticket","author":{"displayName":"Test Developer"}},"issue":{"key":"MPTW-1"}}'
fi

# Compute signature
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$JIRA_WEBHOOK_SECRET" | sed 's/^.* //')

echo "Computed signature: $SIGNATURE"

# Update or add signature in .env
if grep -q "^${OUTPUT_VAR}=" "$ENV_FILE"; then
  # Update existing
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^${OUTPUT_VAR}=.*/${OUTPUT_VAR}=$SIGNATURE/" "$ENV_FILE"
  else
    sed -i "s/^${OUTPUT_VAR}=.*/${OUTPUT_VAR}=$SIGNATURE/" "$ENV_FILE"
  fi
else
  # Add new
  echo "${OUTPUT_VAR}=$SIGNATURE" >> "$ENV_FILE"
fi

echo "Updated .env with ${OUTPUT_VAR}"
