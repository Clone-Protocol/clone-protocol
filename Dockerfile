# Use an official Node.js 17 runtime as a parent image
FROM node:17

# Install ts-node globally so we can run our TypeScript file
RUN npm install -g ts-node

# Copy package.json and package-lock.json into the working directory
COPY package.json ./

# Install any dependencies this involves copying both package.json and package-lock.json
RUN npm install --legacy-peer-deps

# Copy the sdk and scripts directories into the working directory
COPY sdk/ ./sdk/
COPY scripts/ ./scripts/

# Use environment variables
ARG ANCHOR_WALLET
ENV ANCHOR_WALLET=$ANCHOR_WALLET

ARG ANCHOR_PROVIDER_URL
ENV ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL

ARG INCEPT_PROGRAM_ID
ENV INCEPT_PROGRAM_ID=$INCEPT_PROGRAM_ID

ARG COMET_MANAGER_PROGRAM_ID
ENV COMET_MANAGER_PROGRAM_ID=$COMET_MANAGER_PROGRAM_ID

ARG JUPITER_PROGRAM_ID
ENV JUPITER_PROGRAM_ID=$JUPITER_PROGRAM_ID

ARG LOOKUP_TABLE_ADDRESS
ENV LOOKUP_TABLE_ADDRESS=$LOOKUP_TABLE_ADDRESS

ARG PCT_THRESHOLD
ENV PCT_THRESHOLD=$PCT_THRESHOLD

# Define the command to run the app using ts-node
CMD ["node -r", "ts-node/register", "scripts/comet_manager/pool_recentering.ts"]
