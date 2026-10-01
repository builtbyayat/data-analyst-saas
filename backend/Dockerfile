FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build


FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      python3 \
      python3-venv \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY python-engine ./python-engine

RUN python3 -m venv /app/python-engine/.venv \
    && /app/python-engine/.venv/bin/pip install --no-cache-dir --upgrade pip \
    && /app/python-engine/.venv/bin/pip install --no-cache-dir \
      -r /app/python-engine/requirements.txt

RUN chown -R node:node /app

USER node

EXPOSE 3001

CMD ["node", "dist/main.js"]