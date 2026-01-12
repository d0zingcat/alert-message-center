FROM oven/bun:1-alpine

WORKDIR /app

# Copy the entire project for monorepo context
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile

WORKDIR /app/apps/server

EXPOSE 3000

CMD ["bun", "run", "start"]
