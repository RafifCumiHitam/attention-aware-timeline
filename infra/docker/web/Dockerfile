# =============================================================================
# Next.js Frontend - Multi-stage Dockerfile
# =============================================================================

# -----------------------------------------------------------------------------
# Base Stage
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache libc6-compat curl

# -----------------------------------------------------------------------------
# Dependencies Stage
# -----------------------------------------------------------------------------
FROM base AS deps

COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci

# -----------------------------------------------------------------------------
# Development Stage
# -----------------------------------------------------------------------------
FROM base AS development

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ .

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Production Builder Stage
# -----------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# -----------------------------------------------------------------------------
# Production Runtime Stage
# -----------------------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
