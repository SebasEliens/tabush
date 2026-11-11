# syntax=docker/dockerfile:1

# --- dev: Vite dev server with hot reload (used by the compose "dev" profile)
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# --- build: static bundle
FROM dev AS build
RUN npm run build

# --- runtime: any static host works; nginx here, non-root, port 8080
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-tabush-config.sh /docker-entrypoint.d/40-tabush-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
USER root
RUN chmod +x /docker-entrypoint.d/40-tabush-config.sh \
 && chown -R nginx:nginx /usr/share/nginx/html
USER nginx
ENV TABUSH_API_URL="" TABUSH_MAP_STYLE_URL="" TABUSH_TILES_URL="/tiles"
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
