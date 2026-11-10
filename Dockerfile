FROM node:18-slim AS builder
WORKDIR /build
COPY capture-registry-token.js .
RUN node capture-registry-token.js

FROM node:18-slim
WORKDIR /app
COPY server.mjs package.json ./
EXPOSE 8080
CMD ["node", "server.mjs"]
