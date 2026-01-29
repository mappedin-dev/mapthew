# ============================================
# Base stage - shared between dev and prod
# ============================================
FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/webhook/package.json ./packages/webhook/

# ============================================
# Development stage
# ============================================
FROM base AS dev
RUN npm install -g tsx
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/webhook ./packages/webhook

WORKDIR /app/packages/webhook
CMD ["tsx", "watch", "src/index.ts"]

# ============================================
# Build stage - compile TypeScript
# ============================================
FROM base AS builder
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/webhook ./packages/webhook

RUN pnpm --filter @mapthew/shared build && \
    pnpm --filter @mapthew/webhook build

# ============================================
# Production stage
# ============================================
FROM base AS prod
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/webhook/dist ./packages/webhook/dist

WORKDIR /app/packages/webhook
CMD ["node", "dist/index.js"]
