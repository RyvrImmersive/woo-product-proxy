const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const WC_BASE_URL = "https://enablemart.in/wp-json/wc/v3/products";
const WC_KEY = process.env.WC_KEY;
const WC_SECRET = process.env.WC_SECRET;

app.use(cors());

app.get("/api/products", async (req, res) => {
  const query = req.query.q || "";

  try {
    const response = await axios.get(WC_BASE_URL, {
      params: {
        search: query,
        per_page: 5
      },
      auth: {
        username: WC_KEY,
        password: WC_SECRET
      }
    });

    const results = response.data.map(p => ({
      name: p.name,
      permalink: p.permalink,
      description: p.short_description || p.description
    }));

    res.json(results);
  } catch (error) {
    console.error("WooCommerce API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 WooCommerce product proxy listening on port ${PORT}`);
});
