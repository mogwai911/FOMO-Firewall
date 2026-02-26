FROM node:20-bookworm AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/docker/entrypoint.sh ./scripts/docker/entrypoint.sh
COPY --from=builder /app/scripts/release/sanitize-db.mjs ./scripts/release/sanitize-db.mjs

RUN chmod +x ./scripts/docker/entrypoint.sh \
  && mkdir -p /app/data \
  && npx prisma generate

EXPOSE 3000

ENTRYPOINT ["./scripts/docker/entrypoint.sh"]
