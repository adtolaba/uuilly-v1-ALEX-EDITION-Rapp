# Base stage for shared configuration
FROM node:20-slim AS base
WORKDIR /app

# Dependencies stage
FROM base AS builder
COPY package*.json ./
RUN npm install

# Development stage
FROM base AS development
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# Production stage (assuming a static build)
FROM base AS production
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
# For a real production app, you might serve this with Nginx, 
# but for consistency we'll keep it simple for now or use a server.
# For now, let's just make sure it builds.
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
