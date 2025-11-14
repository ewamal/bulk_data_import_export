# Multi-stage build for Node.js app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY project.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate --schema=./src/prisma/schema.prisma

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src/prisma ./src/prisma

# Create uploads and exports directories
RUN mkdir -p /app/uploads /app/exports

# Set user
RUN addgroup --system app && \
    adduser --system -G app app && \
    chown -R app:app /app && \
    chown -R app:app /app/uploads /app/exports

USER app

# Expose port
EXPOSE 3000

# Default command (can be overridden by docker-compose)
CMD ["node", "dist/api/main.js"]
