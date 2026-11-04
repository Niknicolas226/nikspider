FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:8000
ARG VITE_DEMO_TARGET_URL=http://localhost:5000
ARG VITE_MOCK=0
ENV VITE_API_URL=$VITE_API_URL VITE_DEMO_TARGET_URL=$VITE_DEMO_TARGET_URL VITE_MOCK=$VITE_MOCK
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

