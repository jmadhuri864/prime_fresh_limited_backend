# =============================================================================
# Stage 1: Builder
# Install all dependencies and compile TypeScript → JavaScript
# =============================================================================
FROM node:20-alpine AS builder

# Install build tools needed for native addons (bcrypt, sharp, puppeteer)
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy package files first (layer cache — only re-runs npm install when these change)
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies needed for tsc)
RUN npm ci

# Copy the rest of the source
COPY tsconfig.json ./
COPY config ./config
COPY src ./src

# Compile TypeScript to ./build
RUN npm run build


# =============================================================================
# Stage 2: Production image
# Only copy compiled JS + production node_modules — no TypeScript tooling
# =============================================================================
FROM node:20-alpine AS production

# Puppeteer requires Chromium; install it alongside system fonts
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    # sharp requires vips
    vips-dev \
    # General native addon build deps
    python3 make g++ libc6-compat

# Tell Puppeteer to use the system-installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Timezone — all timestamps use Asia/Kolkata
ENV TZ=Asia/Kolkata
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Asia/Kolkata /etc/localtime \
    && echo "Asia/Kolkata" > /etc/timezone

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/build ./build

# Copy config folder (used by the `config` npm package at runtime)
COPY config ./config

# Create runtime directories that the app writes to
RUN mkdir -p logs exports uploads multiuploads reports/sales reports/registration

# Run as a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

# Application port (matches PORT in .env / config)
EXPOSE 4000

# Health check — polls the root endpoint every 30 seconds
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:4000/ || exit 1

# Start the compiled app
CMD ["node", "build/app.js"]
