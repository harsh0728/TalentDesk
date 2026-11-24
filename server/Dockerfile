FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["sh", "-c", "until node -e \"const m=require('mongoose');m.connect(process.env.MONGODB_URI).then(()=>process.exit(0)).catch(()=>process.exit(1))\"; do echo 'Waiting for MongoDB...'; sleep 2; done; npm run migrate && npm run seed && npm start"]
