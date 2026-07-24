# ──── STAGE 1: Build React Frontend ────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ──── STAGE 2: Production Server Runner ────
FROM node:20-alpine AS runner
WORKDIR /app

# Copy backend package files and install production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy backend code
COPY backend/ ./backend/

# Copy built static frontend files from Stage 1 into /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/backend
CMD ["node", "server.js"]
