// ============================================
// CONTROLLER DE CARGA MASIVA - MARKETING
// Importación de actividades desde Excel
// ============================================

const ExcelJS = require('exceljs');
const { query } = require('../../../config/database');
const actividadesService = require('../services/actividadesService');
const reajusteService = require('../services/reajusteService');

class CargaMasivaController {
    /**
     * Generar plantilla Excel para descarga
     */
    static async generarPlantilla(req, res) {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Actividades Marketing');

            // Configurar propiedades del workbook
            workbook.creator = 'Sistema CRM/ERP - Mundipaci';
            workbook.created = new Date();

            // ============================================
            // DEFINIR COLUMNAS
            // ============================================
            worksheet.columns = [
                { header: 'Orden', key: 'orden', width: 10 },
                { header: 'Descripción', key: 'descripcion', width: 40 },
                { header: 'Categoría Principal', key: 'categoria_principal', width: 20 },
                { header: 'Subcategoría', key: 'subcategoria', width: 20 },
                { header: 'Duración (minutos)', key: 'duracion_minutos', width: 18 },
                { header: 'Usuarios Asignados (emails)', key: 'usuarios_asignados', width: 40 },
                { header: 'Notas', key: 'notas', width: 30 }
            ];

            // ============================================
            // ESTILO DE ENCABEZADOS
            // ============================================
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF0066CC' }
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 25;

            // ============================================
            // AGREGAR FILAS DE EJEMPLO
            // ============================================
            const ejemplos = [
                {
                    orden: 1,
                    descripcion: 'Capacitación en provincia',
                    categoria_principal: 'CAPACITACIONES',
                    subcategoria: 'PERSONAL',
                    duracion_minutos: 1080,
                    usuarios_asignados: 'juan@example.com',
                    notas: 'Incluye viaje y hotel'
                },
                {
                    orden: 2,
                    descripcion: 'Diseñar banner para Facebook',
                    categoria_principal: 'REDES SOCIALES',
                    subcategoria: 'DISEÑO',
                    duracion_minutos: 120,
                    usuarios_asignados: 'maria@example.com',
                    notas: ''
                },
                {
                    orden: 3,
                    descripcion: 'Reunión con equipo de marketing',
                    categoria_principal: 'REUNIONES',
                    subcategoria: 'INTERNA',
                    duracion_minutos: 60,
                    usuarios_asignados: 'juan@example.com, maria@example.com',
                    notas: 'Actividad grupal'
                }
            ];

            ejemplos.forEach(ejemplo => {
                worksheet.addRow(ejemplo);
            });

            // ============================================
            // OBTENER CATEGORÍAS PARA VALIDACIONES
            // ============================================
            const categoriasResult = await query(`
                SELECT DISTINCT categoria_principal, subcategoria, color_hex
                FROM tipos_actividad_marketing
                WHERE activo = true
                ORDER BY categoria_principal, subcategoria
            `);

            // Extraer categorías principales únicas
            const categoriasPrincipales = [...new Set(categoriasResult.rows.map(c => c.categoria_principal))];

            // Crear mapeo de subcategorías por categoría principal
            const subcategoriasPorCategoria = {};
            categoriasResult.rows.forEach(cat => {
                if (!subcategoriasPorCategoria[cat.categoria_principal]) {
                    subcategoriasPorCategoria[cat.categoria_principal] = [];
                }
                if (!subcategoriasPorCategoria[cat.categoria_principal].includes(cat.subcategoria)) {
                    subcategoriasPorCategoria[cat.categoria_principal].push(cat.subcategoria);
                }
            });

            // Agregar 100 filas vacías con fórmula de auto-orden para facilitar el llenado
            for (let i = 0; i < 100; i++) {
                const rowIndex = 5 + i; // Fila 2-4 son ejemplos, empezar en 5
                const newRow = worksheet.addRow({
                    orden: '',
                    descripcion: '',
                    categoria_principal: '',
                    subcategoria: '',
                    duracion_minutos: '',
                    usuarios_asignados: '',
                    notas: ''
                });

                // Aplicar fórmula ROW()-1 en columna Orden
                newRow.getCell(1).value = { formula: `ROW()-1` };

                // Aplicar validación dropdown para Categoría Principal (columna C)
                newRow.getCell(3).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${categoriasPrincipales.join(',')}"`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Categoría inválida',
                    error: 'Por favor selecciona una categoría de la lista'
                };

                // Para subcategorías, como no podemos hacer validación dependiente fácilmente en Excel,
                // agregamos todas las subcategorías posibles
                const todasSubcategorias = [...new Set(categoriasResult.rows.map(c => c.subcategoria))];
                newRow.getCell(4).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${todasSubcategorias.join(',')}"`],
                    showErrorMessage: true,
                    errorStyle: 'warning',
                    errorTitle: 'Subcategoría',
                    error: 'Verifica que la subcategoría corresponda a la categoría principal seleccionada'
                };
            }

            // ============================================
            // APLICAR ESTILOS A DATOS
            // ============================================
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) { // Saltar header
                    row.eachCell(cell => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });

                    // Alternar colores de fila
                    if (rowNumber % 2 === 0) {
                        row.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF0F0F0' }
                        };
                    }
                }
            });

            // ============================================
            // AGREGAR HOJA DE INSTRUCCIONES
            // ============================================
            const instruccionesSheet = workbook.addWorksheet('Instrucciones');
            instruccionesSheet.mergeCells('A1:B1');
            instruccionesSheet.getCell('A1').value = '📋 INSTRUCCIONES DE USO';
            instruccionesSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0066CC' } };
            instruccionesSheet.getCell('A1').alignment = { horizontal: 'center' };

            const instrucciones = [
                ['', ''],
                ['1. ORDEN:', 'Se genera automáticamente con la fórmula ROW()-1. Las actividades se crearán en este orden.'],
                ['', 'Puedes modificar el orden manualmente si lo deseas.'],
                ['', ''],
                ['2. DESCRIPCIÓN:', 'Texto descriptivo de la actividad (máximo 500 caracteres).'],
                ['', ''],
                ['3. CATEGORÍA PRINCIPAL:', 'Selecciona del dropdown. Las filas vacías ya tienen validación configurada.'],
                ['', 'Para filas nuevas, consulta la hoja "Categorías Disponibles".'],
                ['', ''],
                ['4. SUBCATEGORÍA:', 'Selecciona del dropdown. Verifica que corresponda a la categoría principal.'],
                ['', ''],
                ['5. DURACIÓN (MINUTOS):', 'Duración en minutos (ej: 60 = 1 hora, 120 = 2 horas, 1080 = 18 horas).'],
                ['', 'El sistema respeta automáticamente los horarios laborales al programar.'],
                ['', ''],
                ['6. USUARIOS ASIGNADOS:', 'Emails de usuarios separados por coma (,) para actividades grupales.'],
                ['', 'Ejemplo: juan@example.com, maria@example.com'],
                ['', ''],
                ['7. NOTAS:', 'Información adicional (opcional).'],
                ['', ''],
                ['⚠️ IMPORTANTE:', ''],
                ['', '• Los emails deben existir en la base de datos'],
                ['', '• Los usuarios deben ser del área de marketing (MARKETING_EJECUTOR o JEFE_MARKETING)'],
                ['', '• Las categorías y subcategorías deben coincidir exactamente con las disponibles'],
                ['', '• El sistema calculará automáticamente las fechas según disponibilidad de cada usuario'],
                ['', '• No es necesario calcular fechas manualmente'],
                ['', '• Las actividades se programarán respetando el horario laboral (8:00 AM - 6:00 PM)'],
                ['', ''],
                ['💡 TIP:', 'Elimina las filas de ejemplo antes de subir tu archivo. Usa las filas vacías que ya tienen'],
                ['', 'las fórmulas y validaciones configuradas.']
            ];

            instrucciones.forEach((row, index) => {
                instruccionesSheet.addRow(row);
                if (row[0].includes('ORDEN:') || row[0].includes('IMPORTANTE:') || row[0].includes('TIP:')) {
                    const currentRow = instruccionesSheet.getRow(index + 1);
                    currentRow.font = { bold: true, color: { argb: 'FF0066CC' } };
                }
            });

            instruccionesSheet.getColumn('A').width = 20;
            instruccionesSheet.getColumn('B').width = 80;

            // ============================================
            // AGREGAR HOJA DE CATEGORÍAS DISPONIBLES
            // (Reutilizamos categoriasResult obtenido anteriormente)
            // ============================================
            const categoriasSheet = workbook.addWorksheet('Categorías Disponibles');
            categoriasSheet.columns = [
                { header: 'Categoría Principal', key: 'categoria_principal', width: 25 },
                { header: 'Subcategoría', key: 'subcategoria', width: 25 },
                { header: 'Color', key: 'color', width: 15 }
            ];

            const catHeaderRow = categoriasSheet.getRow(1);
            catHeaderRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            catHeaderRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF28A745' }
            };

            categoriasResult.rows.forEach(cat => {
                categoriasSheet.addRow({
                    categoria_principal: cat.categoria_principal,
                    subcategoria: cat.subcategoria,
                    color: cat.color_hex
                });
            });

            // ============================================
            // ENVIAR ARCHIVO
            // ============================================
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename=Plantilla_Actividades_Marketing.xlsx'
            );

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Error generando plantilla Excel:', error);
            res.status(500).json({
                success: false,
                message: 'Error al generar plantilla Excel',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Procesar archivo Excel y crear actividades
     */
    static async procesarCargaMasiva(req, res) {
        try {
            const { user_id, rol } = req.user;

            // Validar que sea jefe o superior
            const esJefe = ['JEFE_MARKETING', 'SUPER_ADMIN', 'GERENTE', 'ADMIN'].includes(rol);
            if (!esJefe) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo el jefe de marketing y superiores pueden hacer carga masiva'
                });
            }

            // Validar que se haya subido un archivo
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No se ha subido ningún archivo'
                });
            }

            // Leer el archivo Excel
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);
            const worksheet = workbook.getWorksheet('Actividades Marketing');

            if (!worksheet) {
                return res.status(400).json({
                    success: false,
                    message: 'El archivo no contiene la hoja "Actividades Marketing"'
                });
            }

            // ============================================
            // VALIDAR Y PROCESAR FILAS
            // ============================================
            const actividades = [];
            const errores = [];
            const filas = [];

            worksheet.eachRow((row, rowNumber) => {
                // Saltar header
                if (rowNumber === 1) return;

                const fila = {
                    rowNumber,
                    orden: row.getCell(1).value,
                    descripcion: row.getCell(2).value,
                    categoria_principal: row.getCell(3).value,
                    subcategoria: row.getCell(4).value,
                    duracion_minutos: row.getCell(5).value,
                    usuarios_asignados: row.getCell(6).value,
                    notas: row.getCell(7).value
                };

                // Validar que no esté vacía
                if (!fila.descripcion && !fila.categoria_principal) {
                    return; // Fila vacía, ignorar
                }

                filas.push(fila);
            });

            // Ordenar por la columna "orden"
            filas.sort((a, b) => (a.orden || 999) - (b.orden || 999));

            // ============================================
            // VALIDACIONES
            // ============================================
            for (const fila of filas) {
                const erroresFila = [];

                // Validar campos requeridos
                if (!fila.descripcion) erroresFila.push('Falta descripción');
                if (!fila.categoria_principal) erroresFila.push('Falta categoría principal');
                if (!fila.subcategoria) erroresFila.push('Falta subcategoría');
                if (!fila.duracion_minutos || fila.duracion_minutos <= 0) erroresFila.push('Duración inválida (debe ser mayor a 0 minutos)');
                if (!fila.usuarios_asignados) erroresFila.push('Faltan usuarios asignados');

                if (erroresFila.length > 0) {
                    errores.push({
                        fila: fila.rowNumber,
                        errores: erroresFila
                    });
                    continue;
                }

                // Validar categoría/subcategoría
                const tipoResult = await query(
                    'SELECT color_hex FROM tipos_actividad_marketing WHERE categoria_principal = $1 AND subcategoria = $2 AND activo = true',
                    [fila.categoria_principal, fila.subcategoria]
                );

                if (tipoResult.rows.length === 0) {
                    errores.push({
                        fila: fila.rowNumber,
                        errores: [`Categoría/Subcategoría no válida: ${fila.categoria_principal} / ${fila.subcategoria}`]
                    });
                    continue;
                }

                // Validar usuarios
                const emails = fila.usuarios_asignados.split(',').map(e => e.trim());
                const usuariosValidos = [];

                for (const email of emails) {
                    const userResult = await query(
                        `SELECT u.id, r.nombre as rol
                         FROM usuarios u
                         LEFT JOIN roles r ON u.rol_id = r.id
                         WHERE u.email = $1 AND u.deleted_at IS NULL AND u.activo = true`,
                        [email]
                    );

                    if (userResult.rows.length === 0) {
                        erroresFila.push(`Usuario no encontrado: ${email}`);
                    } else if (!['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(userResult.rows[0].rol)) {
                        erroresFila.push(`Usuario ${email} no es del área de marketing`);
                    } else {
                        usuariosValidos.push({
                            id: userResult.rows[0].id,
                            email: email
                        });
                    }
                }

                if (erroresFila.length > 0) {
                    errores.push({
                        fila: fila.rowNumber,
                        errores: erroresFila
                    });
                    continue;
                }

                // Agregar actividad válida
                actividades.push({
                    descripcion: fila.descripcion,
                    categoria_principal: fila.categoria_principal,
                    subcategoria: fila.subcategoria,
                    duracion_minutos: Math.round(parseFloat(fila.duracion_minutos)),
                    usuarios: usuariosValidos,
                    color_hex: tipoResult.rows[0].color_hex,
                    notas: fila.notas || null,
                    es_grupal: usuariosValidos.length > 1
                });
            }

            // Si hay errores, retornarlos
            if (errores.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Se encontraron errores en el archivo Excel',
                    errores: errores,
                    actividades_validas: actividades.length
                });
            }

            // ============================================
            // CREAR ACTIVIDADES
            // ============================================
            const actividadesCreadas = [];

            for (const actividad of actividades) {
                const codigo = await actividadesService.generarCodigoActividad();

                // Crear actividad para cada usuario asignado
                for (const usuario of actividad.usuarios) {
                    // Obtener próximo slot disponible
                    const fechaInicio = await actividadesService.obtenerProximoSlotDisponible(usuario.id);
                    const fechaFin = reajusteService.agregarMinutosEfectivos(fechaInicio, actividad.duracion_minutos);

                    const insertQuery = `
                        INSERT INTO actividades_marketing (
                            codigo, categoria_principal, subcategoria, descripcion,
                            usuario_id, creado_por, tipo, es_grupal,
                            participantes_ids, fecha_inicio_planeada, fecha_fin_planeada,
                            duracion_planeada_minutos, color_hex, estado, notas
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pendiente', $14)
                        RETURNING *
                    `;

                    const participantesIds = actividad.es_grupal ? actividad.usuarios.map(u => u.id) : null;

                    const result = await query(insertQuery, [
                        codigo,
                        actividad.categoria_principal,
                        actividad.subcategoria,
                        actividad.descripcion,
                        usuario.id,
                        user_id,
                        actividad.es_grupal ? 'grupal' : 'individual',
                        actividad.es_grupal,
                        participantesIds,
                        fechaInicio,
                        fechaFin,
                        actividad.duracion_minutos,
                        actividad.color_hex,
                        actividad.notas
                    ]);

                    actividadesCreadas.push(result.rows[0]);
                }
            }

            res.json({
                success: true,
                message: `Se crearon ${actividadesCreadas.length} actividades exitosamente`,
                actividades_creadas: actividadesCreadas.length,
                actividades_agrupadas: actividades.length,
                detalle: actividadesCreadas
            });

        } catch (error) {
            console.error('Error procesando carga masiva:', error);
            res.status(500).json({
                success: false,
                message: 'Error al procesar carga masiva',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = CargaMasivaController;
