# Multi-stage production build for FaultForge Web SPA
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root manifest and workspaces
COPY package*.json tsconfig*.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# Install all dependencies and build React app with Vite
RUN npm ci
RUN npm --workspace=@faultforge/web run build

# Nginx production image
FROM nginx:1.27-alpine AS runner

# Copy built assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy custom Nginx SPA configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
