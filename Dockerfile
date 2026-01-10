# Multi-stage build for ZenLedger

# Stage 1: Build the frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Build the backend
FROM node:18-alpine AS backend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc

# Stage 3: Production image
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S zenledger -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /app/dist ./dist

# Copy built backend from backend-builder
COPY --from=backend-builder /app/server.js ./
COPY --from=backend-builder /app/database ./database
COPY --from=backend-builder /app/services ./services
COPY --from=backend-builder /app/types.ts ./
COPY --from=backend-builder /app/constants.tsx ./

# Copy public assets
COPY --from=frontend-builder /app/public ./public

# Change ownership to nodejs user
RUN chown -R zenledger:nodejs /app
USER zenledger

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
