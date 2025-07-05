# WooCommerce Product Proxy

A simple Express.js proxy server for WooCommerce product search API.

## Features

- CORS-enabled API endpoint for product search
- Simplified product data response
- Environment variable configuration
- Error handling and logging

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
export WC_KEY=your_woocommerce_consumer_key
export WC_SECRET=your_woocommerce_consumer_secret
```

3. Start the server:
```bash
npm start
```

## API Endpoints

### GET /api/products

Search for products from the WooCommerce store.

**Query Parameters:**
- `q` (optional): Search query string

**Example:**
```
GET /api/products?q=laptop
```

**Response:**
```json
[
  {
    "name": "Product Name",
    "permalink": "https://store.com/product-url",
    "description": "Product description"
  }
]
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `WC_KEY`: WooCommerce Consumer Key
- `WC_SECRET`: WooCommerce Consumer Secret

## Deployment

This application can be deployed to any Node.js hosting platform like Heroku, Vercel, or Railway.

Make sure to set the required environment variables in your deployment platform.
