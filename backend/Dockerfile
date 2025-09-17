FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci || npm install

COPY tsconfig.json ./
COPY src ./src

ENV APP_PORT=8000
EXPOSE 8000

CMD ["npm", "run", "dev"] 