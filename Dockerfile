FROM node:20-alpine
WORKDIR /app

# Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

COPY backend ./backend

# Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
RUN cd frontend && npm run build

# Serve frontend static from backend
RUN cp -r frontend/dist backend/public

WORKDIR /app/backend
EXPOSE 5000

CMD ["node", "server.js"]
