# 📊 QUERIES PARA INVESTIGAR BASE DE DATOS - SUPABASE

Estas queries te ayudarán a entender la estructura de las tablas y los datos para corregir los reportes.

---

## 1️⃣ **ESTRUCTURA DE LA TABLA `actividades_marketing`**

### Query 1.1: Ver estructura completa de la tabla
```sql
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'actividades_marketing'
ORDER BY ordinal_position;
```

**Copia y pega en Supabase SQL Editor para ver:**
- Nombres exactos de columnas
- Tipos de datos
- Valores por defecto
- Si permiten NULL

---

### Query 1.2: Ver índices y claves
```sql
SELECT
    i.relname as index_name,
    a.attname as column_name,
    ix.indisunique as is_unique,
    ix.indisprimary as is_primary
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relname = 'actividades_marketing'
ORDER BY i.relname, a.attnum;
```

**Para confirmar:**
- Qué columnas son índices
- Cuál es la clave primaria

---

## 2️⃣ **DATOS DE MUESTRA**

### Query 2.1: Ver 5 actividades de ejemplo con TODAS las columnas
```sql
SELECT *
FROM actividades_marketing
WHERE activo = true
LIMIT 5;
```

**Para entender:**
- Formato de fechas
- Estados disponibles
- Categorías existentes
- Si hay valores NULL

---

### Query 2.2: Ver estados únicos y su conteo
```sql
SELECT
    estado,
    COUNT(*) as cantidad,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje
FROM actividades_marketing
WHERE activo = true
GROUP BY estado
ORDER BY cantidad DESC;
```

**Para confirmar:**
- Valores exactos del campo `estado`
- Distribución de estados

---

### Query 2.3: Ver categorías únicas
```sql
SELECT
    categoria_principal,
    subcategoria,
    COUNT(*) as cantidad_actividades
FROM actividades_marketing
WHERE activo = true
GROUP BY categoria_principal, subcategoria
ORDER BY cantidad_actividades DESC;
```

**Para confirmar:**
- Qué categorías existen
- Por qué "SISTEMA - INACTIVO" aparece tanto

---

## 3️⃣ **ANÁLISIS DE FECHAS**

### Query 3.1: Ver columnas de fechas disponibles
```sql
SELECT
    id,
    created_at,
    fecha_inicio_planeada,
    fecha_fin_planeada,
    fecha_inicio_real,
    fecha_fin_real,
    estado,
    categoria_principal
FROM actividades_marketing
WHERE activo = true
ORDER BY created_at DESC
LIMIT 10;
```

**Para confirmar:**
- Qué columnas de fecha existen
- Diferencia entre `created_at` y `fecha_inicio_planeada`
- Si existen `fecha_inicio_real` y `fecha_fin_real`

---

### Query 3.2: Comparar created_at vs fecha_inicio_planeada
```sql
SELECT
    id,
    codigo,
    created_at::date as fecha_creacion,
    fecha_inicio_planeada::date as fecha_planeada,
    (fecha_inicio_planeada::date - created_at::date) as dias_diferencia,
    estado,
    categoria_principal
FROM actividades_marketing
WHERE activo = true
AND created_at IS NOT NULL
AND fecha_inicio_planeada IS NOT NULL
ORDER BY dias_diferencia DESC
LIMIT 20;
```

**Para confirmar:**
- Si hay diferencia entre cuándo se creó y cuándo está planeada
- Si el filtro actual por `created_at` es correcto

---

## 4️⃣ **ANÁLISIS DE TIEMPO**

### Query 4.1: Ver columnas de duración
```sql
SELECT
    id,
    codigo,
    estado,
    duracion_planeada_minutos,
    duracion_real_minutos,
    tiempo_adicional_minutos,
    categoria_principal,
    subcategoria
FROM actividades_marketing
WHERE activo = true
ORDER BY id DESC
LIMIT 20;
```

**Para confirmar:**
- Nombres exactos de columnas de tiempo
- Qué actividades tienen `duracion_real_minutos`
- Si actividades pendientes tienen tiempo real

---

### Query 4.2: Análisis de actividades con tiempo real vs sin tiempo real
```sql
SELECT
    estado,
    COUNT(*) as total_actividades,
    COUNT(duracion_real_minutos) as con_tiempo_real,
    SUM(duracion_planeada_minutos) as tiempo_planeado_total,
    SUM(duracion_real_minutos) as tiempo_real_total
FROM actividades_marketing
WHERE activo = true
GROUP BY estado
ORDER BY total_actividades DESC;
```

**Para confirmar:**
- Qué estados tienen `duracion_real_minutos`
- Si el bug es que se suma tiempo planeado de actividades no completadas

---

## 5️⃣ **INVESTIGAR EL BUG DE "SISTEMA - INACTIVO"**

### Query 5.1: Actividades SISTEMA por estado
```sql
SELECT
    categoria_principal,
    subcategoria,
    estado,
    COUNT(*) as cantidad,
    SUM(duracion_planeada_minutos) as tiempo_planeado,
    SUM(duracion_real_minutos) as tiempo_real,
    SUM(COALESCE(duracion_real_minutos, duracion_planeada_minutos)) as tiempo_calculado_bug
FROM actividades_marketing
WHERE activo = true
AND categoria_principal = 'SISTEMA'
GROUP BY categoria_principal, subcategoria, estado
ORDER BY cantidad DESC;
```

**Para confirmar:**
- Cuántas actividades SISTEMA están pendientes/canceladas
- Por qué se suma tanto tiempo de SISTEMA (el bug de COALESCE)

---

### Query 5.2: Comparar queries ANTIGUA vs CORREGIDA
```sql
-- QUERY ANTIGUA (con bug)
SELECT
    'ANTIGUA (con bug)' as tipo,
    categoria_principal,
    subcategoria,
    COUNT(*) as cantidad,
    SUM(COALESCE(duracion_real_minutos, duracion_planeada_minutos)) as tiempo_total
FROM actividades_marketing
WHERE activo = true
GROUP BY categoria_principal, subcategoria
ORDER BY cantidad DESC
LIMIT 10;

-- QUERY CORREGIDA
SELECT
    'CORREGIDA' as tipo,
    categoria_principal,
    subcategoria,
    COUNT(*) as cantidad,
    SUM(CASE WHEN estado = 'completada' THEN duracion_real_minutos ELSE 0 END) as tiempo_total
FROM actividades_marketing
WHERE activo = true
GROUP BY categoria_principal, subcategoria
ORDER BY tiempo_total DESC  -- Ordenar por tiempo, no cantidad
LIMIT 10;
```

**Para confirmar:**
- La diferencia entre el cálculo antiguo y el corregido
- Por qué "SISTEMA" está top 1 con el bug

---

## 6️⃣ **FILTRO DE FECHAS PARA REPORTES**

### Query 6.1: Actividades del mes actual (created_at vs fecha_inicio_planeada)
```sql
-- Método 1: Filtro por created_at (ACTUAL - posiblemente incorrecto)
SELECT
    'Por created_at' as metodo,
    COUNT(*) as total_actividades,
    COUNT(*) FILTER (WHERE estado = 'completada') as completadas
FROM actividades_marketing
WHERE activo = true
AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

-- Método 2: Filtro por fecha_inicio_planeada (SUGERIDO)
SELECT
    'Por fecha_inicio_planeada' as metodo,
    COUNT(*) as total_actividades,
    COUNT(*) FILTER (WHERE estado = 'completada') as completadas
FROM actividades_marketing
WHERE activo = true
AND fecha_inicio_planeada >= DATE_TRUNC('month', CURRENT_DATE)
AND fecha_inicio_planeada < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
```

**Para decidir:**
- Cuál filtro es el correcto para reportes por período

---

## 7️⃣ **TABLAS RELACIONADAS**

### Query 7.1: Ver relación con tabla usuarios
```sql
SELECT
    u.id,
    u.nombre,
    u.apellido,
    u.email,
    r.nombre as rol,
    a.nombre as area,
    COUNT(am.id) as total_actividades
FROM usuarios u
LEFT JOIN roles r ON u.rol_id = r.id
LEFT JOIN areas a ON u.area_id = a.id
LEFT JOIN actividades_marketing am ON am.usuario_id = u.id AND am.activo = true
WHERE u.activo = true
GROUP BY u.id, u.nombre, u.apellido, u.email, r.nombre, a.nombre
ORDER BY total_actividades DESC;
```

**Para confirmar:**
- Estructura de JOIN con usuarios
- Si las queries actuales son correctas

---

## 📝 INSTRUCCIONES

1. **Ejecuta primero las queries de la sección 1** (estructura de tabla)
2. **Luego las de la sección 2-4** (datos de muestra)
3. **Después la sección 5** (investigar el bug específico)
4. **Finalmente la sección 6** (decidir filtro de fechas)

**Copia los resultados y pégalos aquí para que podamos:**
- Confirmar los nombres exactos de columnas
- Corregir las queries definitivamente
- Entender por qué "SISTEMA - INACTIVO" está top 1

---

## 🎯 RESULTADOS ESPERADOS

Con estas queries deberías poder responder:

1. ✅ ¿Cuáles son las columnas exactas de `actividades_marketing`?
2. ✅ ¿Qué estados existen? (completada, pendiente, cancelada, etc.)
3. ✅ ¿Qué columnas de fecha usar para filtrar por período?
4. ✅ ¿Por qué "SISTEMA - INACTIVO" aparece top 1?
5. ✅ ¿Cuál es la diferencia entre `created_at` y `fecha_inicio_planeada`?
6. ✅ ¿Actividades pendientes tienen `duracion_real_minutos`?

**Una vez tengas los resultados, los analizaremos juntos para corregir las queries definitivamente.**
