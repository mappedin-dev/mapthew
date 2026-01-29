# ============================================
# Base stage - shared between dev and prod
# ============================================
FROM node:22-alpine AS base
RUN apk add --no-cache git bash python3 py3-pip curl
RUN npm install -g pnpm @anthropic-ai/claude-code
RUN pip3 install --break-system-packages mcp-atlassian

# Install GitHub's official MCP server (Go binary)
RUN curl -fsSL https://github.com/github/github-mcp-server/releases/latest/download/github-mcp-server_Linux_x86_64.tar.gz \
    | tar -xz -C /usr/local/bin github-mcp-server

# Create non-root user (required for --dangerously-skip-permissions)
RUN addgroup -S worker && adduser -S worker -G worker
WORKDIR /app
RUN chown -R worker:worker /app

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/worker/package.json ./packages/worker/

# ============================================
# Development stage
# ============================================
FROM base AS dev
RUN npm install -g tsx
RUN pnpm install --frozen-lockfile

COPY --chown=worker:worker packages/shared ./packages/shared
COPY --chown=worker:worker packages/worker ./packages/worker

USER worker
WORKDIR /app/packages/worker
CMD ["tsx", "watch", "src/index.ts"]

# ============================================
# Build stage - compile TypeScript
# ============================================
FROM base AS builder
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/worker ./packages/worker

RUN pnpm --filter @mapthew/shared build && \
    pnpm --filter @mapthew/worker build

# ============================================
# Production stage
# ============================================
FROM base AS prod
RUN pnpm install --frozen-lockfile --prod

COPY --chown=worker:worker --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=worker:worker --from=builder /app/packages/worker/dist ./packages/worker/dist
COPY --chown=worker:worker packages/worker/mcp-config.json ./packages/worker/
COPY --chown=worker:worker packages/worker/instructions ./packages/worker/instructions

USER worker
WORKDIR /app/packages/worker
CMD ["node", "dist/index.js"]
