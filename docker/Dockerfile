FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/testkit/package.json packages/testkit/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS api
COPY . .
ENV DATA_DIR=/data
ENV API_HOST=0.0.0.0
ENV API_PORT=3001
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["pnpm", "exec", "tsx", "src/server.ts"]

FROM deps AS web-build
COPY . .
ARG INTERNAL_API_BASE_URL=http://api:3001/api/v1
ENV INTERNAL_API_BASE_URL=$INTERNAL_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=/api/v1
RUN pnpm --filter @family-os/web build

FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
