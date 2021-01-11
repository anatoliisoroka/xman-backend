FROM node:alpine
WORKDIR /app
COPY . ./
EXPOSE 2048
RUN apk --no-cache add g++ gcc libgcc libstdc++ linux-headers make python
RUN npm config set unsafe-perm true
RUN npm install --quiet node-gyp -g
RUN npm install
CMD ["npm", "run", "start"]