# 🤖 Intelligent WooCommerce Product Assistant

An AI-powered Express.js server that transforms your WooCommerce store into an intelligent product assistant with conversational search capabilities.

## ✨ Features

- **Intelligent Product Search**: Advanced keyword extraction and matching
- **Conversational Interface**: Natural language product queries
- **Enhanced Product Data**: Prices, images, stock status, ratings, and categories
- **Rate Limiting**: Built-in protection against abuse
- **Security**: Helmet.js security headers and input sanitization
- **Responsive Chatbot**: Beautiful, mobile-friendly chat interface
- **Multiple API Endpoints**: RESTful and conversational interfaces
- **Fallback Support**: Graceful degradation for reliability

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

## 🔌 API Endpoints

### GET /api/search (Recommended)

Intelligent product search with enhanced responses.

**Query Parameters:**
- `q` or `query` (required): Search query string
- `limit` (optional): Number of results (max 20, default 8)

**Example:**
```bash
GET /api/search?q=wheelchair&limit=5
```

**Response:**
```json
{
  "query": "wheelchair",
  "assistant": {
    "message": "I found 5 products for 'wheelchair'. Here are the best matches:",
    "suggestions": ["Also check out: Mobility Aids", "3 of these items are currently in stock"]
  },
  "products": [
    {
      "id": 123,
      "name": "Electric Wheelchair",
      "link": "https://store.com/electric-wheelchair",
      "price": "$1,299.00",
      "regularPrice": "1299",
      "salePrice": null,
      "description": "High-quality electric wheelchair with...",
      "image": "https://store.com/image.jpg",
      "inStock": true,
      "categories": "Mobility Aids, Wheelchairs",
      "rating": "4.5",
      "reviewCount": 23
    }
  ],
  "total": 5,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### POST /api/assistant

Conversational interface for natural language queries.

**Request Body:**
```json
{
  "message": "I need a hearing aid for my grandmother",
  "context": {} // Optional context object
}
```

**Response:**
```json
{
  "response": "I found several hearing aids perfect for your grandmother!",
  "suggestions": ["Need help choosing?", "Want to see similar products?"],
  "products": [...],
  "searchQuery": "hearing aid",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### GET /api/products (Legacy)

Backward-compatible endpoint with simplified response format.

**Query Parameters:**
- `q` (optional): Search query string

**Example:**
```bash
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

### GET /api/health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600
}
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `WC_KEY`: WooCommerce Consumer Key
- `WC_SECRET`: WooCommerce Consumer Secret

## 💬 Chatbot Integration

The project includes a beautiful, responsive chatbot that can be easily integrated into any website.

### WordPress Integration

1. Copy the code from `enhanced-chatbot.html`
2. Paste it into your WordPress theme's footer (Appearance > Theme Editor > footer.php)
3. Or add it via a custom HTML widget in your footer
4. Update the `API_BASE_URL` to point to your deployed server

### Features of the Enhanced Chatbot

- 🎨 **Modern Design**: Beautiful gradient UI with smooth animations
- 📱 **Mobile Responsive**: Works perfectly on all device sizes
- 🔍 **Intelligent Search**: Uses advanced keyword extraction
- 💬 **Conversational**: Natural language understanding
- ⚡ **Fast**: Optimized API calls with fallback support
- 🔒 **Secure**: XSS protection and input sanitization
- 📊 **Analytics Ready**: Easy to track user interactions

### Customization

You can easily customize the chatbot by modifying:
- Colors and gradients in the CSS
- Welcome message and personality
- API endpoints and response formatting
- Suggestion chips and quick replies

## 🚀 Deployment

This application can be deployed to any Node.js hosting platform:

### Recommended Platforms
- **Render** (Free tier available)
- **Railway** (Great for Node.js)
- **Heroku** (Classic choice)
- **Vercel** (Serverless functions)
- **DigitalOcean App Platform**

### Environment Variables
Make sure to set the required environment variables in your deployment platform:
- `WC_KEY`: Your WooCommerce Consumer Key
- `WC_SECRET`: Your WooCommerce Consumer Secret
- `PORT`: Server port (automatically set by most platforms)
