// src/pages/ProspectosPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus, BarChart3, List, Users, Filter, Download,
  RefreshCw, Settings, Search, Calendar, AlertCircle,
  CheckCircle, XCircle, Bell, Zap, Grid
} from 'lucide-react';

import KanbanBoard from '../components/prospectos/KanbanBoard/KanbanBoard';
import ProspectoForm from '../components/prospectos/ProspectoForm/ProspectoForm';
import ProspectoDetailsView from '../components/prospectos/ProspectoDetailsView';
import ProspectoList from '../components/prospectos/ProspectoList/ProspectoList';
import KanbanFilters from '../components/prospectos/KanbanFilters/KanbanFilters';
import AnalyticsEnterprise from '../components/prospectos/AnalyticsEnterprise/AnalyticsEnterprise';
import Analytics from '../components/prospectos/Analytics/Analytics';
import SeguimientosDashboardEnterprise from '../components/prospectos/SeguimientosDashboard/SeguimientosDashboardEnterprise';
import BalanzaSeguimientos from '../components/prospectos/BalanzaSeguimientos/BalanzaSeguimientos';

import prospectosService from '../services/prospectosService';
import { useModulePermissions } from '../hooks/useModulePermissions';

const ProspectosPage = () => {
  const { canCreate, canEdit } = useModulePermissions('prospectos');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [vistaActual, setVistaActual] = useState('kanban');
  const [showForm, setShowForm] = useState(false);
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [showProspectoDetails, setShowProspectoDetails] = useState(false);
  const [prospectoDetalles, setProspectoDetalles] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filtros, setFiltros] = useState({
    asesor_id: null,
    estado: '',
    canal_contacto: '',
    busqueda: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  const [statsGenerales, setStatsGenerales] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // 🔒 OBTENER USUARIO REAL del localStorage
  const usuarioActual = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return {
        id: user.id,
        nombre: user.nombre_completo || `${user.nombre || ''} ${user.apellido || ''}`.trim(),
        rol: user.rol?.nombre || user.rol
      };
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      return null;
    }
  }, []);

  // Cargar stats al montar y cuando se actualice
  useEffect(() => {
    cargarStatsGenerales();
  }, [refreshTrigger]);

  // Auto-refresh cada 5 minutos para stats
  useEffect(() => {
    const interval = setInterval(() => {
      cargarStatsGenerales(true); // refresh silencioso
    }, 300000); // 5 minutos

    return () => clearInterval(interval);
  }, []);

  // Sistema de notificaciones mejorado (DEFINIR PRIMERO antes de usarlo)
  const showNotification = useCallback((mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Función para cargar prospecto (PARA VISTA DE DETALLES desde notificaciones)
  const cargarProspecto = useCallback(async (prospectoId) => {
    try {
      setLoading(true);
      console.log('🔍 Cargando prospecto ID:', prospectoId);

      const response = await prospectosService.obtenerPorId(prospectoId);

      if (response.success && response.data) {
        console.log('✅ Prospecto cargado:', response.data);
        // Abrir vista de detalles en lugar del formulario de edición
        setProspectoDetalles(response.data);
        setShowProspectoDetails(true);
      } else {
        throw new Error('No se pudo cargar el prospecto');
      }
    } catch (error) {
      console.error('❌ Error cargando prospecto:', error);
      showNotification('Error al cargar el prospecto', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // 🔔 Leer query params para navegación desde notificaciones
  useEffect(() => {
    const view = searchParams.get('view');
    const prospectoId = searchParams.get('id');
    const action = searchParams.get('action');

    // 1. PRIMERO cambiar la vista si se especifica
    if (view && ['kanban', 'lista', 'seguimientos', 'analytics'].includes(view)) {
      console.log('📍 Cambiando a vista:', view);
      setVistaActual(view);
    }

    // 2. DESPUÉS cargar el prospecto si hay ID y acción
    if (prospectoId && action === 'view') {
      console.log('📨 Notificación: Cargando prospecto', prospectoId);
      // Pequeño delay para que la vista se establezca primero
      setTimeout(() => {
        cargarProspecto(prospectoId);
      }, 100);
    }

    // 3. Limpiar query params después de procesarlos
    if (view || (prospectoId && action)) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('view');
      newParams.delete('id');
      newParams.delete('action');
      setSearchParams(newParams);
    }
  }, [searchParams, cargarProspecto]);

  const cargarStatsGenerales = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setStatsLoading(true);

      // 🔒 FILTRADO AUTOMÁTICO POR ROL
      const rolUsuario = usuarioActual?.rol;
      const esVendedor = rolUsuario === 'VENDEDOR';

      // Si es VENDEDOR, solo sus métricas. Si es ejecutivo, métricas globales
      const asesorIdParaMetricas = esVendedor ? usuarioActual?.id : null;

      console.log('📊 [Stats] Cargando métricas:', {
        rol: rolUsuario,
        asesorId: asesorIdParaMetricas,
        usuario: usuarioActual?.id
      });

      const response = await prospectosService.obtenerMetricas(asesorIdParaMetricas);
      setStatsGenerales(response.data);
      setLastUpdated(new Date());

    } catch (err) {
      console.error('Error cargando stats generales:', err);
      showNotification('Error al cargar estadísticas', 'error');
    } finally {
      if (!silencioso) setStatsLoading(false);
    }
  }, [usuarioActual]);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    showNotification('Datos actualizados', 'success');
  }, []);

  const handleCrearProspecto = useCallback(() => {
    setProspectoSeleccionado(null);
    setShowForm(true);
  }, []);

  const handleEditarProspecto = useCallback((prospecto) => {
    setProspectoSeleccionado(prospecto);
    setShowForm(true);
  }, []);

  const handleVerDetalles = useCallback((prospecto) => {
    setProspectoDetalles(prospecto);
    setShowProspectoDetails(true);
  }, []);

  const handleCloseDetalles = useCallback(() => {
    setShowProspectoDetails(false);
    setProspectoDetalles(null);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setProspectoSeleccionado(null);
  }, []);

  const handleFormSave = useCallback((nuevoProspecto) => {
    handleRefresh();
    const accion = prospectoSeleccionado ? 'actualizado' : 'creado';
    showNotification(`Prospecto ${accion} exitosamente`, 'success');
    setShowForm(false);
    setProspectoSeleccionado(null);
  }, [prospectoSeleccionado, handleRefresh, showNotification]);

  // Función para limpiar todos los filtros
  const handleLimpiarFiltros = useCallback(() => {
    setFiltros({
      asesor_id: null,
      estado: '',
      canal_contacto: '',
      busqueda: '',
      fecha_desde: '',
      fecha_hasta: ''
    });
    showNotification('Filtros limpiados', 'info');
  }, [showNotification]);

  // Función para exportar datos (placeholder)
  const handleExportar = useCallback(async () => {
    try {
      setLoading(true);
      // Aquí implementarías la lógica de exportación
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular export
      showNotification('Datos exportados exitosamente', 'success');
    } catch (err) {
      showNotification('Error al exportar datos', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const vistas = useMemo(() => [
    {
      id: 'kanban',
      nombre: 'Pipeline',
      icono: BarChart3,
      descripcion: 'Vista de pipeline con drag & drop',
      tieneRefreshAuto: true
    },
    {
      id: 'lista',
      nombre: 'Lista',
      icono: List,
      descripcion: 'Vista de tabla con filtros',
      tieneRefreshAuto: false
    },
    {
      id: 'seguimientos',
      nombre: 'Seguimientos',
      icono: Bell,
      descripcion: 'Gestión de seguimientos y alertas',
      tieneRefreshAuto: true
    },
    {
      id: 'analytics',
      nombre: 'Analytics',
      icono: BarChart3,
      descripcion: 'Gráficos interactivos y mapa geográfico',
      tieneRefreshAuto: true
    }
  ], []);

  // Verificar si hay filtros activos
  const hayFiltrosActivos = useMemo(() => {
    return Object.values(filtros).some(value => 
      value !== null && value !== undefined && value !== ''
    );
  }, [filtros]);

  // Componente de notificación
  const NotificationComponent = () => {
    if (!notification) return null;

    const iconos = {
      success: CheckCircle,
      error: XCircle,
      info: Bell
    };

    const colores = {
      success: 'bg-green-100 border-green-200 text-green-800',
      error: 'bg-red-100 border-red-200 text-red-800',
      info: 'bg-blue-100 border-blue-200 text-blue-800'
    };

    const IconComponent = iconos[notification.tipo];

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg ${colores[notification.tipo]} max-w-sm`}>
        <div className="flex items-center">
          <IconComponent className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">{notification.mensaje}</span>
        </div>
      </div>
    );
  };

  const StatsCard = ({ titulo, valor, descripcion, icono: IconComponent, color, loading = false }) => {
    // 🚨 Detectar métricas importantes para destacar
    const esUrgente = (titulo === 'Seguimientos Pendientes' && parseInt(valor) > 0);
    const esExitoso = (titulo === 'Tasa Conversión' && parseFloat(valor) >= 50);

    return (
      <div className={`bg-white rounded-lg border shadow-sm p-3 transition-all hover:shadow-md hover:scale-105 ${
        esUrgente ? 'ring-2 ring-red-200 bg-red-50' :
        esExitoso ? 'ring-2 ring-green-200 bg-green-50' : ''
      }`}>
        <div className="flex items-center space-x-3">
          {/* Icono con badge urgente */}
          <div className={`relative p-2 rounded-lg ${color.bg} flex-shrink-0`}>
            <IconComponent className={`h-4 w-4 ${color.text}`} />
            {esUrgente && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                !
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-10 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
            ) : (
              <>
                <div className={`text-xl font-bold leading-tight ${
                  esUrgente ? 'text-red-700' : esExitoso ? 'text-green-700' : 'text-gray-900'
                }`}>
                  {valor}
                </div>
                <div className="text-sm font-medium text-gray-600">{titulo}</div>
                <div className="text-xs text-gray-500">{descripcion}</div>
              </>
            )}
          </div>

          {/* Emoji indicador de estado */}
          <div className="text-lg">
            {esUrgente ? '🚨' : esExitoso ? '🎯' :
             titulo.includes('Total') ? '👥' :
             titulo.includes('Negociación') ? '🤝' : '📊'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header principal */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Prospectos</h1>
            <div className="flex items-center space-x-2 text-gray-600">
              <p>Pipeline de ventas y seguimiento de clientes potenciales</p>
              {lastUpdated && (
                <span className="text-xs text-gray-400">
                  • Actualizado {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {hayFiltrosActivos && (
              <button
                onClick={handleLimpiarFiltros}
                className="inline-flex items-center px-3 py-2 border border-orange-300 rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors text-sm"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Limpiar Filtros
              </button>
            )}
            
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>

            {canCreate && (
              <button
                onClick={handleCrearProspecto}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Prospecto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats rápidos - COMPACTOS MEJORADOS */}
      {(statsGenerales || statsLoading) && (
        <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-blue-50 border-b">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard
              titulo="Total Prospectos"
              valor={statsGenerales?.total_prospectos || '0'}
              descripcion={`${statsGenerales?.prospectos_activos || 0} activos`}
              icono={Users}
              color={{ bg: 'bg-blue-100', text: 'text-blue-600' }}
              loading={statsLoading}
            />
            <StatsCard
              titulo="En Negociación"
              valor={statsGenerales?.en_negociacion || '0'}
              descripcion="Próximos a cerrar"
              icono={Calendar}
              color={{ bg: 'bg-orange-100', text: 'text-orange-600' }}
              loading={statsLoading}
            />
            <StatsCard
              titulo="Tasa Conversión"
              valor={statsGenerales?.tasa_conversion || '0.00%'}
              descripcion={`${statsGenerales?.cerrados || 0} cerrados`}
              icono={BarChart3}
              color={{ bg: 'bg-green-100', text: 'text-green-600' }}
              loading={statsLoading}
            />
            <StatsCard
              titulo="Seguimientos Pendientes"
              valor={statsGenerales?.seguimientos_pendientes || '0'}
              descripcion="Requieren atención"
              icono={AlertCircle}
              color={{ 
                bg: (statsGenerales?.seguimientos_pendientes || 0) > 0 ? 'bg-red-100' : 'bg-gray-100', 
                text: (statsGenerales?.seguimientos_pendientes || 0) > 0 ? 'text-red-600' : 'text-gray-600' 
              }}
              loading={statsLoading}
            />
          </div>
        </div>
      )}

      {/* Barra de navegación de vistas */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            {vistas.map((vista) => {
              const IconComponent = vista.icono;
              const isActive = vistaActual === vista.id;
              
              return (
                <button
                  key={vista.id}
                  onClick={() => setVistaActual(vista.id)}
                  className={`relative inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
                  }`}
                  title={vista.descripcion}
                >
                  <IconComponent className="h-4 w-4 mr-2" />
                  {vista.nombre}

                  {vista.tieneRefreshAuto && isActive && (
                    <div className="ml-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Auto-refresh activo" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Filtros y acciones por vista */}
          <div className="flex items-center space-x-3">
            {vistaActual === 'kanban' && (
              <KanbanFilters
                filtros={filtros}
                onFiltrosChange={setFiltros}
                onExportar={handleExportar}
              />
            )}

            {vistaActual !== 'kanban' && vistaActual !== 'seguimientos' && (
              <>
                <button 
                  onClick={() => showNotification('Filtros avanzados próximamente', 'info')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                </button>

                {canEdit && (
                  <button
                    onClick={handleExportar}
                    disabled={loading}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-hidden">
        {vistaActual === 'analytics' && (
          <div className="h-full p-6 overflow-y-auto">
            <Analytics
              asesorId={filtros.asesor_id || usuarioActual?.id}
            />
          </div>
        )}

        {vistaActual === 'seguimientos' && (
          <div className="h-full p-6 overflow-y-auto">
            <BalanzaSeguimientos
              asesorId={usuarioActual?.id}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {vistaActual === 'kanban' && (
          <div className="h-full p-6">
            <KanbanBoard
              asesorId={filtros.asesor_id}
              onProspectoSelect={handleEditarProspecto}
              refreshTrigger={refreshTrigger}
              filtros={filtros}
              onFiltrosChange={setFiltros}
            />
          </div>
        )}

        {vistaActual === 'lista' && (
          <div className="h-full p-6 overflow-y-auto">
            <ProspectoList
              refreshTrigger={refreshTrigger}
              onEdit={handleEditarProspecto}
              onView={handleEditarProspecto}
              filtros={filtros}
            />
          </div>
        )}
      </div>

      {/* Modal del formulario */}
      {showForm && (
        <ProspectoForm
          prospecto={prospectoSeleccionado}
          mode={prospectoSeleccionado ? 'edit' : 'create'}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}

      {/* Modal de detalles del prospecto */}
      {showProspectoDetails && prospectoDetalles && (
        <ProspectoDetailsView
          prospecto={prospectoDetalles}
          onClose={handleCloseDetalles}
          onEdit={(prospecto) => {
            setShowProspectoDetails(false);
            setProspectoDetalles(null);
            handleEditarProspecto(prospecto);
          }}
          currentUser={usuarioActual}
        />
      )}

      {/* Overlay de carga global */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 flex items-center shadow-xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-700">Procesando...</span>
          </div>
        </div>
      )}

      {/* Sistema de notificaciones */}
      <NotificationComponent />
    </div>
  );
};

export default ProspectosPage;