# Multi-stage production build for FaultForge Worker Engine
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root manifest and workspaces
COPY package*.json tsconfig*.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
COPY labs ./labs

# Install all dependencies and build
RUN npm ci
RUN npm --workspace=@faultforge/worker run build

# Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Run as non-root user
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/apps/worker ./apps/worker

CMD ["node", "apps/worker/dist/index.js"]
