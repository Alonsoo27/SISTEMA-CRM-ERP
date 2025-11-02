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
    async completarActividad(id) {
        const response = await apiClient.post(`/marketing/actividades/${id}/completar`);
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
        const response = await apiClient.get(`/marketing/actividades-vencidas/${usuarioId}/detectar`);
        return response.data;
    },

    /**
     * Detectar actividades próximas a vencer (notificaciones preventivas)
     * @param {number} usuarioId - ID del usuario
     * @param {number} minutosAntes - Minutos antes del vencimiento (por defecto 15)
     */
    async detectarActividadesProximasVencer(usuarioId, minutosAntes = 15) {
        const response = await apiClient.get(`/marketing/actividades-proximas-vencer/${usuarioId}/detectar`, {
            params: { minutosAntes }
        });
        return response.data;
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
    }
};

export default marketingService;
