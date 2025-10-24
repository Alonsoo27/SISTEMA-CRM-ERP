// ============================================
// REPORTES DE MARKETING
// Exportación y generación de reportes
// ============================================

const ReportesMarketing = ({ usuarioId, esJefe }) => {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">📄 Reportes</h2>
                <p className="text-gray-600 text-sm mt-1">
                    Exportación y generación de documentos
                </p>
            </div>

            {/* Tipos de reportes disponibles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Reporte de Actividades */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">📋</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Actividades</h3>
                            <p className="text-sm text-gray-500">Listado detallado</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        Exporta el listado completo de actividades con todos sus detalles.
                    </p>
                    <button
                        disabled
                        className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                    >
                        Próximamente
                    </button>
                </div>

                {/* Reporte de Productividad */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">📊</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Productividad</h3>
                            <p className="text-sm text-gray-500">Métricas de rendimiento</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        Genera un reporte con estadísticas de productividad y eficiencia.
                    </p>
                    <button
                        disabled
                        className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                    >
                        Próximamente
                    </button>
                </div>

                {/* Reporte por Categorías */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">🎯</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Por Categoría</h3>
                            <p className="text-sm text-gray-500">Distribución de trabajo</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        Análisis del tiempo invertido por tipo de actividad.
                    </p>
                    <button
                        disabled
                        className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                    >
                        Próximamente
                    </button>
                </div>

                {/* Reporte de Equipo */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">👥</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Equipo</h3>
                            <p className="text-sm text-gray-500">Consolidado general</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        Reporte consolidado de todo el equipo de marketing.
                    </p>
                    <button
                        disabled
                        className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                    >
                        Próximamente
                    </button>
                </div>

                {/* Reporte Mensual */}
                <div className="bg-white rounded-lg shadow-lg p-6">
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

                {/* Exportar a Excel */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">📗</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Excel</h3>
                            <p className="text-sm text-gray-500">Exportación completa</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        Exporta todos los datos a un archivo Excel personalizado.
                    </p>
                    <button
                        disabled
                        className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                    >
                        Próximamente
                    </button>
                </div>
            </div>

            {/* Nota informativa */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">📝</span>
                    <div>
                        <h4 className="font-semibold text-amber-900 mb-1">Reportes en desarrollo</h4>
                        <p className="text-sm text-amber-800">
                            El módulo de reportes está en construcción. Pronto podrás generar:
                        </p>
                        <ul className="text-sm text-amber-800 mt-2 space-y-1 ml-4">
                            <li>• Reportes en PDF con gráficos y estadísticas</li>
                            <li>• Exportación masiva a Excel</li>
                            <li>• Reportes personalizados por período</li>
                            <li>• Envío automático de reportes por email</li>
                            <li>• Programación de reportes recurrentes</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportesMarketing;
