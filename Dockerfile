# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/

# Create uploads directory
RUN mkdir -p uploads && chmod 755 uploads

# Install FFmpeg for video processing
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    vips-dev

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "src/app.js"]