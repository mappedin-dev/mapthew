FROM node:22-alpine

RUN npm install -g pnpm tsx

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .

CMD ["tsx", "watch", "src/index.ts"]
