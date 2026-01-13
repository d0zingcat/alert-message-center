# Build stage for web
FROM oven/bun:1-alpine AS web-builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
WORKDIR /app/apps/web
RUN bun run build

# Final stage
FROM oven/bun:1-alpine
WORKDIR /app

# Copy the entire project for monorepo context
COPY . .

# Install dependencies for the server (and shared workspace if any)
RUN bun install --frozen-lockfile

# Copy built web assets to server's public directory
COPY --from=web-builder /app/apps/web/dist /app/apps/server/public

WORKDIR /app/apps/server

EXPOSE 3000

CMD ["bun", "run", "start"]
