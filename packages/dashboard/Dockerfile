# ============================================
# Base stage - shared between dev and prod
# ============================================
FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/dashboard/package.json ./packages/dashboard/

# ============================================
# Development stage - watch and rebuild
# ============================================
FROM base AS dev
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/dashboard ./packages/dashboard

# Build shared package first
RUN pnpm --filter @mapthew/shared build

WORKDIR /app/packages/dashboard
CMD ["pnpm", "build:watch"]

# ============================================
# Build stage - compile for production
# ============================================
FROM base AS builder
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/dashboard ./packages/dashboard

# Build shared first, then dashboard
RUN pnpm --filter @mapthew/shared build && pnpm --filter @mapthew/dashboard build

# ============================================
# Production stage - just the built files
# ============================================
FROM alpine AS prod
COPY --from=builder /app/packages/dashboard/dist /dist
