FROM node:18-alpine

WORKDIR /app

# Copiar package files y .npmrc
COPY package*.json .npmrc ./

# Instalar dependencias con legacy-peer-deps
RUN npm install

# Copiar código fuente
COPY . .

# Build de la aplicación
RUN npm run build

# Comando de inicio
CMD ["node", "serve.js"]
