FROM node:20-alpine

# Crear directorio de app
WORKDIR /usr/src/app

# Instalar dependencias
COPY package*.json ./
RUN npm install --only=production

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 3000

# Comando para iniciar
CMD [ "node", "api/server.js" ]
