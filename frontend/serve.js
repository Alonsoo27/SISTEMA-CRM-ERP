import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Verificar que dist/ existe
const distPath = join(__dirname, 'dist');
if (!existsSync(distPath)) {
  console.error('❌ Error: dist/ folder not found!');
  process.exit(1);
}

// Servir archivos estáticos
app.use(express.static(distPath));

// Todas las rutas devuelven index.html para SPA
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend running on port ${PORT}`);
  console.log(`✅ Serving static files from: ${distPath}`);
});
