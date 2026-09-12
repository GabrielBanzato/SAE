FROM node:20
WORKDIR /app
COPY package*.json ./

# Limpa o cache, ignora o lockfile do Windows e instala só o que importa
RUN npm cache clean --force && npm install --no-package-lock --omit=dev

COPY . .
EXPOSE 3001
CMD ["npm", "start"]
