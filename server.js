require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. MƏXFİLİK VƏ TƏHLÜKƏSİZLİK (SECURITY MIDDLEWARES) ---
app.use(helmet()); // HTTP başlıqlarını qoruyur
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // İstehsalatda domen adı qeyd edilməlidir
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// DDoS və Bruteforce hücumlarına qarşı Sorğu Limitləri (Rate Limiting)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dəqiqə
  max: 100, // Hər IP üçün maks 100 sorğu
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Çox sayda sorğu gönderildi. Zəhmət olmasa bir az gözləyin.' }
});
app.use('/api/', limiter);

// Sorğu Gövdəsi (Body Parser) və Loglar
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Konsolda HTTP sorğularını izləmək üçün

// --- 2. SUPABASE DB İNİSİALİZASİYASI ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ XƏTA: Supabase URL və ya Service Role Key .env faylında tapılmadı!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// --- 3. HELPER FUNKSİYA: ASYNCHRONOUS ERROR HANDLER ---
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// --- 4. API ROUTE-LARI ---

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// A. Mağazaların Siyahısını Almaq (GET)
app.get('/api/stores', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('stores').select('*');
  if (error) throw error;
  
  res.status(200).json({ success: true, count: data.length, data });
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

// C. Məhsul Axtarışı və Süzgəcləmə (GET)
app.get('/api/products', asyncHandler(async (req, res) => {
  const { brand, model, search } = req.query;

  let query = supabase.from('products').select('*, stores(*)');

  if (brand) query = query.eq('brand', brand);
  if (model) query = query.eq('model', model);
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) throw error;

  res.status(200).json({ success: true, count: data.length, data });
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

// --- 5. 404 UNKNOWN ROUTE HANDLER ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Axtarılan API ünvanı tapılmadı.' });
});

// --- 6. QLOBAL XƏTA İDARƏETMƏSİ (GLOBAL ERROR HANDLER) ---
app.use((err, req, res, next) => {
  console.error('🔥 Server Xətası:', err.stack || err.message);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Daxili Server Xətası Baş Verdi',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// --- 7. SERVERİ BAŞLATMAQ ---
const server = app.listen(PORT, () => {
  console.log(`🚀 Peşəkar Server http://localhost:${PORT} ünvanında aktivdir!`);
});

// Unhandled Rejections (Gözlənilməyən xətaları yaxalamaq üçün)
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION! Server dayandırılır...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});