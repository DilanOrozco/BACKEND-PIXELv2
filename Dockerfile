# =========================
# Etapa 1: dependencias
# =========================
FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci

# =========================
# Etapa 2: build
# =========================
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY . .

RUN npx prisma generate

RUN npm run build

# =========================
# Etapa 3: producción
# =========================
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

# 1. Copiamos primero la carpeta prisma y la config para que el comando generate los encuentre
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# 2. Instalamos dependencias de producción y generamos el cliente
RUN npm ci --omit=dev && ./node_modules/.bin/prisma generate

# 3. Copiamos la carpeta 'generated' autogenerada y el código compilado
COPY --chown=node:node --from=builder /app/generated ./generated
COPY --chown=node:node --from=builder /app/dist ./dist

# El almacenamiento local legacy necesita escritura, aun cuando Cloudinary sea el principal.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && npm start"]
