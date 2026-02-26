# FROM node:20-bookworm-slim

# WORKDIR /app

# COPY package.json package-lock.json* ./
# RUN npm install --production

# COPY src ./src
# COPY .env ./.env

# ENV NODE_ENV=production
# EXPOSE 4000

# CMD ["node", "src/server.js"]
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY src ./src

ENV NODE_ENV=production

# Cloud Run requires app to listen on $PORT
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/server.js"]
