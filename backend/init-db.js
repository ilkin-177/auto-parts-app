const pool = require('./db');

const createTables = async () => {
  const queryText = `
    -- 1. İstifadəçilər
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      phone VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'buyer', -- 'buyer', 'vendor', 'admin'
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Mağazalar / Satıcılar
    CREATE TABLE IF NOT EXISTS vendors (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      store_name VARCHAR(100) NOT NULL,
      location_city VARCHAR(50),
      location_district VARCHAR(50),
      status VARCHAR(20) DEFAULT 'pending', -- 'active', 'inactive', 'pending'
      monthly_fee DECIMAL(10,2) DEFAULT 40.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Ehtiyat Hissələri (Məhsullar)
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
      title VARCHAR(150) NOT NULL,
      brand VARCHAR(50) NOT NULL,        -- Məsələn: BMW
      model VARCHAR(50) NOT NULL,        -- Məsələn: X5
      year INT NOT NULL,                 -- Məsələn: 2020
      oem_code VARCHAR(50),
      price DECIMAL(10,2) NOT NULL,
      condition VARCHAR(20) DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await pool.query(queryText);
    console.log("Cədvəllər tam şəkildə yeniləndi və yaratıldı!");
  } catch (err) {
    console.error("Xəta baş verdi:", err);
  } finally {
    pool.end();
  }
};

createTables();