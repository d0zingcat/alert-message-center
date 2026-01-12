# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy the entire project
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile

# Build the web app
WORKDIR /app/apps/web
RUN bun run build

# Serve stage
FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
# Add a custom nginx config if needed to handle SPA routing, but for now default is okay
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
