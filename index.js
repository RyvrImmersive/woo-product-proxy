const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");

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

// Simple rate limiting placeholder (removed for deployment compatibility)
const rateLimitMiddleware = (req, res, next) => {
  // Rate limiting temporarily disabled for deployment
  next();
};

// Helper function to clean HTML from descriptions
const cleanHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
};

// Helper function to extract keywords from user query
const extractKeywords = (query) => {
  const commonWords = ['for', 'with', 'and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'from', 'by', 'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'need', 'want', 'looking', 'show', 'find', 'get', 'buy'];
  
  // Extract meaningful keywords
  const keywords = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word))
    .filter(word => word.trim() !== '');
    
  return keywords;
};

// Helper function to clean HTML content
const cleanHtmlContent = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

// Advanced relevance scoring function
const calculateRelevance = (product, queryKeywords, originalQuery) => {
  let score = 0;
  const title = (product.name || '').toLowerCase();
  const shortDesc = cleanHtmlContent(product.short_description || '').toLowerCase();
  const fullDesc = cleanHtmlContent(product.description || '').toLowerCase();
  const categories = (product.categories || []).map(cat => cat.name.toLowerCase()).join(' ');
  const tags = (product.tags && Array.isArray(product.tags)) ? product.tags.map(tag => (tag.name || '').toLowerCase()).join(' ') : '';
  
  const queryLower = originalQuery.toLowerCase();
  
  // EXACT PHRASE MATCHING (Balanced across fields)
  if (title.includes(queryLower)) score += 60;
  if (shortDesc.includes(queryLower)) score += 55;
  if (fullDesc.includes(queryLower)) score += 50;
  if (categories.includes(queryLower)) score += 45;
  if (tags.includes(queryLower)) score += 45;
  
  // INDIVIDUAL KEYWORD MATCHING (Balanced weights)
  queryKeywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    
    // Word boundary matching (exact word matches get bonus)
    const titleWordMatch = new RegExp(`\\b${keywordLower}\\b`).test(title);
    const shortDescWordMatch = new RegExp(`\\b${keywordLower}\\b`).test(shortDesc);
    const fullDescWordMatch = new RegExp(`\\b${keywordLower}\\b`).test(fullDesc);
    const categoriesWordMatch = new RegExp(`\\b${keywordLower}\\b`).test(categories);
    const tagsWordMatch = new RegExp(`\\b${keywordLower}\\b`).test(tags);
    
    // Balanced scoring across all fields
    if (titleWordMatch) score += 25;
    else if (title.includes(keywordLower)) score += 15;
    
    if (shortDescWordMatch) score += 22;
    else if (shortDesc.includes(keywordLower)) score += 12;
    
    if (fullDescWordMatch) score += 15;
    else if (fullDesc.includes(keywordLower)) score += 8;
    
    if (categoriesWordMatch) score += 20;
    else if (categories.includes(keywordLower)) score += 10;
    
    if (tagsWordMatch) score += 20;
    else if (tags.includes(keywordLower)) score += 10;
  });
  
  // COVERAGE BONUS: Reward products that match across multiple field types
  const fieldMatches = [
    title.includes(queryLower) || queryKeywords.some(k => title.includes(k.toLowerCase())),
    shortDesc.includes(queryLower) || queryKeywords.some(k => shortDesc.includes(k.toLowerCase())),
    fullDesc.includes(queryLower) || queryKeywords.some(k => fullDesc.includes(k.toLowerCase())),
    categories.includes(queryLower) || queryKeywords.some(k => categories.includes(k.toLowerCase())),
    tags.includes(queryLower) || queryKeywords.some(k => tags.includes(k.toLowerCase()))
  ].filter(Boolean).length;
  
  if (fieldMatches >= 3) score += 15;
  else if (fieldMatches >= 2) score += 8;
  
  // KEYWORD DENSITY BONUS
  const allText = `${title} ${shortDesc} ${fullDesc} ${categories} ${tags}`;
  const totalKeywordMatches = queryKeywords.reduce((count, keyword) => {
    const regex = new RegExp(keyword.toLowerCase(), 'gi');
    const matches = allText.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
  
  if (totalKeywordMatches > queryKeywords.length) {
    score += Math.min(totalKeywordMatches * 2, 20);
  }
  
  return Math.round(score);
};

// Enhanced product search with intelligent matching
const searchProducts = async (query, limit = 10) => {
  try {
    const keywords = extractKeywords(query);
    console.log('Search query:', query);
    console.log('Extracted keywords:', keywords);
    
    let allProducts = [];
    
    // STRATEGY 1: Search with full query (WooCommerce relevance)
    try {
      const response1 = await axios.get(WC_BASE_URL, {
        params: {
          search: query,
          per_page: 60,
          status: 'publish',
          orderby: 'relevance'
        },
        auth: {
          username: WC_KEY,
          password: WC_SECRET
        }
      });
      allProducts = [...allProducts, ...response1.data];
      console.log(`Strategy 1: Found ${response1.data.length} products with full query`);
    } catch (error) {
      console.log('Strategy 1 failed:', error.message);
    }
    
    // STRATEGY 2: Search with combined keywords
    if (keywords.length > 0) {
      try {
        const combinedKeywords = keywords.join(' ');
        const response2 = await axios.get(WC_BASE_URL, {
          params: {
            search: combinedKeywords,
            per_page: 40,
            status: 'publish',
            orderby: 'relevance'
          },
          auth: {
            username: WC_KEY,
            password: WC_SECRET
          }
        });
        allProducts = [...allProducts, ...response2.data];
        console.log(`Strategy 2: Found ${response2.data.length} products with combined keywords`);
      } catch (error) {
        console.log('Strategy 2 failed:', error.message);
      }
    }
    
    // STRATEGY 3: Search with individual keywords (top 3)
    const topKeywords = keywords.slice(0, 3);
    for (const keyword of topKeywords) {
      try {
        const response3 = await axios.get(WC_BASE_URL, {
          params: {
            search: keyword,
            per_page: 25,
            status: 'publish',
            orderby: 'relevance'
          },
          auth: {
            username: WC_KEY,
            password: WC_SECRET
          }
        });
        allProducts = [...allProducts, ...response3.data];
        console.log(`Strategy 3: Found ${response3.data.length} products for keyword "${keyword}"`);
      } catch (error) {
        console.log(`Strategy 3 failed for "${keyword}":`, error.message);
      }
    }
    
    // Remove duplicates by product ID
    const uniqueProducts = allProducts.filter((product, index, self) => 
      index === self.findIndex(p => p.id === product.id)
    );
    
    console.log(`Total unique products found: ${uniqueProducts.length}`);
    
    // Calculate relevance scores
    const scoredProducts = uniqueProducts.map(product => ({
      ...product,
      relevanceScore: calculateRelevance(product, keywords, query)
    }));
    
    // Enhanced filtering and sorting by relevance
    console.log(`Debug: Found ${scoredProducts.length} products before filtering`);
    if (scoredProducts.length > 0) {
      console.log(`Debug: Score range: ${Math.min(...scoredProducts.map(p => p.relevanceScore))} - ${Math.max(...scoredProducts.map(p => p.relevanceScore))}`);
    }
    
    const sortedProducts = scoredProducts
      .filter(product => {
        // Intelligent relevance threshold
        const minScore = keywords.length > 3 ? 8 : 5;
        const passes = product.relevanceScore >= minScore;
        if (!passes && scoredProducts.length < 10) {
          console.log(`Debug: Product "${product.name}" scored ${product.relevanceScore}, threshold: ${minScore}`);
        }
        return passes;
      })
      .sort((a, b) => {
        // Primary sort: relevance score
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Secondary sort: prefer products with images
        const aHasImage = a.images && a.images.length > 0 ? 1 : 0;
        const bHasImage = b.images && b.images.length > 0 ? 1 : 0;
        if (bHasImage !== aHasImage) {
          return bHasImage - aHasImage;
        }
        // Tertiary sort: prefer in-stock products
        const aInStock = a.stock_status === 'instock' ? 1 : 0;
        const bInStock = b.stock_status === 'instock' ? 1 : 0;
        return bInStock - aInStock;
      })
      .slice(0, limit);

    // Fallback: if no products pass relevance filter, return top unique products anyway
    const finalProducts = sortedProducts.length > 0 ? sortedProducts : uniqueProducts.slice(0, Math.min(limit, 3));
    console.log(`Debug: Returning ${finalProducts.length} products`);

    return finalProducts.map(product => {
      const shortDesc = cleanHtmlContent(product.short_description || '');
      const fullDesc = cleanHtmlContent(product.description || '');
      
      return {
        id: product.id,
        name: product.name,
        price: product.price_html || `₹${product.price}`,
        regularPrice: product.regular_price,
        salePrice: product.sale_price || null,
        // Prioritize short description, fallback to full description
        description: shortDesc ? 
          (shortDesc.length > 200 ? shortDesc.substring(0, 200) + '...' : shortDesc) :
          (fullDesc.length > 200 ? fullDesc.substring(0, 200) + '...' : fullDesc),
        shortDescription: shortDesc,
        image: product.images && product.images[0] ? product.images[0].src : null,
        inStock: product.stock_status === 'instock',
        categories: product.categories ? product.categories.map(cat => cat.name).join(', ') : '',
        rating: product.average_rating || null,
        reviewCount: product.rating_count || 0,
        relevanceScore: product.relevanceScore // For debugging/optimization
      };
    });
  } catch (error) {
    console.error('🚨 Product search error details:');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Error Data:', error.response?.data);
    console.error('Request URL:', error.config?.url);
    console.error('Auth Used:', !!error.config?.auth);
    console.error('Full Error:', error.message);
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
