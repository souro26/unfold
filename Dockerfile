# ==============================================================================
# Multi-Stage Production Dockerfile for Unfold
# Stage 1: Build the Vite + TypeScript web application
# Stage 2: Serve via high-performance Nginx Alpine container (< 30 MB)
# ==============================================================================

# --- Stage 1: Builder ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests for efficient layer caching
COPY package.json package-lock.json ./

# Install clean production and build dependencies
RUN npm ci

# Copy application sources
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY src/ ./src/
COPY public/ ./public/

# Build static production bundle into dist/
RUN npm run build

# --- Stage 2: Runner ---
FROM nginx:alpine AS runner

# Remove default nginx boilerplate
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration with SPA routing and WASM MIME types
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled production bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP port
EXPOSE 80

# Healthcheck to verify web server availability
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Launch Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
