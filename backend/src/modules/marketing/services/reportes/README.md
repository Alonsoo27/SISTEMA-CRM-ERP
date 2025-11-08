# 📊 Sistema de Reportes - Arquitectura Escalable

Sistema modular y escalable para generación de reportes en PDF y Excel.

---

## 📁 Estructura de Carpetas

```
reportes/
├── pdf/
│   ├── generadores/
│   │   ├── ProductividadPersonalPDF.js    ✅ Implementado
│   │   ├── CategoriaPDF.js                🔜 Futuro
│   │   ├── EquipoPDF.js                   🔜 Futuro
│   │   └── MensualPDF.js                  🔜 Futuro
│   └── utils/
│       ├── PDFBase.js                     ✅ Clase base con métodos comunes
│       └── PDFStyles.js                   ✅ Estilos corporativos
│
├── excel/
│   ├── generadores/
│   │   ├── ProductividadPersonalExcel.js  ✅ Implementado
│   │   ├── CategoriaExcel.js              🔜 Futuro
│   │   ├── EquipoExcel.js                 🔜 Futuro
│   │   └── MensualExcel.js                🔜 Futuro
│   └── utils/
│       ├── ExcelBase.js                   ✅ Clase base con métodos comunes
│       └── ExcelStyles.js                 ✅ Estilos corporativos
│
└── queries/
    └── reportesQueries.js                 ✅ Queries reutilizables optimizadas
```

---

## ✨ Ventajas de esta Arquitectura

### ✅ **Escalabilidad**
- Cada reporte en su propio archivo (no archivos monolíticos de 1000+ líneas)
- Fácil agregar nuevos reportes sin modificar código existente

### ✅ **Reutilización**
- Métodos comunes en clases base (PDFBase, ExcelBase)
- Estilos centralizados (PDFStyles, ExcelStyles)
- Queries optimizadas y reutilizables (ReportesQueries)

### ✅ **Mantenibilidad**
- Código organizado por tipo de reporte
- Fácil encontrar y modificar un reporte específico
- Separación de responsabilidades

### ✅ **Consistencia**
- Todos los reportes usan los mismos estilos corporativos
- Métodos estandarizados para componentes comunes

---

## 🚀 Cómo Agregar un Nuevo Reporte

### Ejemplo: Crear reporte "Por Categoría"

#### 1️⃣ **Crear generador PDF**

Archivo: `pdf/generadores/CategoriaPDF.js`

```javascript
const PDFBase = require('../utils/PDFBase');
const PDFStyles = require('../utils/PDFStyles');

class CategoriaPDF {
    static async generar(datos) {
        try {
            const doc = PDFBase.crearDocumento(
                `Reporte por Categoría - ${datos.categoria}`,
                'Sistema CRM/ERP'
            );

            const bufferPromise = PDFBase.documentoABuffer(doc);

            // Tu lógica de generación aquí
            PDFBase.dibujarEncabezado(doc, 'REPORTE POR CATEGORÍA');

            // ... más componentes

            PDFBase.dibujarPiePagina(doc, datos.usuario.nombre_completo, datos.periodo.descripcion);
            doc.end();

            return await bufferPromise;
        } catch (error) {
            console.error('❌ Error generando PDF por categoría:', error);
            throw error;
        }
    }
}

module.exports = CategoriaPDF;
```

#### 2️⃣ **Crear generador Excel**

Archivo: `excel/generadores/CategoriaExcel.js`

```javascript
const ExcelBase = require('../utils/ExcelBase');
const ExcelStyles = require('../utils/ExcelStyles');

class CategoriaExcel {
    static async generar(datos) {
        try {
            const workbook = ExcelBase.crearWorkbook();

            const sheet = ExcelBase.crearHoja(
                workbook,
                'Categorías',
                ExcelStyles.COLORES.AZUL_MEDIO,
                [30, 20, 20, 30]
            );

            // Tu lógica de generación aquí
            ExcelBase.agregarEncabezadoPrincipal(sheet, 'REPORTE POR CATEGORÍA');

            // ... más componentes

            return await ExcelBase.workbookABuffer(workbook);
        } catch (error) {
            console.error('❌ Error generando Excel por categoría:', error);
            throw error;
        }
    }
}

module.exports = CategoriaExcel;
```

#### 3️⃣ **Agregar queries necesarias**

En `queries/reportesQueries.js`:

```javascript
static async obtenerDatosPorCategoria(categoria, fechaInicio, fechaFin) {
    const result = await query(`
        SELECT
            -- tus columnas
        FROM actividades_marketing
        WHERE categoria_principal = $1
        AND fecha_inicio_planeada BETWEEN $2 AND $3
        -- más condiciones
    `, [categoria, fechaInicio, fechaFin]);

    return result.rows;
}
```

#### 4️⃣ **Exponer en servicios principales**

En `reportePDFService.js`:

```javascript
static async generarPorCategoria(datos) {
    const CategoriaPDF = require('./reportes/pdf/generadores/CategoriaPDF');
    return await CategoriaPDF.generar(datos);
}
```

En `reporteExcelService.js`:

```javascript
static async generarPorCategoria(datos) {
    const CategoriaExcel = require('./reportes/excel/generadores/CategoriaExcel');
    return await CategoriaExcel.generar(datos);
}
```

#### 5️⃣ **Agregar endpoints en controller**

En `reportesController.js`:

```javascript
static async generarReportePorCategoriaPDF(req, res) {
    try {
        const { categoria } = req.params;
        const { periodo = 'mes_actual' } = req.query;

        // Obtener datos
        const datos = await obtenerDatosPorCategoria(...);

        // Generar PDF
        const pdfBuffer = await ReportePDFService.generarPorCategoria(datos);

        // Enviar
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        // manejo de errores
    }
}
```

#### 6️⃣ **Agregar rutas**

En `marketingRoutes.js`:

```javascript
router.get('/reportes/categoria/:categoria/pdf',
    authenticateToken,
    requireRole(GRUPOS_ROLES.MARKETING_COMPLETO),
    ReportesController.generarReportePorCategoriaPDF
);
```

---

## 🎨 Componentes Disponibles

### **PDFBase**

Métodos comunes para PDFs:

```javascript
// Crear documento
PDFBase.crearDocumento(titulo, autor);

// Componentes visuales
PDFBase.dibujarEncabezado(doc, titulo);
PDFBase.dibujarPiePagina(doc, usuario, periodo);
PDFBase.dibujarCaja(doc, texto, color);
PDFBase.dibujarGridKPIs(doc, kpis);
PDFBase.dibujarTabla(doc, datos, anchos);

// Utilidades
PDFBase.minutosAHoras(minutos);
PDFBase.formatearPorcentaje(valor);
PDFBase.verificarEspacio(doc, alturaRequerida, titulo);
```

### **ExcelBase**

Métodos comunes para Excel:

```javascript
// Crear workbook
ExcelBase.crearWorkbook();
ExcelBase.crearHoja(workbook, nombre, color, anchos);

// Componentes visuales
ExcelBase.agregarEncabezadoPrincipal(sheet, titulo, rango);
ExcelBase.agregarInfoUsuario(sheet, datos, row);
ExcelBase.agregarEncabezadoSeccion(sheet, titulo, row, rango, emoji);
ExcelBase.agregarTabla(sheet, datos, row);
ExcelBase.agregarTablaKPIs(sheet, kpis, row);
ExcelBase.agregarTop3(sheet, titulo, items, row);
ExcelBase.agregarInterpretacion(sheet, titulo, texto, color, row);

// Utilidades
ExcelBase.minutosAHoras(minutos);
ExcelBase.formatearPorcentaje(valor);
```

### **PDFStyles / ExcelStyles**

Estilos y colores corporativos:

```javascript
// Colores
PDFStyles.COLORES.AZUL_OSCURO
PDFStyles.COLORES.VERDE
PDFStyles.COLORES.AMARILLO

// Métodos de evaluación
PDFStyles.getColorPorValor(valor, umbral, mayorEsMejor);
PDFStyles.getSimboloPorValor(valor, umbral, mayorEsMejor);
PDFStyles.getNivelImpacto(cantidad, umbrales);
PDFStyles.getCalificacion(porcentaje);
PDFStyles.getInterpretacionEficiencia(eficiencia);
```

---

## 📊 Queries Reutilizables

En `reportesQueries.js`:

```javascript
// Información del usuario
await ReportesQueries.obtenerInfoUsuario(usuarioId);

// Métricas totales
await ReportesQueries.obtenerTotales(usuarioId, fechaInicio, fechaFin);

// Análisis de tiempo
await ReportesQueries.obtenerAnalisisTiempo(usuarioId, fechaInicio, fechaFin);

// Distribución por categorías
await ReportesQueries.obtenerDistribucionCategorias(usuarioId, fechaInicio, fechaFin);

// Problemas
await ReportesQueries.obtenerProblemas(usuarioId, fechaInicio, fechaFin);

// Método consolidado (ejecuta todas en paralelo)
await ReportesQueries.obtenerDatosProductividadPersonal(usuarioId, fechaInicio, fechaFin);
```

---

## 🔧 Mantenimiento

### **Modificar estilos corporativos**

Edita `PDFStyles.js` o `ExcelStyles.js` - los cambios se aplican automáticamente a todos los reportes.

### **Agregar métodos comunes**

Edita `PDFBase.js` o `ExcelBase.js` - todos los generadores heredan los métodos.

### **Optimizar queries**

Edita `reportesQueries.js` - las queries se usan en todos los reportes que las necesiten.

---

## 📝 Notas Importantes

1. **Compatibilidad**: Los servicios principales (`reportePDFService.js`, `reporteExcelService.js`) mantienen compatibilidad con código existente
2. **Queries corregidas**: El archivo `reportesQueries.js` tiene las queries corregidas (pendiente confirmar con BD)
3. **Extensibilidad**: Agregar nuevos reportes no requiere modificar código existente
4. **Pie de página**: Usa `PDFBase.dibujarPiePagina()` en CADA página del PDF, no solo al final

---

## 🎯 Próximos Pasos

1. ✅ Arquitectura creada
2. ✅ Productividad Personal implementado
3. 🔜 Confirmar queries con BD real
4. 🔜 Implementar reporte "Por Categoría"
5. 🔜 Implementar reporte "Equipo"
6. 🔜 Implementar reporte "Mensual"

---

## 📚 Referencias

- **PDFKit**: https://pdfkit.org/docs/getting_started.html
- **ExcelJS**: https://github.com/exceljs/exceljs

---

**✨ Arquitectura diseñada para escalar sin límites ✨**
