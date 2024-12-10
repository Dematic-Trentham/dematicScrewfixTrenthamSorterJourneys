FROM node:18-alpine AS base

# Stage 1: Builder
FROM base AS builder

# Set the working directory
WORKDIR /app

RUN apk add --no-cache git

# Copy package.json and package-lock.json
COPY package.json ./

# Install dependencies
RUN npm install --legacy-peer-deps
RUN npm install -g typescript

# Install OpenSSL
RUN apk add --no-cache openssl


# Copy the rest of the application
COPY . .

RUN npm run prisma-merge

# Build the application
RUN npm run buildOnce
RUN npm run packageJsonStripper
RUN ls -l

# Stage 2: Production image
FROM base AS production

# Install OpenSSL
RUN apk add --no-cache openssl


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