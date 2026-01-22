FROM node:22-alpine

RUN apk add --no-cache git bash

RUN npm install -g pnpm tsx @anthropic-ai/claude-code \
    @modelcontextprotocol/server-atlassian \
    @modelcontextprotocol/server-github

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .

CMD ["tsx", "watch", "src/index.ts"]
