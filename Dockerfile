FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Puerto en el que se expone la API
EXPOSE 8080

# Comando por defecto
CMD ["npm", "start"]
