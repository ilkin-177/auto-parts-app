require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. TƏHLÜKƏSİZLİK VƏ MIDDLEWARE LƏR ---
app.use(helmet());
app.use(cors({
  origin: '*', // İstehsalat mühitində (Production) müəyyən domenlər yaza bilərsiniz
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting (DDoS və Spam qoruması)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dəqiqə
  max: 100, // Hər IP üçün maksimal 100 sorğu
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Çox sayda sorğu göndərildi. Zəhmət olmasa bir az gözləyin.' }
});
app.use('/api/', limiter);

// Body Parser və Logger
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// --- 2. SUPABASE DB MƏLUMATLARI ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ XƏTA: SUPABASE_URL və ya SUPABASE_SERVICE_ROLE_KEY .env faylında tapılmadı!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Async Error Handler Helper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- 3. API ENDPOINT-LƏRİ ---

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// A. Mağazaların Siyahısını Almaq (GET)
app.get('/api/stores', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('stores').select('*');
  if (error) throw error;
  
  res.status(200).json({ success: true, count: data ? data.length : 0, data });
}));

// B. Yeni Mağaza Yaratmaq (POST)
app.post('/api/stores', asyncHandler(async (req, res) => {
  const { store_name, person, location, phone, store_email, store_pass } = req.body;

  if (!store_name || !store_email || !store_pass) {
    return res.status(400).json({ 
      success: false, 
      message: 'Məcburi xanaları doldurun: store_name, store_email, store_pass' 
    });
  }

  const { data, error } = await supabase
    .from('stores')
    .insert([{ store_name, person, location, phone, store_email, store_pass }])
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, message: 'Mağaza uğurla yaradıldı', data });
}));

// C. Məhsulları Əlaqəli Mağaza Məlumatları ilə Birlikdə Almaq (GET)
app.get('/api/products', asyncHandler(async (req, res) => {
  const { brand, model, search } = req.query;

  // Foreign Key ilişgisi olmama ehtimalına qarşı məhsul və mağazaları ayrı çəkib birləşdiririk
  let query = supabase.from('products').select('*');

  if (brand) query = query.eq('brand', brand);
  if (model) query = query.eq('model', model);
  if (search) query = query.ilike('name', `%${search}%`);

  const { data: products, error: prodError } = await query;
  if (prodError) throw prodError;

  const { data: stores, error: storeError } = await supabase.from('stores').select('*');
  if (storeError) throw storeError;

  // Mağazaları Map şəklində rahat tapılsın deyə saxlayırıq
  const storeMap = {};
  if (stores) {
    stores.forEach(s => { storeMap[s.id] = s; });
  }

  // Məhsullara mağaza məlumatını qoşuruq
  const fullProducts = (products || []).map(p => ({
    ...p,
    stores: storeMap[p.store_id] || null
  }));

  res.status(200).json({ success: true, count: fullProducts.length, data: fullProducts });
}));

// D. Yeni Sifariş Yaratmaq (POST)
app.post('/api/orders', asyncHandler(async (req, res) => {
  const { orders } = req.body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ success: false, message: 'Sifariş məlumatları düzgün göndərilməyib.' });
  }

  const { data, error } = await supabase
    .from('orders')
    .insert(orders)
    .select();

  if (error) throw error;

  res.status(201).json({ success: true, message: 'Sifarişlər uğurla qeydə alındı', data });
}));

// --- 4. XƏTA İDARƏETMƏSİ (ERROR HANDLING) ---

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Axtarılan API ünvanı tapılmadı.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Xətası:', err.stack || err.message);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Daxili Server Xətası Baş Verdi',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// --- 5. SERVERİ İŞƏ SALMAQ ---
const server = app.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} ünvanında aktivdir!`);
});

// Process Level Exceptions
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION! Server dayandırılır...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});