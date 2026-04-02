# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (cached layer)
COPY package*.json ./
RUN npm ci --quiet

# Build-time environment variables (injected by docker-compose build args)
ARG VITE_WS_URL=""
ARG VITE_CESIUM_TOKEN=""
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_CESIUM_TOKEN=$VITE_CESIUM_TOKEN

COPY . .
RUN npm run build

# ── Stage 2: Serve with nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist        /usr/share/nginx/html
COPY nginx.conf                    /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
