FROM node:current-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install pm2 -g
RUN npm install

# Bundle app source
COPY . .

CMD [ "pm2-runtime", "manage_matrix_users.js" ]
