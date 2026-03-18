FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npx vite build
EXPOSE 3000
CMD ["npx", "tsx", "server/_core/index.ts"]
# Thu Mar 19 00:58:30 EET 2026
