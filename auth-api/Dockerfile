FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY src ./src
COPY .env ./.env

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/server.js"]
