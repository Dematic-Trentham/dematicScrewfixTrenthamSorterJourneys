FROM node:20-slim AS base

# Stage 1: Builder
FROM base AS builder

# Set the working directory
WORKDIR /app

#RUN apt-get update && apt-get install --no-cache git git --virtual .gyp python3 make g++
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package.json ./

RUN npm install --verbose

# Install dependencies
RUN npm install --legacy-peer-deps
RUN npm install -g typescript

# Install OpenSSL
#RUN apt-get update && apt-get install --no-cache openssl git --virtual .gyp python3 make g++
RUN apt-get update && apt-get install -y \
openssl \
    git \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y git openssh-client


# Copy the rest of the application
COPY . .

#from /tools/masterPrismaSchema copy the prisma folder to /node_modules/masterPrismaSchema
COPY ./tools/masterPrismaSchema ./node_modules/masterPrismaSchema

#show files in the /node_modules/masterPrismaSchema/
RUN ls -l ./node_modules/masterPrismaSchema/



RUN npm run prisma-merge

# Build the application
RUN npm run buildOnce
RUN npm run packageJsonStripper
RUN ls -l

# Stage 2: Production image
FROM base AS production

# Install OpenSSL
#RUN apt-get update && apt-get install --no-cache openssl git --virtual .gyp python3 make g++
RUN apt-get update && apt-get install -y \
openssl \
    git \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*


# Set the working directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=builder /app/build ./build

# Copy package.json and package-lock.json
COPY --from=builder /app/packageProduction.json ./package.json

RUN ls -l

# Install only production dependencies
RUN npm install

# Copy the Prisma client from the builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# set the memory limit to  3gb and run the application
CMD ["node", "--max-old-space-size=5072", "build/index.js"]