FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && mkdir -p /app/data \
    && chown -R node:node /app

COPY --chown=node:node src ./src

USER node
CMD ["node", "src/index.js"]
