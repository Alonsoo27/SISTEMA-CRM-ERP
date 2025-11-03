// ============================================
// CONTROLLER DE CARGA MASIVA - MARKETING
// Importación de actividades desde Excel
// ============================================

const ExcelJS = require('exceljs');
const { query } = require('../../../config/database');
const actividadesService = require('../services/actividadesService');
const reajusteService = require('../services/reajusteService');

// Mapeo de colores por categoría principal
const COLORES_CATEGORIAS = {
    'GRABACIONES': '#3B82F6',
    'EDICIONES': '#F59E0B',
    'LIVES': '#EC4899',
    'DISEÑO': '#A855F7',
    'FICHAS TÉCNICAS': '#64748B',
    'FERIA': '#0EA5E9',
    'REUNIONES': '#84CC16',
    'PRUEBAS Y MUESTRAS': '#F43F5E',
    'CAPACITACIONES': '#16A34A'
};

// Función helper para obtener color por categoría
function obtenerColorCategoria(categoria_principal) {
    return COLORES_CATEGORIAS[categoria_principal] || '#3B82F6'; // Azul por defecto
}

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
            // OBTENER USUARIOS DE MARKETING
            // ============================================
            const usuariosResult = await query(`
                SELECT
                    u.id,
                    u.nombre,
                    u.apellido,
                    CONCAT(u.nombre, ' ', u.apellido) as nombre_completo,
                    u.email,
                    r.nombre as rol
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.id
                WHERE r.nombre IN ('MARKETING_EJECUTOR', 'JEFE_MARKETING')
                  AND u.activo = true
                  AND u.deleted_at IS NULL
                ORDER BY u.nombre, u.apellido
            `);

            const usuariosMarketing = usuariosResult.rows;

            if (usuariosMarketing.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay usuarios de marketing disponibles para generar la plantilla'
                });
            }

            // Crear lista de nombres para dropdown
            const nombresUsuarios = usuariosMarketing.map(u => u.nombre_completo);

            // ============================================
            // AGREGAR FILAS DE EJEMPLO
            // ============================================
            const primerUsuario = usuariosMarketing[0].nombre_completo;
            const segundoUsuario = usuariosMarketing.length > 1 ? usuariosMarketing[1].nombre_completo : primerUsuario;

            const ejemplos = [
                {
                    orden: 1,
                    descripcion: 'Postear contenido en Instagram y Facebook',
                    categoria_principal: 'COMMUNITY MANAGER',
                    subcategoria: 'POSTEO DE CONTENIDOS RRSS',
                    duracion_minutos: 60,
                    usuarios_asignados: primerUsuario,
                    notas: 'Publicar carrusel de nuevos productos'
                },
                {
                    orden: 2,
                    descripcion: 'Diseñar flyers para campaña de verano',
                    categoria_principal: 'DISEÑO',
                    subcategoria: 'FLYERS',
                    duracion_minutos: 180,
                    usuarios_asignados: segundoUsuario,
                    notas: 'Incluir logo actualizado'
                },
                {
                    orden: 3,
                    descripcion: 'Reunión semanal de marketing',
                    categoria_principal: 'REUNIONES',
                    subcategoria: 'MARKETING',
                    duracion_minutos: 90,
                    usuarios_asignados: `${primerUsuario}, ${segundoUsuario}`,
                    notas: 'Actividad grupal - Revisión de métricas'
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
            const todasSubcategorias = [...new Set(categoriasResult.rows.map(c => c.subcategoria))];

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

            // ============================================
            // CREAR HOJA OCULTA PARA VALIDACIONES
            // ============================================
            const validacionesSheet = workbook.addWorksheet('_Validaciones');
            validacionesSheet.state = 'hidden'; // Ocultar la hoja

            // Agregar lista de usuarios (columna A)
            validacionesSheet.getCell('A1').value = 'Usuarios';
            nombresUsuarios.forEach((nombre, index) => {
                validacionesSheet.getCell(`A${index + 2}`).value = nombre;
            });

            // Agregar lista de categorías (columna B)
            validacionesSheet.getCell('B1').value = 'Categorias';
            categoriasPrincipales.forEach((cat, index) => {
                validacionesSheet.getCell(`B${index + 2}`).value = cat;
            });

            // Agregar lista de subcategorías (columna C)
            validacionesSheet.getCell('C1').value = 'Subcategorias';
            todasSubcategorias.forEach((sub, index) => {
                validacionesSheet.getCell(`C${index + 2}`).value = sub;
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
                // Usar referencia a hoja oculta en vez de lista inline
                newRow.getCell(3).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`_Validaciones!$B$2:$B$${categoriasPrincipales.length + 1}`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Categoría inválida',
                    error: 'Por favor selecciona una categoría de la lista'
                };

                // Para subcategorías, usar referencia a hoja oculta
                newRow.getCell(4).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`_Validaciones!$C$2:$C$${todasSubcategorias.length + 1}`],
                    showErrorMessage: true,
                    errorStyle: 'warning',
                    errorTitle: 'Subcategoría',
                    error: 'Verifica que la subcategoría corresponda a la categoría principal seleccionada'
                };

                // Aplicar validación dropdown para Usuarios Asignados (columna F)
                // Usar referencia a hoja oculta en vez de lista inline
                newRow.getCell(6).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`_Validaciones!$A$2:$A$${nombresUsuarios.length + 1}`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Usuario no válido',
                    error: 'Selecciona un usuario de la lista. Para múltiples usuarios, sepáralos con coma (,)'
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
                ['6. USUARIOS ASIGNADOS:', 'Selecciona del dropdown el nombre del usuario. Para actividades grupales, separa con coma (,).'],
                ['', 'Ejemplo: Juan Pérez, María García'],
                ['', 'Consulta la hoja "Usuarios de Marketing" para ver la lista completa.'],
                ['', ''],
                ['7. NOTAS:', 'Información adicional (opcional).'],
                ['', ''],
                ['⚠️ IMPORTANTE:', ''],
                ['', '• Los nombres deben escribirse EXACTAMENTE como aparecen en el dropdown'],
                ['', '• Solo puedes asignar usuarios del área de marketing'],
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
            // AGREGAR HOJA DE USUARIOS DE MARKETING
            // ============================================
            const usuariosSheet = workbook.addWorksheet('Usuarios de Marketing');
            usuariosSheet.columns = [
                { header: 'Nombre Completo', key: 'nombre_completo', width: 30 },
                { header: 'Email', key: 'email', width: 35 },
                { header: 'Rol', key: 'rol', width: 20 }
            ];

            const userHeaderRow = usuariosSheet.getRow(1);
            userHeaderRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            userHeaderRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF6C63FF' }
            };

            usuariosMarketing.forEach(user => {
                usuariosSheet.addRow({
                    nombre_completo: user.nombre_completo,
                    email: user.email,
                    rol: user.rol === 'JEFE_MARKETING' ? 'Jefe de Marketing' : 'Ejecutor de Marketing'
                });
            });

            // Agregar nota informativa
            usuariosSheet.addRow({});
            usuariosSheet.addRow({});
            const notaRow = usuariosSheet.addRow({
                nombre_completo: '💡 Usa los nombres de la columna "Nombre Completo" en la plantilla principal'
            });
            notaRow.font = { italic: true, color: { argb: 'FF0066CC' } };
            usuariosSheet.mergeCells(`A${notaRow.number}:C${notaRow.number}`);

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

            // ============================================
            // OBTENER MAPEO DE USUARIOS (Nombre → Email/ID)
            // ============================================
            const usuariosResult = await query(`
                SELECT
                    u.id,
                    u.nombre,
                    u.apellido,
                    CONCAT(u.nombre, ' ', u.apellido) as nombre_completo,
                    u.email,
                    r.nombre as rol
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.id
                WHERE r.nombre IN ('MARKETING_EJECUTOR', 'JEFE_MARKETING')
                  AND u.activo = true
                  AND u.deleted_at IS NULL
                ORDER BY u.nombre, u.apellido
            `);

            // Crear mapeo: nombreCompleto → {id, email, rol}
            const usuariosMap = new Map();
            usuariosResult.rows.forEach(user => {
                usuariosMap.set(user.nombre_completo.toLowerCase().trim(), {
                    id: user.id,
                    email: user.email,
                    nombre_completo: user.nombre_completo,
                    rol: user.rol
                });
            });

            console.log('📋 Usuarios de marketing disponibles:', usuariosResult.rows.length);

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

                // Leer valores crudos de las celdas
                const rawOrden = row.getCell(1).value;
                const rawDescripcion = row.getCell(2).value;
                const rawCategoria = row.getCell(3).value;
                const rawSubcategoria = row.getCell(4).value;
                const rawDuracion = row.getCell(5).value;
                const rawUsuarios = row.getCell(6).value;
                const rawNotas = row.getCell(7).value;

                // Convertir usuarios_asignados a string de forma segura
                let usuariosAsignados = null;
                if (rawUsuarios !== null && rawUsuarios !== undefined) {
                    // Si es un objeto con fórmula, extraer el resultado
                    if (typeof rawUsuarios === 'object' && rawUsuarios.result !== undefined) {
                        usuariosAsignados = String(rawUsuarios.result || '').trim();
                    } else {
                        usuariosAsignados = String(rawUsuarios).trim();
                    }
                }

                const fila = {
                    rowNumber,
                    orden: rawOrden,
                    descripcion: rawDescripcion,
                    categoria_principal: rawCategoria,
                    subcategoria: rawSubcategoria,
                    duracion_minutos: rawDuracion,
                    usuarios_asignados: usuariosAsignados,
                    notas: rawNotas
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
                    'SELECT 1 FROM tipos_actividad_marketing WHERE categoria_principal = $1 AND subcategoria = $2 AND activo = true',
                    [fila.categoria_principal, fila.subcategoria]
                );

                if (tipoResult.rows.length === 0) {
                    errores.push({
                        fila: fila.rowNumber,
                        errores: [`Categoría/Subcategoría no válida: ${fila.categoria_principal} / ${fila.subcategoria}`]
                    });
                    continue;
                }

                // Validar usuarios - convertir a string si no lo es
                let usuariosString = fila.usuarios_asignados;

                // Verificar que sea un string válido antes de hacer split
                if (!usuariosString || typeof usuariosString !== 'string') {
                    erroresFila.push('Usuarios asignados debe ser texto (nombres separados por coma)');
                    errores.push({
                        fila: fila.rowNumber,
                        errores: erroresFila
                    });
                    continue;
                }

                // Separar por coma y limpiar espacios
                const nombresUsuarios = usuariosString.split(',').map(n => n.trim()).filter(n => n.length > 0);

                if (nombresUsuarios.length === 0) {
                    erroresFila.push('No se encontraron nombres válidos en usuarios asignados');
                    errores.push({
                        fila: fila.rowNumber,
                        errores: erroresFila
                    });
                    continue;
                }

                const usuariosValidos = [];

                // Buscar cada nombre en el mapeo
                for (const nombreUsuario of nombresUsuarios) {
                    const nombreNormalizado = nombreUsuario.toLowerCase().trim();

                    // Buscar en el Map
                    const usuario = usuariosMap.get(nombreNormalizado);

                    if (!usuario) {
                        erroresFila.push(`Usuario no encontrado: "${nombreUsuario}". Verifica que el nombre sea exacto.`);
                    } else {
                        usuariosValidos.push({
                            id: usuario.id,
                            email: usuario.email,
                            nombre_completo: usuario.nombre_completo
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
                    color_hex: obtenerColorCategoria(fila.categoria_principal),
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

            for (let i = 0; i < actividades.length; i++) {
                const actividad = actividades[i];

                try {
                    console.log(`📝 Procesando actividad ${i + 1}/${actividades.length}:`, {
                        descripcion: actividad.descripcion,
                        usuarios: actividad.usuarios.length,
                        duracion: actividad.duracion_minutos
                    });

                    // Crear actividad para cada usuario asignado
                    for (const usuario of actividad.usuarios) {
                        try {
                            console.log(`👤 Procesando para usuario ${usuario.id} (${usuario.email})`);

                            // GENERAR CÓDIGO ÚNICO PARA CADA USUARIO (evita duplicados)
                            const codigo = await actividadesService.generarCodigoActividad();
                            console.log(`✅ Código generado: ${codigo}`);

                            // Obtener próximo slot disponible
                            const fechaInicio = await actividadesService.obtenerProximoSlotDisponible(usuario.id);
                            console.log(`📅 Slot disponible: ${fechaInicio}`);

                            const fechaFin = reajusteService.agregarMinutosEfectivos(fechaInicio, actividad.duracion_minutos);
                            console.log(`📅 Fecha fin calculada: ${fechaFin}`);

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

                            console.log(`✅ Actividad creada ID: ${result.rows[0].id}`);
                            actividadesCreadas.push(result.rows[0]);
                        } catch (userError) {
                            console.error(`❌ Error creando actividad para usuario ${usuario.email}:`, userError);
                            throw new Error(`Error creando actividad para ${usuario.email}: ${userError.message}`);
                        }
                    }
                } catch (actError) {
                    console.error(`❌ Error procesando actividad ${i + 1}:`, actError);
                    throw new Error(`Error en actividad "${actividad.descripcion}": ${actError.message}`);
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
            console.error('❌ Error procesando carga masiva:', error);
            console.error('Stack trace:', error.stack);

            res.status(500).json({
                success: false,
                message: 'Error al procesar carga masiva',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
}

module.exports = CargaMasivaController;
