// ============================================
// REPORTES DE MARKETING
// Exportación y generación de reportes corporativos
// ============================================

import { useState, useEffect, useMemo } from 'react';
import marketingService from '../../../services/marketingService';
import SelectorPeriodoAvanzado from './SelectorPeriodoAvanzado';

const ReportesMarketing = ({ usuarioId, esJefe }) => {
    // Obtener usuario logueado
    const user = useMemo(() => {
        try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            return {
                id: userData.id,
                nombre: userData.nombre_completo || `${userData.nombre || ''} ${userData.apellido || ''}`.trim(),
                rol: userData.rol?.nombre || userData.rol
            };
        } catch (error) {
            console.error('Error al obtener usuario:', error);
            return { id: null, nombre: '', rol: '' };
        }
    }, []);

    // Permisos
    const esMarketing = ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(user?.rol);
    const esEjecutivo = ['SUPER_ADMIN', 'ADMIN', 'GERENTE'].includes(user?.rol);
    const puedeVerOtros = esJefe || esEjecutivo;

    const [periodo, setPeriodo] = useState('mes_actual');
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(usuarioId || user.id);
    const [equipoMarketing, setEquipoMarketing] = useState([]);
    const [loading, setLoading] = useState({});
    const [error, setError] = useState(null);
    const [datosPreview, setDatosPreview] = useState(null);
    const [mostrarPreview, setMostrarPreview] = useState(false);

    // Estado para el selector de período avanzado
    const [modalPeriodoAbierto, setModalPeriodoAbierto] = useState(false);
    const [accionPendiente, setAccionPendiente] = useState(null); // { tipo: 'pdf'|'excel', reporte: 'personal'|'categoria'|'equipo' }

    // Cargar equipo de marketing si puede ver otros
    useEffect(() => {
        if (puedeVerOtros) {
            cargarEquipoMarketing();
        }
    }, [puedeVerOtros]);

    const cargarEquipoMarketing = async () => {
        try {
            const data = await marketingService.obtenerEquipoMarketing();
            setEquipoMarketing(data.data || []);
        } catch (err) {
            console.error('Error cargando equipo:', err);
        }
    };

    const handleGenerarPDF = async () => {
        setLoading(prev => ({ ...prev, pdf: true }));
        setError(null);

        try {
            await marketingService.descargarReporteProductividadPDF(usuarioSeleccionado, periodo);
        } catch (err) {
            console.error('Error generando PDF:', err);
            setError(err.message || 'Error al generar reporte PDF');
        } finally {
            setLoading(prev => ({ ...prev, pdf: false }));
        }
    };

    const handleGenerarExcel = async () => {
        setLoading(prev => ({ ...prev, excel: true }));
        setError(null);

        try {
            await marketingService.descargarReporteProductividadExcel(usuarioSeleccionado, periodo);
        } catch (err) {
            console.error('Error generando Excel:', err);
            setError(err.message || 'Error al generar reporte Excel');
        } finally {
            setLoading(prev => ({ ...prev, excel: false }));
        }
    };

    const handleVerPreview = async () => {
        setLoading(prev => ({ ...prev, preview: true }));
        setError(null);

        try {
            const response = await marketingService.obtenerDatosReporteProductividad(usuarioSeleccionado, periodo);
            setDatosPreview(response.data);
            setMostrarPreview(true);
        } catch (err) {
            console.error('Error obteniendo preview:', err);
            setError(err.message || 'Error al obtener preview');
        } finally {
            setLoading(prev => ({ ...prev, preview: false }));
        }
    };

    // ============================================
    // HANDLERS REPORTE POR CATEGORÍA
    // ============================================

    const handleGenerarCategoriaPDF = async () => {
        setLoading(prev => ({ ...prev, categoriaPdf: true }));
        setError(null);

        try {
            await marketingService.descargarReporteCategoriaPDF(usuarioSeleccionado, periodo);
        } catch (err) {
            console.error('Error generando PDF por categoría:', err);
            setError(err.message || 'Error al generar reporte PDF por categoría');
        } finally {
            setLoading(prev => ({ ...prev, categoriaPdf: false }));
        }
    };

    const handleGenerarCategoriaExcel = async () => {
        setLoading(prev => ({ ...prev, categoriaExcel: true }));
        setError(null);

        try {
            await marketingService.descargarReporteCategoriaExcel(usuarioSeleccionado, periodo);
        } catch (err) {
            console.error('Error generando Excel por categoría:', err);
            setError(err.message || 'Error al generar reporte Excel por categoría');
        } finally {
            setLoading(prev => ({ ...prev, categoriaExcel: false }));
        }
    };

    // ============================================
    // HANDLERS REPORTE DE EQUIPO
    // ============================================

    const handleGenerarEquipoPDF = async () => {
        setLoading(prev => ({ ...prev, equipoPdf: true }));
        setError(null);

        try {
            await marketingService.descargarReporteEquipoPDF(periodo);
        } catch (err) {
            console.error('Error generando PDF de equipo:', err);
            setError(err.message || 'Error al generar reporte PDF de equipo');
        } finally {
            setLoading(prev => ({ ...prev, equipoPdf: false }));
        }
    };

    const handleGenerarEquipoExcel = async () => {
        setLoading(prev => ({ ...prev, equipoExcel: true }));
        setError(null);

        try {
            await marketingService.descargarReporteEquipoExcel(periodo);
        } catch (err) {
            console.error('Error generando Excel de equipo:', err);
            setError(err.message || 'Error al generar reporte Excel de equipo');
        } finally {
            setLoading(prev => ({ ...prev, equipoExcel: false }));
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">📄 Reportes Corporativos</h2>
                <p className="text-gray-600 text-sm mt-1">
                    Generación de documentos profesionales en PDF y Excel
                </p>
            </div>

            {/* Controles de filtros */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">⚙️ Configuración del Reporte</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Selector de usuario (solo para jefes/ejecutivos) */}
                    {puedeVerOtros && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Usuario:
                            </label>
                            <select
                                value={usuarioSeleccionado}
                                onChange={(e) => setUsuarioSeleccionado(parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value={user.id}>Mis reportes</option>
                                {equipoMarketing
                                    .filter(m => ['MARKETING_EJECUTOR', 'JEFE_MARKETING'].includes(m.rol))
                                    .map(miembro => (
                                        <option key={miembro.id} value={miembro.id}>
                                            {miembro.nombre} {miembro.apellido} - {miembro.rol}
                                        </option>
                                    ))
                                }
                            </select>
                        </div>
                    )}

                    {/* Selector de período */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Período:
                        </label>
                        <select
                            value={periodo}
                            onChange={(e) => setPeriodo(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="hoy">Hoy</option>
                            <option value="semana_actual">Semana Actual</option>
                            <option value="mes_actual">Mes Actual</option>
                            <option value="mes_pasado">Mes Pasado</option>
                            <option value="trimestre_actual">Trimestre Actual</option>
                            <option value="anio_actual">Año Actual</option>
                        </select>
                    </div>
                </div>

                {/* Mensaje de error */}
                {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">❌ {error}</p>
                    </div>
                )}
            </div>

            {/* Reporte de Productividad Personal */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow-lg p-6 border border-green-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-3xl">📊</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Reporte de Productividad Personal</h3>
                        <p className="text-sm text-gray-600">Calidad Corporativa Superior</p>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700 mb-2">
                        <strong>📋 Incluye:</strong>
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                        <li>• Resumen ejecutivo con KPIs visuales</li>
                        <li>• Análisis detallado de tiempo (planeado vs real)</li>
                        <li>• Distribución por categorías con gráficos</li>
                        <li>• Detección de problemas y recomendaciones</li>
                        <li>• Top 3 categorías con mayor inversión de tiempo</li>
                        <li>• Evaluación de eficiencia y cumplimiento</li>
                    </ul>
                </div>

                {/* Botones de acción */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                        onClick={handleVerPreview}
                        disabled={loading.preview}
                        className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                    >
                        {loading.preview ? '⏳ Cargando...' : '👁️ Ver Preview'}
                    </button>

                    <button
                        onClick={handleGenerarPDF}
                        disabled={loading.pdf}
                        className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                    >
                        {loading.pdf ? '⏳ Generando...' : '📄 Descargar PDF'}
                    </button>

                    <button
                        onClick={handleGenerarExcel}
                        disabled={loading.excel}
                        className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                    >
                        {loading.excel ? '⏳ Generando...' : '📗 Descargar Excel'}
                    </button>
                </div>
            </div>

            {/* Reporte por Categorías - ACTIVO */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow-lg p-6 border border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-3xl">🎯</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Reporte por Categoría</h3>
                        <p className="text-sm text-gray-600">Distribución de Trabajo</p>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700 mb-2">
                        <strong>📋 Incluye:</strong>
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                        <li>• Totales de actividades por estado</li>
                        <li>• Distribución por categoría y subcategoría</li>
                        <li>• Tasas de completitud</li>
                        <li>• Tiempos totales y promedios por categoría</li>
                        <li>• Listado completo de actividades detalladas</li>
                    </ul>
                </div>

                {/* Botones de acción */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                        onClick={handleGenerarCategoriaPDF}
                        disabled={loading.categoriaPdf}
                        className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                    >
                        {loading.categoriaPdf ? '⏳ Generando...' : '📄 Descargar PDF'}
                    </button>

                    <button
                        onClick={handleGenerarCategoriaExcel}
                        disabled={loading.categoriaExcel}
                        className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                    >
                        {loading.categoriaExcel ? '⏳ Generando...' : '📗 Descargar Excel'}
                    </button>
                </div>
            </div>

            {/* Reporte de Equipo - Solo para jefes/ejecutivos */}
            {puedeVerOtros && (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg shadow-lg p-6 border border-orange-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-3xl">👥</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Reporte Consolidado de Equipo</h3>
                            <p className="text-sm text-gray-600">Métricas Generales del Equipo</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 mb-4">
                        <p className="text-sm text-gray-700 mb-2">
                            <strong>📋 Incluye:</strong>
                        </p>
                        <ul className="text-sm text-gray-600 space-y-1 ml-4">
                            <li>• Resumen general del equipo de marketing</li>
                            <li>• Ranking de miembros por tasa de completitud</li>
                            <li>• Estadísticas consolidadas de actividades</li>
                            <li>• Tiempo total invertido por el equipo</li>
                            <li>• Detalle completo por cada miembro</li>
                            <li>• Promedios y métricas del equipo</li>
                        </ul>
                    </div>

                    {/* Botones de acción */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                            onClick={handleGenerarEquipoPDF}
                            disabled={loading.equipoPdf}
                            className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                        >
                            {loading.equipoPdf ? '⏳ Generando...' : '📄 Descargar PDF'}
                        </button>

                        <button
                            onClick={handleGenerarEquipoExcel}
                            disabled={loading.equipoExcel}
                            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                        >
                            {loading.equipoExcel ? '⏳ Generando...' : '📗 Descargar Excel'}
                        </button>
                    </div>
                </div>
            )}

            {/* Reporte Mensual (próximamente) */}
            <div className="bg-white rounded-lg shadow-lg p-6 opacity-60">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">📅</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Mensual</h3>
                        <p className="text-sm text-gray-500">Resumen del mes</p>
                    </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                    Reporte ejecutivo con el resumen del mes completo.
                </p>
                <button
                    disabled
                    className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                >
                    Próximamente
                </button>
            </div>

            {/* Modal de Preview */}
            {mostrarPreview && datosPreview && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-4xl max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-gray-900">
                                📊 Preview - Reporte de Productividad
                            </h3>
                            <button
                                onClick={() => setMostrarPreview(false)}
                                className="text-gray-500 hover:text-gray-700 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {/* Información del usuario */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                            <p className="text-sm"><strong>Usuario:</strong> {datosPreview.usuario.nombre_completo}</p>
                            <p className="text-sm"><strong>Email:</strong> {datosPreview.usuario.email}</p>
                            <p className="text-sm"><strong>Período:</strong> {datosPreview.periodo.descripcion}</p>
                        </div>

                        {/* KPIs principales */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white text-center">
                                <div className="text-3xl font-bold">{datosPreview.metricas.totales.total}</div>
                                <div className="text-sm mt-1">Actividades</div>
                            </div>
                            <div className={`rounded-lg p-4 text-white text-center ${datosPreview.metricas.tasas.completitud >= 80 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'}`}>
                                <div className="text-3xl font-bold">{datosPreview.metricas.tasas.completitud}%</div>
                                <div className="text-sm mt-1">Completitud</div>
                            </div>
                            <div className={`rounded-lg p-4 text-white text-center ${datosPreview.metricas.tasas.eficiencia <= 100 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-amber-500 to-amber-600'}`}>
                                <div className="text-3xl font-bold">{datosPreview.metricas.tasas.eficiencia}%</div>
                                <div className="text-sm mt-1">Eficiencia</div>
                            </div>
                            <div className={`rounded-lg p-4 text-white text-center ${datosPreview.metricas.tasas.vencimiento < 5 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'}`}>
                                <div className="text-3xl font-bold">{datosPreview.metricas.tasas.vencimiento}%</div>
                                <div className="text-sm mt-1">Vencimiento</div>
                            </div>
                        </div>

                        {/* Desglose */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="font-semibold text-gray-900 mb-2">📋 Desglose por Estado:</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                <div>✅ Completadas: <strong>{datosPreview.metricas.totales.completadas}</strong></div>
                                <div>🔄 En Progreso: <strong>{datosPreview.metricas.totales.en_progreso}</strong></div>
                                <div>⏳ Pendientes: <strong>{datosPreview.metricas.totales.pendientes}</strong></div>
                                <div>❌ Canceladas: <strong>{datosPreview.metricas.totales.canceladas}</strong></div>
                            </div>
                        </div>

                        {/* Top Categorías */}
                        {datosPreview.categorias && datosPreview.categorias.length > 0 && (
                            <div className="bg-purple-50 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-900 mb-2">🏆 Top 3 Categorías:</h4>
                                {datosPreview.categorias.slice(0, 3).map((cat, idx) => (
                                    <div key={idx} className="text-sm mb-1">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {cat.categoria_principal}: {cat.cantidad} actividades
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => setMostrarPreview(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={() => {
                                    setMostrarPreview(false);
                                    handleGenerarPDF();
                                }}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                📄 Generar PDF
                            </button>
                            <button
                                onClick={() => {
                                    setMostrarPreview(false);
                                    handleGenerarExcel();
                                }}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                                📗 Generar Excel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportesMarketing;
