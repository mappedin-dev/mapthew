# ============================================
# Base stage - shared between dev and prod
# ============================================
FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/dashboard/package.json ./packages/dashboard/

# ============================================
# Development stage - watch and rebuild
# ============================================
FROM base AS dev
RUN pnpm install --frozen-lockfile

COPY packages/dashboard ./packages/dashboard

WORKDIR /app/packages/dashboard
CMD ["pnpm", "build:watch"]

# ============================================
# Build stage - compile for production
# ============================================
FROM base AS builder
RUN pnpm install --frozen-lockfile

COPY packages/dashboard ./packages/dashboard

RUN pnpm --filter @mapthew/dashboard build

# ============================================
# Production stage - just the built files
# ============================================
FROM alpine AS prod
COPY --from=builder /app/packages/dashboard/dist /dist
