# Chunk Backend - Node.js API

## Overview
This is the backend API for Chunk, a junk removal marketplace built with Node.js, Express, and PostgreSQL.

## Tech Stack
- Node.js 18+
- Express.js
- PostgreSQL with Sequelize ORM
- Socket.IO for real-time features
- Stripe for payments
- JWT authentication
- Multer for file uploads
- AWS S3 for storage

## Project Structure
```
src/
├── config/           # Database and app configuration
├── controllers/      # Request handlers
├── middleware/       # Auth, validation, error handling
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Helper functions
└── app.js           # Express app
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (for caching)
- AWS S3 bucket
- Stripe account

### Installation
```bash
npm install
```

### Database Setup
```bash
npm run db:migrate
npm run db:seed
```

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Environment Variables
Create `.env` file:


NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chunk_db
DB_USER=postgres
DB_PASSWORD=password
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=chunk-media
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
GOOGLE_MAPS_API_KEY=your_google_maps_key
REDIS_URL=redis://localhost:6379
```

## API Documentation
- Swagger UI: `http://localhost:3000/api/docs`
- Postman collection available in `/docs` folder

## Testing
```bash
npm test
```