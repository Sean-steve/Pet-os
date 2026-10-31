FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run server:build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/server/migrations ./server/migrations
EXPOSE 3001
CMD ["sh","-c","node dist-server/migrate.js && node dist-server/index.js"]
