FROM node:20-slim
WORKDIR /app
COPY package*.json ./

# Instala só o necessário e ignora scripts que comem RAM
RUN npm install --omit=dev --ignore-scripts

COPY . .
EXPOSE 3001
CMD ["npm", "start"]
