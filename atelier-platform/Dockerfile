FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY atelier-platform/apps/api/package.json atelier-platform/apps/api/package.json
COPY atelier-platform/apps/web/package.json atelier-platform/apps/web/package.json
COPY etalier-landing/package.json etalier-landing/package.json
RUN npm ci
COPY atelier-platform/apps ./atelier-platform/apps
COPY etalier-landing ./etalier-landing
ENV API_INTERNAL_URL=http://api:4000
RUN npm run build
ENV NODE_ENV=production
USER node
EXPOSE 3000 4000
CMD ["npm","run","start","-w","@atelier/web"]

