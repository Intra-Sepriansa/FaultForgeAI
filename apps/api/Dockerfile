# Multi-stage production build for FaultForge API Gateway
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root manifest and workspaces
COPY package*.json tsconfig*.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY labs ./labs

# Install all dependencies and build
RUN npm ci
RUN npm --workspace=@faultforge/api run build

# Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Install curl for healthcheck
RUN apk add --no-cache curl

# Run as non-root user
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/apps/api ./apps/api

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
