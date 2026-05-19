#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.local"

if [ -f "$ENV_FILE" ]; then
  echo ".env.local already exists. Delete it first if you want to regenerate."
  exit 1
fi

cat > "$ENV_FILE" <<EOF
# Required
NEXT_PUBLIC_BASE_URL=http://localhost:3000
BETTER_AUTH_SECRET=$(openssl rand -base64 26 | tr -dc 'a-zA-Z0-9' | head -c 32)
POSTGRES_URL=postgres://banana:banana@postgres:5432/banana_db
POSTGRES_PASSWORD=banana

# Port
WEB_PORT=3000
EOF

echo "Created $ENV_FILE"