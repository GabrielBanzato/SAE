FROM node:20-slim
WORKDIR /app

# Prisma precisa do OpenSSL pra detectar a versão da libssl do sistema -
# sem isso o "prisma generate"/client em runtime avisa
# "Prisma failed to detect the libssl/openssl version" no node:20-slim.
RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./

# Instala as dependências
RUN npm install --omit=dev --ignore-scripts

COPY . .

# Gera o Prisma Client
RUN npx prisma generate

EXPOSE 3001
CMD ["npm", "start"]
