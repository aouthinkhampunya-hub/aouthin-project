FROM node:20-slim

WORKDIR /app

# Install build tools for native node modules
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first for efficient caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the backend source code
COPY . .

# Ensure uploads directory exists
RUN mkdir -p public/uploads

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV DOCKER=true

CMD ["node", "server/server.js"]
