const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Unikal Markaları Gətirən API (Axtarış menyusu üçün)
app.get('/api/brands', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT brand FROM products ORDER BY brand ASC');
    res.json(result.rows.map(row => row.brand));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Məhsul Əlavə Etmə API-si (Satıcı üçün)
app.post('/api/products', async (req, res) => {
  const { vendor_id, title, brand, model, oem_code, price, condition } = req.body;
  try {
    const newProduct = await pool.query(
      `INSERT INTO products (vendor_id, title, brand, model, oem_code, price, condition) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [vendor_id, title, brand, model, oem_code, price, condition]
    );
    res.json(newProduct.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Bütün Məhsulları və Axtarışı Gətirən API
app.get('/api/products', async (req, res) => {
  const { brand, search } = req.query;
  try {
    let query = 'SELECT * FROM products WHERE 1=1';
    let params = [];

    if (brand) {
      params.push(brand);
      query += ` AND LOWER(brand) = LOWER($${params.length})`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (LOWER(title) LIKE LOWER($${params.length}) OR LOWER(oem_code) LIKE LOWER($${params.length}))`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışır...`);
});