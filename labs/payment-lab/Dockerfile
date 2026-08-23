# Multi-stage production build for Payment Lab Microservice
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig*.json ./
COPY packages ./packages
COPY labs/payment-lab ./labs/payment-lab

RUN npm ci
RUN npm --workspace=@faultforge/payment-lab run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4200

RUN apk add --no-cache curl
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/labs/payment-lab ./labs/payment-lab

EXPOSE 4200

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:4200/health || exit 1

CMD ["node", "labs/payment-lab/dist/index.js"]
