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
     * Cancelar actividad
     */
    async cancelarActividad(id, motivo) {
        const response = await apiClient.delete(`/marketing/actividades/${id}`, {
            data: { motivo }
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
    }
};

export default marketingService;
