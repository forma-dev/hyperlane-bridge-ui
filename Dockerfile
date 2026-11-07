FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
EXPOSE 3000
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":3000"]
