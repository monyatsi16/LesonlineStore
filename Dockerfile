FROM node:20-alpine

WORKDIR /app

# Install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Build (client + server) if applicable
RUN npm run build || true

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "run", "start"]
