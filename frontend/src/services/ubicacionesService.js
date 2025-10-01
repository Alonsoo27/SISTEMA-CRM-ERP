const API_BASE_URL = 'http://localhost:3001/api';

class UbicacionesService {
  // Obtener todos los departamentos
  async getDepartamentos() {
    try {
      const response = await fetch(`${API_BASE_URL}/ubicaciones/departamentos`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Error obteniendo departamentos');
      }

      return data.departamentos;
    } catch (error) {
      console.error('Error en getDepartamentos:', error);
      throw error;
    }
  }

  // Obtener provincias por departamento
  async getProvinciasByDepartamento(departamento) {
    try {
      if (!departamento) {
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/ubicaciones/provincias/${encodeURIComponent(departamento)}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Error obteniendo provincias');
      }

      return data.provincias;
    } catch (error) {
      console.error('Error en getProvinciasByDepartamento:', error);
      throw error;
    }
  }

  // Obtener distritos por departamento y provincia
  async getDistritosByProvincia(departamento, provincia) {
    try {
      if (!departamento || !provincia) {
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/ubicaciones/distritos/${encodeURIComponent(departamento)}/${encodeURIComponent(provincia)}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Error obteniendo distritos');
      }

      return data.distritos;
    } catch (error) {
      console.error('Error en getDistritosByProvincia:', error);
      throw error;
    }
  }

  // Validar una ubicación específica
  async validarUbicacion(departamento, provincia = null, distrito = null) {
    try {
      const params = new URLSearchParams({ departamento });
      if (provincia) params.append('provincia', provincia);
      if (distrito) params.append('distrito', distrito);

      const response = await fetch(`${API_BASE_URL}/ubicaciones/validar?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Error validando ubicación');
      }

      return data.existe;
    } catch (error) {
      console.error('Error en validarUbicacion:', error);
      throw error;
    }
  }

  // Buscar ubicaciones (para autocompletado)
  async buscarUbicaciones(termino, tipo = null) {
    try {
      if (!termino || termino.length < 2) {
        return [];
      }

      const params = new URLSearchParams({ termino });
      if (tipo) params.append('tipo', tipo);

      const response = await fetch(`${API_BASE_URL}/ubicaciones/buscar?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Error buscando ubicaciones');
      }

      return data.resultados;
    } catch (error) {
      console.error('Error en buscarUbicaciones:', error);
      throw error;
    }
  }

  // Obtener jerarquía completa (para casos especiales)
  async getJerarquiaCompleta() {
    try {
      const response = await fetch(`${API_BASE_URL}/ubicaciones/jerarquia`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Error obteniendo jerarquía');
      }

      return data.jerarquia;
    } catch (error) {
      console.error('Error en getJerarquiaCompleta:', error);
      throw error;
    }
  }
}

// Instancia singleton del servicio
const ubicacionesService = new UbicacionesService();

export default ubicacionesService;