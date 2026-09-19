FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
COPY packages ./packages
COPY services/api/package.json ./services/api/package.json
RUN npm install --workspaces --if-present --omit=dev

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY services/api/src ./services/api/src
COPY services/api/package.json ./services/api/package.json
WORKDIR /app/services/api
EXPOSE 4000
CMD ["node", "src/server.js"]
