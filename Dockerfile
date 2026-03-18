FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
RUN npm prune --production --legacy-peer-deps
EXPOSE 3000
CMD ["node", "dist/index.js"]
