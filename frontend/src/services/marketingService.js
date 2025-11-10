// ============================================
// SERVICIO API - MARKETING
// ============================================

import apiClient from './apiClient';

const marketingService = {
    // ============================================
    // TIPOS DE ACTIVIDADES
    // ============================================

    /**
     * Obtener todos los tipos de actividades
     */
    async obtenerTipos() {
        const response = await apiClient.get('/marketing/tipos');
        return response.data;
    },

    /**
     * Obtener categorías principales
     */
    async obtenerCategorias() {
        const response = await apiClient.get('/marketing/tipos/categorias');
        return response.data;
    },

    /**
     * Obtener subcategorías por categoría
     */
    async obtenerSubcategorias(categoria_principal) {
        const response = await apiClient.get(`/marketing/tipos/categorias/${categoria_principal}`);
        return response.data;
    },

    // ============================================
    // ACTIVIDADES
    // ============================================

    /**
     * Listar actividades con filtros
     */
    async listarActividades(filtros = {}) {
        const params = new URLSearchParams(filtros).toString();
        const response = await apiClient.get(`/marketing/actividades?${params}`);
        return response.data;
    },

    /**
     * Obtener actividad por ID
     */
    async obtenerActividad(id) {
        const response = await apiClient.get(`/marketing/actividades/${id}`);
        return response.data;
    },

    /**
     * Crear actividad individual
     */
    async crearActividad(datos) {
        const response = await apiClient.post('/marketing/actividades', datos);
        return response.data;
    },

    /**
     * Crear actividad grupal
     */
    async crearActividadGrupal(datos) {
        const response = await apiClient.post('/marketing/actividades/grupal', datos);
        return response.data;
    },

    /**
     * Editar actividad
     */
    async editarActividad(id, datos) {
        const response = await apiClient.put(`/marketing/actividades/${id}`, datos);
        return response.data;
    },

    /**
     * Extender tiempo de actividad
     */
    async extenderActividad(id, minutos_adicionales, motivo) {
        const response = await apiClient.post(`/marketing/actividades/${id}/extender`, {
            minutos_adicionales,
            motivo
        });
        return response.data;
    },

    /**
     * Completar actividad
     */
    async completarActividad(id, completarTodosParticipantes = false) {
        const response = await apiClient.post(`/marketing/actividades/${id}/completar`, {
            completar_todos_participantes: completarTodosParticipantes
        });
        return response.data;
    },

    /**
     * Analizar optimización de calendario
     * Retorna qué actividades se adelantarían al cancelar
     */
    async analizarOptimizacion(id) {
        const response = await apiClient.get(`/marketing/actividades/${id}/analizar-optimizacion`);
        return response.data;
    },

    /**
     * Cancelar actividad
     */
    async cancelarActividad(id, motivo, optimizarCalendario = false) {
        const response = await apiClient.delete(`/marketing/actividades/${id}`, {
            data: {
                motivo,
                optimizar_calendario: optimizarCalendario
            }
        });
        return response.data;
    },

    // ============================================
    // VISTAS DE CALENDARIO
    // ============================================

    /**
     * Vista semanal
     */
    async vistaSemanal(usuario_id = null, fecha_inicio = null) {
        const params = {};
        if (usuario_id) params.usuario_id = usuario_id;
        if (fecha_inicio) params.fecha_inicio = fecha_inicio;

        const queryString = new URLSearchParams(params).toString();
        const response = await apiClient.get(`/marketing/calendario/semanal?${queryString}`);
        return response.data;
    },

    /**
     * Vista mensual
     */
    async vistaMensual(usuario_id = null, mes = null, anio = null) {
        const params = {};
        if (usuario_id) params.usuario_id = usuario_id;
        if (mes) params.mes = mes;
        if (anio) params.anio = anio;

        const queryString = new URLSearchParams(params).toString();
        const response = await apiClient.get(`/marketing/calendario/mensual?${queryString}`);
        return response.data;
    },

    /**
     * Vista trimestral
     */
    async vistaTrimestral(usuario_id = null, trimestre = null, anio = null) {
        const params = {};
        if (usuario_id) params.usuario_id = usuario_id;
        if (trimestre) params.trimestre = trimestre;
        if (anio) params.anio = anio;

        const queryString = new URLSearchParams(params).toString();
        const response = await apiClient.get(`/marketing/calendario/trimestral?${queryString}`);
        return response.data;
    },

    /**
     * Vista anual
     */
    async vistaAnual(usuario_id = null, anio = null) {
        const params = {};
        if (usuario_id) params.usuario_id = usuario_id;
        if (anio) params.anio = anio;

        const queryString = new URLSearchParams(params).toString();
        const response = await apiClient.get(`/marketing/calendario/anual?${queryString}`);
        return response.data;
    },

    // ============================================
    // TRANSFERENCIAS Y AUSENCIAS
    // ============================================

    /**
     * Transferir actividad
     */
    async transferirActividad(datos) {
        const response = await apiClient.post('/marketing/transferencias', datos);
        return response.data;
    },

    /**
     * Registrar ausencia
     */
    async registrarAusencia(datos) {
        const response = await apiClient.post('/marketing/ausencias', datos);
        return response.data;
    },

    /**
     * Listar ausencias
     */
    async listarAusencias(filtros = {}) {
        const params = new URLSearchParams(filtros).toString();
        const response = await apiClient.get(`/marketing/ausencias?${params}`);
        return response.data;
    },

    // ============================================
    // EQUIPO DE MARKETING
    // ============================================

    /**
     * Obtener equipo de marketing (usuarios del área)
     */
    async obtenerEquipoMarketing() {
        const response = await apiClient.get('/usuarios/marketing');
        return response.data;
    },

    // ============================================
    // CARGA MASIVA
    // ============================================

    /**
     * Descargar plantilla Excel
     */
    async descargarPlantilla() {
        const response = await fetch(`${apiClient.baseURL}/marketing/carga-masiva/plantilla`, {
            method: 'GET',
            headers: apiClient.getHeaders()
        });

        if (!response.ok) {
            throw new Error('Error al descargar plantilla');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Plantilla_Actividades_Marketing.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    },

    /**
     * Procesar carga masiva de actividades
     */
    async procesarCargaMasiva(archivo) {
        const formData = new FormData();
        formData.append('archivo', archivo);

        const response = await fetch(`${apiClient.baseURL}/marketing/carga-masiva`, {
            method: 'POST',
            headers: {
                'Authorization': apiClient.getHeaders()['Authorization']
                // No incluir Content-Type, el browser lo configura automáticamente con boundary
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw data;
        }

        return data;
    },

    // ============================================
    // INDICADORES Y MÉTRICAS
    // ============================================

    /**
     * Obtener indicadores de rendimiento individual
     */
    async obtenerIndicadoresIndividual(usuarioId, periodo = 'mes_actual') {
        const response = await apiClient.get(`/marketing/indicadores/individual/${usuarioId}?periodo=${periodo}`);
        return response.data;
    },

    /**
     * Obtener análisis de tiempo (real vs planeado)
     */
    async obtenerAnalisisTiempo(usuarioId, periodo = 'mes_actual') {
        const response = await apiClient.get(`/marketing/indicadores/tiempo/${usuarioId}?periodo=${periodo}`);
        return response.data;
    },

    /**
     * Obtener indicadores del equipo
     */
    async obtenerIndicadoresEquipo(periodo = 'mes_actual') {
        const response = await apiClient.get(`/marketing/indicadores/equipo?periodo=${periodo}`);
        return response.data;
    },

    /**
     * Obtener análisis por categoría
     */
    async obtenerAnalisisCategorias(periodo = 'mes_actual', usuarioId = null) {
        let url = `/marketing/indicadores/categorias?periodo=${periodo}`;
        if (usuarioId) {
            url += `&usuarioId=${usuarioId}`;
        }
        const response = await apiClient.get(url);
        return response.data;
    },

    // ============================================
    // NOTIFICACIONES Y ALERTAS
    // ============================================

    /**
     * Obtener actividades vencidas de un usuario
     */
    async obtenerActividadesVencidas(usuarioId) {
        const response = await apiClient.get(`/marketing/actividades-vencidas/${usuarioId}`);
        return response.data;
    },

    /**
     * Detectar actividades que requieren gestión inmediata
     * Retorna actividades vencidas clasificadas por ventana de tiempo
     */
    async detectarActividadesVencidas(usuarioId) {
        try {
            const response = await apiClient.get(`/marketing/actividades-vencidas/${usuarioId}/detectar`);
            return response;
        } catch (error) {
            console.error('Error en detectarActividadesVencidas:', error);
            return {
                success: false,
                message: error.message || 'Error al detectar actividades vencidas',
                actividades: [],
                total: 0
            };
        }
    },

    /**
     * Detectar actividades próximas a vencer (notificaciones preventivas)
     * @param {number} usuarioId - ID del usuario
     * @param {number} minutosAntes - Minutos antes del vencimiento (por defecto 15)
     */
    async detectarActividadesProximasVencer(usuarioId, minutosAntes = 15) {
        try {
            const response = await apiClient.get(`/marketing/actividades-proximas-vencer/${usuarioId}/detectar`, {
                params: { minutosAntes }
            });
            return response;
        } catch (error) {
            console.error('Error en detectarActividadesProximasVencer:', error);
            return {
                success: false,
                message: error.message || 'Error al detectar actividades próximas a vencer',
                actividades: [],
                total: 0
            };
        }
    },

    /**
     * Gestionar actividad vencida con una acción específica
     * @param {number} actividadId - ID de la actividad vencida
     * @param {string} accion - completar, extender, posponer, completar_retroactivo, reprogramar, completar_fuera_tiempo, cancelar
     * @param {object} datos - Datos adicionales según la acción (minutos_adicionales, motivo, hora_fin_real, etc)
     */
    async gestionarActividadVencida(actividadId, accion, datos) {
        const response = await apiClient.post(`/marketing/actividades/${actividadId}/gestionar-vencida`, {
            accion,
            datos
        });
        return response.data;
    },

    /**
     * Procesar huecos pendientes del día
     */
    async procesarHuecosPendientes(usuarioId, fechaReferencia = null) {
        const datos = fechaReferencia ? { fecha_referencia: fechaReferencia } : {};
        const response = await apiClient.post(`/marketing/procesar-huecos/${usuarioId}`, datos);
        return response.data;
    },

    // ============================================
    // REPORTES CORPORATIVOS
    // ============================================

    /**
     * Obtener datos para reporte de productividad (JSON)
     */
    async obtenerDatosReporteProductividad(usuarioId, periodoConfig = 'mes_actual') {
        const params = this._construirParamsPeriodo(periodoConfig);
        const response = await apiClient.get(`/marketing/reportes/productividad/${usuarioId}/datos`, {
            params
        });
        return response.data;
    },

    /**
     * Descargar reporte de productividad en PDF
     */
    async descargarReporteProductividadPDF(usuarioId, periodoConfig = 'mes_actual') {
        const params = this._construirParamsPeriodo(periodoConfig);
        const url = this._construirURLConParams(
            `${apiClient.baseURL}/marketing/reportes/productividad/${usuarioId}/pdf`,
            params
        );

        const response = await fetch(url, {
            method: 'GET',
            headers: apiClient.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw error;
        }

        const blob = await response.blob();
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = `Reporte_Productividad_${params.periodo}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(urlBlob);
    },

    /**
     * Descargar reporte de productividad en Excel
     */
    async descargarReporteProductividadExcel(usuarioId, periodoConfig = 'mes_actual') {
        const params = this._construirParamsPeriodo(periodoConfig);
        const url = this._construirURLConParams(
            `${apiClient.baseURL}/marketing/reportes/productividad/${usuarioId}/excel`,
            params
        );

        const response = await fetch(url, {
            method: 'GET',
            headers: apiClient.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw error;
        }

        const blob = await response.blob();
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = `Reporte_Productividad_${params.periodo}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(urlBlob);
    },

    // ============================================
    // HELPERS PARA PERÍODOS
    // ============================================

    /**
     * Construir query params para períodos (soporta rangos personalizados)
     */
    _construirParamsPeriodo(periodoConfig) {
        // Si es un string simple, usar como periodo
        if (typeof periodoConfig === 'string') {
            return { periodo: periodoConfig };
        }

        // Si es un objeto con tipo, fechaInicio, fechaFin
        const params = { periodo: periodoConfig.tipo || 'mes_actual' };

        if (periodoConfig.tipo === 'custom' && periodoConfig.fechaInicio && periodoConfig.fechaFin) {
            params.fechaInicio = periodoConfig.fechaInicio;
            params.fechaFin = periodoConfig.fechaFin;
        }

        return params;
    },

    /**
     * Construir URL con query params
     */
    _construirURLConParams(baseURL, params) {
        const searchParams = new URLSearchParams(params);
        return `${baseURL}?${searchParams.toString()}`;
    },

    /**
     * Generar nombre de archivo dinámico
     */
    _generarNombreArchivo(tipoReporte, periodoConfig, extension, usuarioId = null) {
        const fecha = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Descripción del período
        let descripcionPeriodo = '';
        if (typeof periodoConfig === 'string') {
            descripcionPeriodo = periodoConfig.replace(/_/g, '-');
        } else if (periodoConfig.descripcion) {
            descripcionPeriodo = periodoConfig.descripcion.replace(/\s+/g, '_').replace(/[()]/g, '');
        } else if (periodoConfig.tipo) {
            descripcionPeriodo = periodoConfig.tipo.replace(/_/g, '-');
        }

        // Construir nombre
        const partes = ['Reporte', tipoReporte];
        if (usuarioId) {
            partes.push(`User${usuarioId}`);
        }
        partes.push(descripcionPeriodo, fecha);

        return `${partes.join('_')}.${extension}`;
    },

    // ============================================
    // REPORTES POR CATEGORÍA
    // ============================================

    /**
     * Obtener datos para reporte por categoría (JSON)
     */
    async obtenerDatosReporteCategoria(usuarioId, periodoConfig = 'mes_actual') {
        const params = this._construirParamsPeriodo(periodoConfig);
        const response = await apiClient.get(`/marketing/reportes/categoria/${usuarioId}/datos`, {
            params
        });
        return response.data;
    },

    /**
     * Descargar reporte por categoría en PDF
     */
    async descargarReporteCategoriaPDF(usuarioId, periodoConfig = 'mes_actual') {
        const params = this._construirParamsPeriodo(periodoConfig);
        const url = this._construirURLConParams(
            `${apiClient.baseURL}/marketing/reportes/categoria/${usuarioId}/pdf`,
            params
        );

        const response = await fetch(url, {
            method: 'GET',
            headers: apiClient.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw error;
        }

        const blob = await response.blob();
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = `Reporte_Categoria_${params.periodo}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(urlBlob);
    },

    /**
     * Descargar reporte por categoría en Excel
     */
    async descargarReporteCategoriaExcel(usuarioId, periodoConfig = 'mes_actual') {
        const params = this._construirParamsPeriodo(periodoConfig);
        const url = this._construirURLConParams(
            `${apiClient.baseURL}/marketing/reportes/categoria/${usuarioId}/excel`,
            params
        );

        const response = await fetch(url, {
            method: 'GET',
            headers: apiClient.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw error;
        }

        const blob = await response.blob();
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = `Reporte_Categoria_${params.periodo}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(urlBlob);
    },

    // ============================================
    // REPORTES DE EQUIPO
    // ============================================

    /**
     * Obtener datos para reporte de equipo (JSON)
     */
    async obtenerDatosReporteEquipo(periodoConfig = 'mes_actual') {
        const params = this._construirParamsPeriodo(periodoConfig);
        const response = await apiClient.get(`/marketing/reportes/equipo/datos`, {
            params
        });
        return response.data;
    },

    /**
     * Descargar reporte de equipo en PDF
     */
    async descargarReporteEquipoPDF(periodoConfig = 'mes_actual') {
        const params = this._construirParamsPeriodo(periodoConfig);
        const url = this._construirURLConParams(
            `${apiClient.baseURL}/marketing/reportes/equipo/pdf`,
            params
        );

        const response = await fetch(url, {
            method: 'GET',
            headers: apiClient.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw error;
        }

        const blob = await response.blob();
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = `Reporte_Equipo_${params.periodo}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(urlBlob);
    },

    /**
     * Descargar reporte de equipo en Excel
     */
    async descargarReporteEquipoExcel(periodoConfig = 'mes_actual') {
        const params = this._construirParamsPeriodo(periodoConfig);
        const url = this._construirURLConParams(
            `${apiClient.baseURL}/marketing/reportes/equipo/excel`,
            params
        );

        const response = await fetch(url, {
            method: 'GET',
            headers: apiClient.getHeaders()
        });

        if (!response.ok) {
            const error = await response.json();
            throw error;
        }

        const blob = await response.blob();
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = `Reporte_Equipo_${params.periodo}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(urlBlob);
    }
};

export default marketingService;
