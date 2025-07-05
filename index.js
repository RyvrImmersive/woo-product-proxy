const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const WC_BASE_URL = "https://enablemart.in/wp-json/wc/v3/products";
const WC_KEY = process.env.WC_KEY;
const WC_SECRET = process.env.WC_SECRET;

// Security and middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
});

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
};

// Helper function to clean HTML from descriptions
const cleanHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
};

// Helper function to extract keywords from query
const extractKeywords = (query) => {
  const commonWords = ['for', 'with', 'and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'from', 'by', 'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must'];
  return query.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word))
    .join(' ');
};

// Enhanced product search with intelligent matching
const searchProducts = async (query, limit = 8) => {
  try {
    const keywords = extractKeywords(query);
    
    // First, try exact search
    let response = await axios.get(WC_BASE_URL, {
      params: {
        search: keywords || query,
        per_page: limit,
        status: 'publish'
      },
      auth: {
        username: WC_KEY,
        password: WC_SECRET
      }
    });

    let products = response.data;

    // If no results, try broader search with individual keywords
    if (products.length === 0 && keywords) {
      const keywordArray = keywords.split(' ');
      for (const keyword of keywordArray) {
        response = await axios.get(WC_BASE_URL, {
          params: {
            search: keyword,
            per_page: limit,
            status: 'publish'
          },
          auth: {
            username: WC_KEY,
            password: WC_SECRET
          }
        });
        if (response.data.length > 0) {
          products = response.data;
          break;
        }
      }
    }

    return products.map(product => ({
      id: product.id,
      name: cleanHtml(product.name),
      link: product.permalink,
      price: product.price_html ? cleanHtml(product.price_html) : 'Price not available',
      regularPrice: product.regular_price || null,
      salePrice: product.sale_price || null,
      description: cleanHtml(product.short_description || product.description).substring(0, 200) + '...',
      image: product.images && product.images[0] ? product.images[0].src : null,
      inStock: product.stock_status === 'instock',
      categories: product.categories ? product.categories.map(cat => cat.name).join(', ') : '',
      rating: product.average_rating || null,
      reviewCount: product.rating_count || 0
    }));
  } catch (error) {
    console.error('Product search error:', error.response?.data || error.message);
    throw error;
  }
};

// Generate intelligent response based on query and products
const generateAssistantResponse = (query, products) => {
  if (products.length === 0) {
    return {
      message: `I couldn't find any products matching "${query}". Try searching with different keywords or browse our categories.`,
      suggestions: [
        "Try using more general terms",
        "Check spelling of product names",
        "Browse by category instead"
      ]
    };
  }

  const responseMessages = [
    `I found ${products.length} product${products.length > 1 ? 's' : ''} for "${query}". Here are the best matches:`,
    `Great! I discovered ${products.length} relevant product${products.length > 1 ? 's' : ''} for your search "${query}":`,
    `Perfect! Here are ${products.length} product${products.length > 1 ? 's' : ''} that match "${query}":`
  ];

  const randomMessage = responseMessages[Math.floor(Math.random() * responseMessages.length)];

  // Generate helpful suggestions based on products found
  const categories = [...new Set(products.map(p => p.categories).filter(Boolean))];
  const suggestions = [];
  
  if (categories.length > 0) {
    suggestions.push(`Also check out: ${categories.slice(0, 3).join(', ')}`);
  }
  
  const inStockCount = products.filter(p => p.inStock).length;
  if (inStockCount < products.length) {
    suggestions.push(`${inStockCount} of these items are currently in stock`);
  }

  return {
    message: randomMessage,
    suggestions: suggestions.length > 0 ? suggestions : [
      "Need help choosing? Ask me about specific features!",
      "Want to see similar products? Let me know!"
    ]
  };
};

// Main routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Enhanced product search API
app.get('/api/search', rateLimitMiddleware, async (req, res) => {
  const query = req.query.q || req.query.query || '';
  const limit = Math.min(parseInt(req.query.limit) || 8, 20);

  if (!query.trim()) {
    return res.status(400).json({
      error: 'Please provide a search query',
      example: '/api/search?q=laptop'
    });
  }

  try {
    const products = await searchProducts(query, limit);
    const assistantResponse = generateAssistantResponse(query, products);

    res.json({
      query,
      assistant: assistantResponse,
      products,
      total: products.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Search API Error:', error.message);
    res.status(500).json({
      error: 'Failed to search products',
      message: 'Please try again later or contact support if the issue persists.'
    });
  }
});

// Conversational assistant endpoint
app.post('/api/assistant', rateLimitMiddleware, async (req, res) => {
  const { message, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Extract product search intent from message
    const searchQuery = message.toLowerCase()
      .replace(/^(find|search|show|get|i want|i need|looking for|help me find)\s+/i, '')
      .replace(/\?$/, '')
      .trim();

    const products = await searchProducts(searchQuery, 6);
    const assistantResponse = generateAssistantResponse(searchQuery, products);

    res.json({
      response: assistantResponse.message,
      suggestions: assistantResponse.suggestions,
      products: products.slice(0, 6), // Limit for conversational interface
      searchQuery,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Assistant API Error:', error.message);
    res.json({
      response: "I'm having trouble searching for products right now. Please try again in a moment!",
      suggestions: ["Try refreshing the page", "Check your internet connection"],
      products: []
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Legacy endpoint for backward compatibility
app.get('/api/products', rateLimitMiddleware, async (req, res) => {
  const query = req.query.q || '';
  
  try {
    const products = await searchProducts(query, 5);
    // Return in old format for compatibility
    const legacyFormat = products.map(p => ({
      name: p.name,
      permalink: p.link,
      description: p.description
    }));
    
    res.json(legacyFormat);
  } catch (error) {
    console.error('Legacy API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.listen(PORT, () => {
  console.log(`🤖 Intelligent Product Assistant running on port ${PORT}`);
  console.log(`🔍 Search API: http://localhost:${PORT}/api/search?q=your-query`);
  console.log(`💬 Assistant API: POST http://localhost:${PORT}/api/assistant`);
  console.log(`🌐 Web Interface: http://localhost:${PORT}`);
});
