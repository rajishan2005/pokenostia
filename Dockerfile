# PokeNostia — Railway / container deploy
FROM node:20-alpine AS deps
WORKDIR /app
# Prisma needs OpenSSL libs on Alpine
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy URL so prisma generate never fails during build
ENV DATABASE_URL="file:./build.db"
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
# Critical: without these, Prisma 5.x crashes looking for libssl on Alpine
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/data/holovault.db"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data \
  && chown -R nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY scripts/docker-entrypoint.js /app/docker-entrypoint.js

RUN chown -R nextjs:nodejs /app

# root so /data volume is writable even when Railway mounts as root
USER root
EXPOSE 3000

CMD ["node", "/app/docker-entrypoint.js"]
