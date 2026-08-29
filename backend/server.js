const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

/* =======================================================
   1. DİNAMİK AXTARIŞ VƏ FİLTER APİ-LƏRİ (Əsas səhifə üçün)
   ======================================================= */

// Bazadakı unikal markaları gətirir
app.get('/api/filters/brands', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT brand FROM products ORDER BY brand ASC');
    res.json(result.rows.map(row => row.brand));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seçilmiş markaya uyğun unikal modelləri gətirir
app.get('/api/filters/models', async (req, res) => {
  const { brand } = req.query;
  try {
    const result = await pool.query(
      'SELECT DISTINCT model FROM products WHERE LOWER(brand) = LOWER($1) ORDER BY model ASC',
      [brand]
    );
    res.json(result.rows.map(row => row.model));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Məhsul Əlavə Etmək (Satıcı tərəfi)
app.post('/api/products', async (req, res) => {
  const { vendor_id, title, brand, model, year, oem_code, price, condition } = req.body;
  try {
    const newProduct = await pool.query(
      `INSERT INTO products (vendor_id, title, brand, model, year, oem_code, price, condition) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [vendor_id, title, brand, model, year, oem_code, price, condition]
    );
    res.json(newProduct.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* =======================================================
   2. SUPER ADMİN İDARƏETMƏ APİ-LƏRİ (Admin paneli üçün)
   ======================================================= */

// Bütün mağazaları və statuslarını gətirir
app.get('/api/admin/vendors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.id, v.store_name, v.location_city, v.status, v.monthly_fee, u.full_name, u.email, u.phone 
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      ORDER BY v.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mağazanı aktiv və ya deaktiv etmək (Status Yeniləmə)
app.patch('/api/admin/vendors/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'active', 'inactive', 'pending'

  try {
    const updatedVendor = await pool.query(
      'UPDATE vendors SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    res.json({ message: "Mağaza statusu yeniləndi", vendor: updatedVendor.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışır...`);
});
// Yeni Mağaza Yaratmaq (Admin tərəfindən)
app.post('/api/admin/vendors', async (req, res) => {
  const { store_name, location_city, monthly_fee, status } = req.body;
  try {
    // Əvvəlcə dummy user id təyin edirik və ya mağaza yaradırıq
    const newVendor = await pool.query(
      `INSERT INTO vendors (store_name, location_city, monthly_fee, status) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [store_name, location_city, monthly_fee || 40.00, status || 'active']
    );
    res.json(newVendor.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
