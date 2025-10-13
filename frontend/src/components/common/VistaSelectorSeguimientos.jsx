// src/components/common/VistaSelectorSeguimientos.jsx
import React, { useState, useEffect } from 'react';
import { Users, User, ChevronDown, Eye } from 'lucide-react';
import prospectosService from '../../services/prospectosService';
import apiClient from '../../services/apiClient';

/**
 * Selector de Vista para Seguimientos
 * Permite a ejecutivos alternar entre vista global y vistas específicas de asesores
 */
const VistaSelectorSeguimientos = ({
  usuarioActual,
  onVistaChange,
  vistaActual = null
}) => {
  const [asesores, setAsesores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostrarMenu, setMostrarMenu] = useState(false);

  // Verificar si el usuario puede cambiar de vista
  const puedeVerOtrasVistas = () => {
    if (!usuarioActual) return false;
    const rolesEjecutivos = ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'JEFE_VENTAS', 'SUPERVISOR'];
    const rolNombre = typeof usuarioActual.rol === 'string'
      ? usuarioActual.rol
      : usuarioActual.rol?.nombre || '';
    return rolesEjecutivos.includes(rolNombre.toUpperCase()) || usuarioActual.es_jefe;
  };

  // Cargar lista de asesores disponibles
  useEffect(() => {
    if (puedeVerOtrasVistas()) {
      cargarAsesores();
    }
  }, [usuarioActual]);

  const cargarAsesores = async () => {
    try {
      setLoading(true);
      // 🎯 USAR LA RUTA OPTIMIZADA DE VENDEDORES CON API CLIENT
      const data = await apiClient.get('/usuarios/vendedores');

      if (data.success) {
        // Ya viene filtrado del backend, solo asegurarse de que estén activos
        const vendedores = data.data.filter(u => u.activo);
        setAsesores(vendedores);
      }
    } catch (error) {
      console.error('Error cargando asesores:', error);
      console.warn('Usuario no tiene permisos para ver vendedores. Intentando con ruta alternativa...');

      // Fallback: intentar con la ruta general si tiene permisos
      try {
        const dataAlt = await apiClient.get('/usuarios');
        if (dataAlt.success) {
          const vendedores = dataAlt.data.filter(u =>
            u.activo && (u.rol_id === 7 || u.vende === true)
          );
          setAsesores(vendedores);
        }
      } catch (fallbackError) {
        console.error('Error en fallback:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCambioVista = (asesorId) => {
    onVistaChange(asesorId);
    setMostrarMenu(false);
  };

  // Si el usuario no puede cambiar de vista, no mostrar nada
  if (!puedeVerOtrasVistas()) {
    return null;
  }

  // Obtener nombre de la vista actual
  const getNombreVistaActual = () => {
    if (vistaActual === null) return 'Vista Global';
    if (vistaActual === usuarioActual?.id) return 'Mi Vista Personal';
    const asesor = asesores.find(a => a.id === vistaActual);
    return asesor ? `${asesor.nombre} ${asesor.apellido}` : 'Vista Específica';
  };

  return (
    <div className="relative z-[100]">
      <button
        onClick={() => setMostrarMenu(!mostrarMenu)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm relative z-[100]"
      >
        <Eye className="h-4 w-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {getNombreVistaActual()}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${mostrarMenu ? 'rotate-180' : ''}`} />
      </button>

      {/* Menú desplegable */}
      {mostrarMenu && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-[100] max-h-96 overflow-y-auto">
          {/* Vista Global */}
          <button
            onClick={() => handleCambioVista(null)}
            className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 ${
              vistaActual === null ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
            }`}
          >
            <Users className="h-5 w-5 text-blue-600" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Vista Global</p>
              <p className="text-xs text-gray-500">Todos los seguimientos</p>
            </div>
          </button>

          {/* Mi Vista Personal */}
          <button
            onClick={() => handleCambioVista(usuarioActual?.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-green-50 transition-colors border-b border-gray-100 ${
              vistaActual === usuarioActual?.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
            }`}
          >
            <User className="h-5 w-5 text-green-600" />
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900">Mi Vista Personal</p>
              <p className="text-xs text-gray-500">Solo mis seguimientos</p>
            </div>
          </button>

          {/* Divider */}
          {asesores.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase">Otros Asesores</p>
            </div>
          )}

          {/* Lista de Asesores */}
          {loading ? (
            <div className="px-4 py-3 text-center text-sm text-gray-500">
              Cargando asesores...
            </div>
          ) : (
            asesores
              .filter(a => a.id !== usuarioActual?.id) // Excluir usuario actual
              .map(asesor => (
                <button
                  key={asesor.id}
                  onClick={() => handleCambioVista(asesor.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                    vistaActual === asesor.id ? 'bg-purple-50 border-l-4 border-l-purple-500' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {asesor.nombre?.charAt(0)}{asesor.apellido?.charAt(0)}
                    </span>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {asesor.nombre} {asesor.apellido}
                    </p>
                    <p className="text-xs text-gray-500">{asesor.email}</p>
                  </div>
                </button>
              ))
          )}

          {!loading && asesores.filter(a => a.id !== usuarioActual?.id).length === 0 && (
            <div className="px-4 py-3 text-center text-sm text-gray-500">
              No hay otros asesores disponibles
            </div>
          )}
        </div>
      )}

      {/* Overlay para cerrar menú */}
      {mostrarMenu && (
        <div
          className="fixed inset-0 z-[90]"
          onClick={() => setMostrarMenu(false)}
        />
      )}
    </div>
  );
};

export default VistaSelectorSeguimientos;
