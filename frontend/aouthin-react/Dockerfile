# Stage 1: Build the React Vite Application
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# In Docker / Nginx setup, API requests are reverse-proxied at /api on the same host
ENV VITE_API_URL=""

RUN npm run build

# Stage 2: Serve the build artifacts with Nginx
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
