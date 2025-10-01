# 🚀 Guía de Deployment a Railway

## 📋 Pre-requisitos

1. ✅ Cuenta en [Railway.app](https://railway.app)
2. ✅ Repositorio en GitHub
3. ✅ Base de datos Supabase funcionando

---

## 🎯 Pasos para Deploy

### 1️⃣ Preparar tu Repositorio GitHub

```bash
# Si aún no has inicializado git
git init
git add .
git commit -m "Initial commit - Sistema CRM/ERP listo para producción"

# Crear repositorio en GitHub y conectarlo
git remote add origin https://github.com/TU_USUARIO/SISTEMA-CRM-ERP.git
git branch -M main
git push -u origin main
```

### 2️⃣ Crear Proyecto en Railway

1. Ve a [Railway.app](https://railway.app)
2. Click en **"Start a New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza Railway a acceder a tu GitHub
5. Selecciona tu repositorio `SISTEMA-CRM-ERP`

### 3️⃣ Configurar Backend en Railway

Railway detectará automáticamente que tienes 2 carpetas (backend/frontend).

**Para el BACKEND:**

1. Click en el servicio del backend
2. Ve a **Settings** → **Root Directory** → Cambia a `backend`
3. Ve a **Variables** → **+ New Variable**
4. Agrega estas variables (copia de tu `.env` local):

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres.wwssvdnjwvtqxnwyjkdb:TU_PASSWORD@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://wwssvdnjwvtqxnwyjkdb.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_KEY=tu_service_key
JWT_SECRET=cambia_esto_por_algo_muy_seguro_en_produccion
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12
BYPASS_SCHEDULE_VALIDATION=false
```

5. **IMPORTANTE:** Railway te dará una URL del backend. Cópiala (ej: `https://tu-backend.railway.app`)

### 4️⃣ Configurar Frontend en Railway

1. Click en **"+ New"** → **"Empty Service"**
2. Conecta el mismo repositorio GitHub
3. Ve a **Settings** → **Root Directory** → Cambia a `frontend`
4. Ve a **Variables** → **+ New Variable**
5. Agrega estas variables:

```env
VITE_API_URL=https://tu-backend.railway.app
VITE_SUPABASE_URL=https://wwssvdnjwvtqxnwyjkdb.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

### 5️⃣ Actualizar CORS en Backend

Después del primer deploy, Railway te dará la URL del frontend (ej: `https://tu-frontend.railway.app`)

1. Regresa a las **Variables del Backend**
2. Agrega una nueva variable:

```env
FRONTEND_URL=https://tu-frontend.railway.app
```

3. Railway redesplegará automáticamente

### 6️⃣ Verificar Deployment

1. Espera a que ambos servicios terminen de desplegarse (se pondrán en verde ✅)
2. Click en la URL del frontend
3. Deberías ver tu sistema funcionando

---

## 🔧 Solución de Problemas Comunes

### ❌ Error de CORS

**Síntoma:** Frontend no puede conectar con backend

**Solución:**
1. Verifica que `FRONTEND_URL` en el backend tenga la URL correcta
2. Verifica que `VITE_API_URL` en el frontend tenga la URL del backend
3. No incluyas `/api` al final de `VITE_API_URL`

### ❌ Error de Base de Datos

**Síntoma:** "Cannot connect to database"

**Solución:**
1. Verifica que `DATABASE_URL` esté correcta
2. Ve a Supabase → Settings → Database
3. Asegúrate de usar el **Connection Pooling** URL (puerto 6543)

### ❌ 404 Not Found en rutas del frontend

**Síntoma:** Al recargar la página da 404

**Solución:**
1. Agrega en el frontend un archivo `public/_redirects` con:
```
/*    /index.html   200
```

---

## 🔄 Actualizar tu App (después del deploy inicial)

Cada vez que hagas cambios:

```bash
git add .
git commit -m "Descripción de tus cambios"
git push
```

Railway detectará automáticamente los cambios y redesplegará.

---

## 📊 Monitorear tu App

1. **Logs:** Railway Dashboard → Tu servicio → **Logs** (ver errores en tiempo real)
2. **Métricas:** Railway Dashboard → Tu servicio → **Metrics** (CPU, RAM, requests)
3. **Deployments:** Railway Dashboard → Tu servicio → **Deployments** (historial)

---

## 💡 Tips Importantes

1. ✅ **Cambia tu JWT_SECRET en producción** - No uses el mismo que en desarrollo
2. ✅ **Activa el modo producción** - `NODE_ENV=production`
3. ✅ **Revisa los logs regularmente** - Para detectar problemas temprano
4. ✅ **Configura custom domain** (opcional) - Settings → Domains en Railway

---

## 🆘 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa los **Logs** en Railway
2. Verifica que todas las **Variables de Entorno** estén correctas
3. Asegúrate de que la base de datos Supabase esté accesible

¡Listo! Tu sistema debería estar funcionando en producción 🎉
