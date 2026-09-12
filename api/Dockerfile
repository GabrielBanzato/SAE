FROM node:20-slim
WORKDIR /app
COPY package*.json ./

# Instala as dependências
RUN npm install --omit=dev --ignore-scripts

COPY . .

# Gera o Prisma Client
RUN npx prisma generate

EXPOSE 3001
CMD ["npm", "start"]
