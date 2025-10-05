import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

// URL del backend (Railway o localhost)
const BACKEND_URL = process.env.VITE_API_URL || 'http://localhost:3001';

console.log('🚀 Starting server...');
console.log('📍 Port:', PORT);
console.log('🔗 Backend URL:', BACKEND_URL);
console.log('📂 Working directory:', __dirname);

// Health check - debe ser lo primero
app.get('/health', (req, res) => {
  console.log('✅ Health check received');
  res.status(200).json({ status: 'ok', port: PORT, backend: BACKEND_URL });
});

// Verificar que dist/ existe
const distPath = join(__dirname, 'dist');
console.log('🔍 Checking dist path:', distPath);

if (!existsSync(distPath)) {
  console.error('❌ Error: dist/ folder not found at:', distPath);
  process.exit(1);
}

console.log('✅ dist/ folder found');

// Servir archivos estáticos con logs
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

app.use(express.static(distPath));

// Proxy para requests a /api/* → redirigir al backend
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  logLevel: 'info',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxying: ${req.method} ${req.path} → ${BACKEND_URL}${req.path}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err.message);
    res.status(500).json({ error: 'Backend proxy error', details: err.message });
  }
}));

// Todas las rutas NO-API devuelven index.html para SPA
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  console.log('📄 Serving index.html from:', indexPath);
  res.sendFile(indexPath);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on 0.0.0.0:${PORT}`);
  console.log(`✅ Serving static files from: ${distPath}`);
  console.log('🎯 Ready to accept connections');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});
