FROM node:20-alpine
WORKDIR /app
RUN npm install -g tsx
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npx vite build
EXPOSE 3000
CMD ["tsx", "server/_core/index.ts"]
