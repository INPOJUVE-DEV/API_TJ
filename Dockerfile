FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Puerto en el que se expone la API
EXPOSE 8080

# Comando por defecto
CMD ["npm", "start"]