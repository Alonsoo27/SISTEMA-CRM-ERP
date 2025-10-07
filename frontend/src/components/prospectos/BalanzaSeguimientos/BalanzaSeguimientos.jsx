// src/components/prospectos/BalanzaSeguimientos/BalanzaSeguimientos.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, CheckCircle, AlertTriangle, TrendingUp, Users, Eye,
  RefreshCw, User, Bell, Calendar, ArrowRight, ChevronDown,
  Timer, Target, Award, Activity, BarChart3
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';
import HistorialCompleto from '../HistorialCompleto/HistorialCompleto';
import VistaSelectorSeguimientos from '../../common/VistaSelectorSeguimientos';

const BalanzaSeguimientos = ({ asesorId: asesorIdProp = null, refreshTrigger = 0 }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vistaDetalle, setVistaDetalle] = useState(null); // 'pendientes' | 'realizados' | null
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(null); // Datos del seguimiento a confirmar
  const [procesandoConfirmacion, setProcesandoConfirmacion] = useState(false);
  const [modalReprogramar, setModalReprogramar] = useState(null); // Datos del seguimiento a reprogramar
  const [procesandoReprogramacion, setProcesandoReprogramacion] = useState(false);

  // Sistema de notificaciones
  const [notificacion, setNotificacion] = useState(null); // { tipo: 'success'|'error', mensaje: string }

  // Modal historial completo
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // Modal explicativo del Score
  const [mostrarModalScore, setMostrarModalScore] = useState(false);

  // Estados para filtros y búsqueda
  const [filtros, setFiltros] = useState({
    tipo: 'todos', // 'todos', 'WhatsApp', 'Llamada', 'Email', etc.
    urgencia: 'todos', // 'todos', 'vencidos', 'hoy', 'proximos'
    busqueda: ''
  });

  // 🎯 NUEVO: Estado interno de vista (para selector ejecutivo)
  const [vistaSeleccionada, setVistaSeleccionada] = useState(asesorIdProp);

  // 🔒 OBTENER USUARIO REAL del localStorage
  const usuarioActual = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return {
        id: user.id,
        nombre: user.nombre_completo || `${user.nombre || ''} ${user.apellido || ''}`.trim(),
        rol: user.rol?.nombre || user.rol,
        es_jefe: user.es_jefe
      };
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      return null;
    }
  }, []);

  // Control de permisos
  const esRolAlto = useCallback(() => {
    if (!usuarioActual?.rol) return false;
    const rolesAltos = ['SUPER_ADMIN', 'ADMIN', 'GERENTE', 'SUPERVISOR'];
    // Manejar tanto rol como string o como objeto {id, nombre}
    const rolNombre = typeof usuarioActual.rol === 'string'
      ? usuarioActual.rol
      : usuarioActual.rol?.nombre || '';
    return rolesAltos.includes(rolNombre.toUpperCase());
  }, [usuarioActual]);

  const puedeVerOtrosAsesores = useCallback(() => {
    return esRolAlto() || usuarioActual?.es_jefe;
  }, [esRolAlto, usuarioActual]);

  // Función para mostrar notificaciones
  const mostrarNotificacion = (tipo, mensaje) => {
    setNotificacion({ tipo, mensaje });
    // Auto-ocultar después de 4 segundos
    setTimeout(() => setNotificacion(null), 4000);
  };

  useEffect(() => {
    cargarDatos();
  }, [vistaSeleccionada, refreshTrigger]);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(cargarDatos, 5 * 60 * 1000); // 5 minutos
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // 🎯 Handler para cambio de vista desde selector
  const handleCambioVista = useCallback((nuevoAsesorId) => {
    console.log('🔄 Cambiando vista a:', nuevoAsesorId === null ? 'global' : `asesor ${nuevoAsesorId}`);
    setVistaSeleccionada(nuevoAsesorId);
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      // 🔒 USAR LA VISTA SELECCIONADA INTERNAMENTE
      // El backend validará los permisos automáticamente
      const asesorIdFinal = vistaSeleccionada;

      console.log('🔍 BalanzaSeguimientos: Cargando con asesorId=', asesorIdFinal,
                  asesorIdFinal === null ? '(vista global)' : `(asesor específico)`);

      const response = await prospectosService.obtenerDashboardSeguimientos(asesorIdFinal);

      if (response.success) {
        console.log('🎯 Datos recibidos:', response.data);
        console.log('🎯 Conteos:', response.data?.seguimientos?.conteos);
        setDashboardData(response.data);
      } else {
        setError(response.error || 'Error al cargar datos');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error cargando dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calcular datos para la balanza con lógica real del negocio
  const datosBalanza = useMemo(() => {
    console.log('🔄 Calculando datos balanza, dashboardData:', dashboardData);

    if (!dashboardData) return { pendientes: 0, realizados: 0, balance: 0 };

    const seguimientos = dashboardData.seguimientos || {};
    const conteos = dashboardData.conteos || {};

    console.log('📊 Conteos extraídos:', conteos);
    console.log('📋 Seguimientos extraídos:', Object.keys(seguimientos));

    // ⚖️ LÓGICA REAL DE NEGOCIO:
    // - Sistema usa 18 horas laborales para vencimiento
    // - Vencidos tienen tiempo de recuperación antes de traspaso
    // - Solo seguimientos confirmados van a "realizados"

    const pendientesProximos = conteos.pendientes || 0;
    const vencidosSinConfirmar = conteos.vencidos || 0;

    // Total de seguimientos que necesitan acción del asesor
    const totalPendientes = pendientesProximos + vencidosSinConfirmar;

    // Seguimientos confirmados/realizados - usar datos reales de la API
    // ✅ CAMBIO: Usar realizados_semana en lugar de completados_hoy
    const realizadosSemana = conteos.realizados_semana || 0;

    // Contar seguimientos realizados de toda la data disponible
    const seguimientosRealizados = seguimientos.realizados_semana || [];
    const seguimientosCompletados = seguimientosRealizados.filter(s => s.completado === true);

    // Para "realizados" usar los seguimientos que realmente están marcados como completados
    const realizados = seguimientosCompletados.length;

    const balance = realizados > totalPendientes ? 1 : realizados < totalPendientes ? -1 : 0;

    const resultado = {
      pendientes: totalPendientes,
      realizados,
      balance,
      vencidos: vencidosSinConfirmar,
      criticos: vencidosSinConfirmar, // Los vencidos son críticos
      realizadosSemana,
      hoy: seguimientosRealizados.length,
      proximos: pendientesProximos,

      // Datos adicionales para debug
      seguimientosCompletadosHoy: seguimientosCompletados.length,
      tiempoVencimiento: '18 horas laborales',
      horarioLaboral: 'L-V 8am-6pm, Sáb 9am-12pm'
    };

    console.log('⚖️ Resultado balanza (LÓGICA REAL):', resultado);
    return resultado;
  }, [dashboardData]);

  const obtenerInclinacionBalanza = () => {
    const { pendientes, realizados } = datosBalanza;
    if (pendientes === 0 && realizados === 0) return 0;

    const total = pendientes + realizados;
    const diferencia = realizados - pendientes;

    // Si la diferencia es muy pequeña respecto al total, inclinación mínima
    const porcentajeDiferencia = Math.abs(diferencia) / total;

    let inclinacion = 0;
    if (porcentajeDiferencia > 0.1) { // Solo inclinar si la diferencia es mayor al 10%
      const maxInclinacion = 15; // Inclinación más sutil
      // Calcular inclinación proporcional a la diferencia
      inclinacion = (diferencia / total) * maxInclinacion * 2;
      inclinacion = Math.min(Math.max(inclinacion, -maxInclinacion), maxInclinacion);
    }

    console.log('🎯 Balance calculado:', {
      pendientes,
      realizados,
      diferencia,
      total,
      porcentajeDiferencia: (porcentajeDiferencia * 100).toFixed(1) + '%',
      inclinacion: inclinacion.toFixed(1) + '°'
    });

    return inclinacion;
  };

  // Función para abrir modal de confirmación
  const abrirModalConfirmar = (seguimiento) => {
    setModalConfirmar(seguimiento);
  };

  // Función para abrir modal de reprogramar
  const abrirModalReprogramar = (seguimiento) => {
    setModalReprogramar(seguimiento);
  };

  // Función para confirmar seguimiento
  const confirmarSeguimiento = async (datos) => {
    try {
      setProcesandoConfirmacion(true);

      console.log('🔄 Confirmando seguimiento:', datos);

      // Llamar a la API real para completar seguimiento
      const response = await prospectosService.completarSeguimiento(datos.seguimiento_id, {
        resultado: datos.resultado,
        notas: datos.detalles,
        calificacion: datos.resultado === 'interesado' ? 5 : datos.resultado === 'no_respondio' ? 3 : 1
      });

      if (response.success) {
        console.log('✅ Seguimiento confirmado exitosamente');

        // Verificar si hubo conversión automática
        if (response.data?.conversion?.success) {
          mostrarNotificacion('success', `🎉 ${response.message} - Venta creada: ${response.data.conversion.venta_codigo}`);
          console.log('🎯 Conversión automática exitosa:', response.data.conversion);
        } else if (response.data?.conversion?.success === false) {
          mostrarNotificacion('warning', `✅ Seguimiento completado. ${response.data.conversion.error || 'Conversión pendiente'}`);
          console.log('⚠️ Error en conversión automática:', response.data.conversion);
        } else {
          mostrarNotificacion('success', '✅ Seguimiento confirmado exitosamente');
        }

        // Recargar datos después de confirmar
        await cargarDatos();

        // Si hubo conversión exitosa, esperar un momento y recargar datos del pipeline
        if (response.data?.conversion?.success) {
          console.log('🔄 Recargando pipeline después de conversión...');
          setTimeout(async () => {
            await cargarDatos();
          }, 2000);
        }

        // Cerrar modal
        setModalConfirmar(null);
      } else {
        throw new Error(response.error || 'Error al confirmar seguimiento');
      }

    } catch (error) {
      console.error('❌ Error confirmando seguimiento:', error);
      mostrarNotificacion('error', '❌ Error al confirmar seguimiento: ' + error.message);
    } finally {
      setProcesandoConfirmacion(false);
    }
  };

  // Función para reprogramar seguimiento
  const reprogramarSeguimiento = async (datos) => {
    try {
      setProcesandoReprogramacion(true);

      console.log('🔄 Reprogramando seguimiento:', datos);

      // Llamar a la API para posponer seguimiento
      const response = await prospectosService.posponerSeguimiento(
        datos.seguimiento_id,
        datos.nueva_fecha,
        datos.motivo
      );

      if (response.success) {
        console.log('✅ Seguimiento reprogramado exitosamente');
        mostrarNotificacion('success', '📅 Seguimiento reprogramado exitosamente');

        // Recargar datos después de reprogramar
        await cargarDatos();

        // Cerrar modal
        setModalReprogramar(null);
      } else {
        throw new Error(response.error || 'Error al reprogramar seguimiento');
      }

    } catch (error) {
      console.error('❌ Error reprogramando seguimiento:', error);
      mostrarNotificacion('error', '❌ Error al reprogramar seguimiento: ' + error.message);
    } finally {
      setProcesandoReprogramacion(false);
    }
  };

  const renderBalanza = () => {
    const { pendientes, realizados, vencidos, criticos } = datosBalanza;
    const inclinacion = obtenerInclinacionBalanza();

    return (
      <div className="relative bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 rounded-3xl p-8 shadow-2xl border-4 border-yellow-400 overflow-hidden">
        {/* Fondo sutil */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800/30 via-transparent to-gray-800/30"></div>
        </div>

        {/* Header con Selector de Vista */}
        <div className="text-center mb-8 relative z-[110]">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 via-orange-500 to-yellow-600 rounded-full mb-4 shadow-2xl shadow-yellow-500/50 border-4 border-yellow-300">
            <span className="text-4xl drop-shadow-lg">⚖️</span>
          </div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-300 drop-shadow-2xl">
            ⚖️ BALANZA DE SEGUIMIENTOS ⚖️
          </h2>

          {/* 🎯 SELECTOR DE VISTA - Integrado en el centro */}
          <div className="flex justify-center mt-4">
            <VistaSelectorSeguimientos
              usuarioActual={usuarioActual}
              onVistaChange={handleCambioVista}
              vistaActual={vistaSeleccionada}
            />
          </div>
        </div>

        {/* Balanza Rediseñada */}
        <div className="flex items-center justify-center mb-20 relative z-10">
          <div className="relative">
            {/* Base mejorada */}
            <div className="w-20 h-40 bg-gradient-to-b from-yellow-400 via-orange-500 to-yellow-600 rounded-lg mx-auto mb-6 shadow-2xl border-4 border-yellow-300 relative">
              <div className="absolute inset-3 bg-gradient-to-b from-yellow-300 via-orange-400 to-yellow-500 rounded-md"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-10 bg-yellow-700 rounded-full shadow-lg"></div>
            </div>

            {/* Punto de apoyo */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-30">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 via-orange-500 to-yellow-600 rounded-full shadow-2xl border-4 border-yellow-300">
                <div className="absolute inset-2 bg-yellow-200 rounded-full"></div>
              </div>
            </div>

            {/* Brazo principal con platos conectados */}
            <div
              className="w-[500px] h-8 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 rounded-full transition-all duration-1000 ease-in-out shadow-2xl border-4 border-yellow-300 relative"
              style={{
                transform: `rotate(${inclinacion}deg)`,
                transformOrigin: 'center center'
              }}
            >
              {/* Efectos de luz en el brazo */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-200 to-transparent rounded-full opacity-70"></div>
              <div className="absolute top-1/2 left-1/4 transform -translate-y-1/2 w-3 h-3 bg-yellow-600 rounded-full shadow-lg"></div>
              <div className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-3 h-3 bg-yellow-600 rounded-full shadow-lg"></div>

              {/* Centro */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-br from-orange-400 to-red-500 rounded-full border-2 border-yellow-300 shadow-lg">
                <div className="absolute inset-1 bg-yellow-200 rounded-full"></div>
              </div>

              {/* Platos conectados al brazo */}
              {/* Plato Izquierdo - PENDIENTES */}
              <div
                className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{
                  marginTop: '-20px', // Subir para evitar superposición con métricas
                  marginLeft: '20px'
                }}
              >
                <div
                  onClick={() => setVistaDetalle('pendientes')}
                  className="relative w-40 h-40 bg-gradient-to-br from-red-500 via-pink-500 to-red-600 rounded-full border-8 border-red-400 shadow-2xl shadow-red-500/50 flex flex-col items-center justify-center text-white group-hover:scale-105 transition-all duration-300"
                >
                  {/* Anillos */}
                  <div className="absolute inset-6 border-4 border-red-300/70 rounded-full"></div>
                  <div className="absolute inset-12 border-2 border-red-200/50 rounded-full"></div>

                  {/* Efecto de fondo */}
                  <div className="absolute inset-0 bg-gradient-to-t from-red-700 via-transparent to-transparent rounded-full"></div>

                  {/* Contenido principal */}
                  <div className="relative z-10 text-center">
                    <div className="text-5xl font-black text-white drop-shadow-2xl mb-2">{pendientes}</div>
                    <div className="text-sm text-red-100 font-bold tracking-wide">PENDIENTES</div>
                  </div>

                  {/* Badge de vencidos */}
                  {vencidos > 0 && (
                    <div className="absolute -top-4 -right-4 bg-gradient-to-br from-orange-500 to-red-600 text-white text-sm px-3 py-2 rounded-full font-bold shadow-2xl border-2 border-orange-400">
                      <span className="block text-lg">🔥</span>
                      <span className="block font-black">{vencidos}</span>
                    </div>
                  )}
                </div>

                <div className="text-center mt-4">
                  <div className="flex items-center justify-center space-x-2 text-red-300">
                    <Clock className="h-6 w-6" />
                    <span className="font-bold text-lg">VER DETALLES</span>
                  </div>
                </div>
              </div>

              {/* Plato Derecho - REALIZADOS */}
              <div
                className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                style={{
                  marginTop: '-20px', // Subir para evitar superposición con métricas
                  marginRight: '20px'
                }}
              >
                <div
                  onClick={() => setVistaDetalle('realizados')}
                  className="relative w-40 h-40 bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 rounded-full border-8 border-green-400 shadow-2xl shadow-green-500/50 flex flex-col items-center justify-center text-white group-hover:scale-105 transition-all duration-300"
                >
                  {/* Anillos */}
                  <div className="absolute inset-6 border-4 border-green-300/70 rounded-full"></div>
                  <div className="absolute inset-12 border-2 border-green-200/50 rounded-full"></div>

                  {/* Efecto de brillo */}
                  <div className="absolute inset-0 bg-gradient-to-t from-green-700 via-transparent to-green-300 rounded-full"></div>

                  {/* Contenido principal */}
                  <div className="relative z-10 text-center">
                    <div className="text-5xl font-black text-white drop-shadow-2xl mb-2">{realizados}</div>
                    <div className="text-sm text-green-100 font-bold tracking-wide">REALIZADOS 7D</div>
                  </div>

                  {/* Badge de mes */}
                  <div className="absolute -top-4 -right-4 bg-gradient-to-br from-green-400 to-emerald-600 text-white text-sm px-3 py-2 rounded-full font-bold shadow-2xl border-2 border-green-300">
                    <span className="block text-lg">✅</span>
                    <span className="block text-xs font-black"></span>
                  </div>
                </div>

                <div className="text-center mt-4">
                  <div className="flex items-center justify-center space-x-2 text-green-300">
                    <CheckCircle className="h-6 w-6" />
                    <span className="font-bold text-lg">VER DETALLES</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mensaje de equilibrio */}
            <div className="text-center mt-8">
              <div className={`inline-block px-6 py-3 rounded-full font-bold text-lg shadow-2xl border-4 ${
                Math.abs(inclinacion) < 5
                  ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 text-white border-green-300 shadow-green-500/50'
                  : inclinacion < 0
                  ? 'bg-gradient-to-r from-red-400 via-pink-500 to-red-600 text-white border-red-300 shadow-red-500/50'
                  : 'bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600 text-white border-blue-300 shadow-blue-500/50'
              }`}>
                {Math.abs(inclinacion) < 5 ? '⚖️ EQUILIBRIO PERFECTO' :
                 inclinacion < 0 ? '⚠️ SEGUIMIENTOS' : '✅ ALTA PRODUCTIVIDAD'}
              </div>
            </div>
          </div>
        </div>

        {/* Métricas Adicionales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-40">
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <AlertTriangle className="h-6 w-6 text-orange-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">{criticos}</div>
            <div className="text-sm text-gray-600">Críticos</div>
          </div>

          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <Calendar className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">{datosBalanza.realizadosSemana}</div>
            <div className="text-sm text-gray-600">Últimos 7 días</div>
          </div>

          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <TrendingUp className="h-6 w-6 text-purple-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">
              {realizados > 0 ? Math.round((realizados / (realizados + pendientes)) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-600">Efectividad</div>
          </div>

          <div
            className="bg-white rounded-lg p-4 text-center shadow-sm cursor-pointer hover:shadow-md transition-shadow border-2 border-transparent hover:border-yellow-400 relative z-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🎯 Click en Score detectado!');
              setMostrarModalScore(true);
            }}
            style={{ pointerEvents: 'all' }}
          >
            <Award className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">
              {dashboardData?.metricas?.score_productividad || 0}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center">
              Score <span className="ml-1 text-yellow-500">ℹ️</span>
            </div>
          </div>
        </div>

        {/* Controles - Corregir z-index para hacerlos clickeables */}
        <div className="flex justify-center space-x-4 mt-6 relative z-50">
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg hover:shadow-xl cursor-pointer"
            style={{ pointerEvents: 'all' }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl cursor-pointer ${
              autoRefresh
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            style={{ pointerEvents: 'all' }}
          >
            <Timer className="h-4 w-4" />
            <span>{autoRefresh ? 'Auto ✓' : 'Manual'}</span>
          </button>

          <button
            onClick={() => setMostrarHistorial(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl cursor-pointer"
            style={{ pointerEvents: 'all' }}
          >
            <BarChart3 className="h-4 w-4" />
            <span>📊 Historial Completo</span>
          </button>
        </div>
      </div>
    );
  };

  const renderListaDetalle = () => {
    if (!vistaDetalle || !dashboardData) return null;

    const seguimientos = dashboardData.seguimientos || {};
    let datos = vistaDetalle === 'pendientes'
      ? [...(seguimientos.proximos || []), ...(seguimientos.vencidos || [])]
      : seguimientos.realizados_semana || []; // ✅ Ahora usa realizados_semana

    // Aplicar filtros
    datos = datos.filter(item => {
      // Filtro por tipo
      if (filtros.tipo !== 'todos' && item.tipo !== filtros.tipo) {
        return false;
      }

      // Filtro por urgencia (solo para pendientes)
      if (vistaDetalle === 'pendientes' && filtros.urgencia !== 'todos') {
        if (filtros.urgencia === 'vencidos' && !item.vencido) return false;
        if (filtros.urgencia === 'hoy' && item.vencido) return false;
      }

      // Filtro por búsqueda
      if (filtros.busqueda.trim()) {
        const busqueda = filtros.busqueda.toLowerCase();
        const nombre = (item.nombre_cliente || item.prospecto_nombre || '').toLowerCase();
        const telefono = (item.telefono || '').toLowerCase();
        const codigo = (item.prospecto_codigo || '').toLowerCase();

        return nombre.includes(busqueda) ||
               telefono.includes(busqueda) ||
               codigo.includes(busqueda);
      }

      return true;
    });

    const titulo = vistaDetalle === 'pendientes' ? 'Seguimientos Pendientes' : 'Seguimientos Realizados (Últimos 7 días)';
    const icono = vistaDetalle === 'pendientes' ? Clock : CheckCircle;
    const colorTema = vistaDetalle === 'pendientes' ? 'red' : 'green';

    // Obtener tipos únicos para el filtro
    const tiposDisponibles = [...new Set([
      ...(seguimientos.proximos || []).map(s => s.tipo),
      ...(seguimientos.vencidos || []).map(s => s.tipo),
      ...(seguimientos.realizados_semana || []).map(s => s.tipo)
    ])].filter(Boolean);

    return (
      <div className="mt-8 bg-white rounded-lg shadow-lg border">
        <div className={`px-6 py-4 bg-${colorTema}-50 border-b border-${colorTema}-200 rounded-t-lg`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {React.createElement(icono, { className: `h-6 w-6 text-${colorTema}-600` })}
              <h3 className={`text-lg font-semibold text-${colorTema}-800`}>{titulo}</h3>
              <span className={`px-3 py-1 bg-${colorTema}-200 text-${colorTema}-800 rounded-full text-sm font-medium`}>
                {datos.length}
              </span>
            </div>
            <button
              onClick={() => setVistaDetalle(null)}
              className={`p-2 hover:bg-${colorTema}-200 rounded-lg transition-colors`}
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          {/* Barra de filtros y búsqueda */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Buscador */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono o código..."
                  value={filtros.busqueda}
                  onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
              </div>
            </div>

            {/* Filtro por tipo */}
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros(prev => ({ ...prev, tipo: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos los tipos</option>
              {tiposDisponibles.map(tipo => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>

            {/* Filtro por urgencia (solo para pendientes) */}
            {vistaDetalle === 'pendientes' && (
              <select
                value={filtros.urgencia}
                onChange={(e) => setFiltros(prev => ({ ...prev, urgencia: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todas las urgencias</option>
                <option value="vencidos">Solo vencidos</option>
                <option value="hoy">Solo vigentes</option>
              </select>
            )}

            {/* Botón limpiar filtros */}
            {(filtros.busqueda || filtros.tipo !== 'todos' || filtros.urgencia !== 'todos') && (
              <button
                onClick={() => setFiltros({ tipo: 'todos', urgencia: 'todos', busqueda: '' })}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {datos.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No hay {vistaDetalle} en este momento</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {datos.map((item, index) => (
                <div key={item.id || index} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          {item.nombre_cliente || item.prospecto_nombre || 'Sin nombre'}
                        </h4>
                        <div className="text-xs text-gray-500 font-mono">
                          #{item.prospecto_codigo || item.codigo || 'N/A'}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center space-x-1">
                          <span>📞</span>
                          <span>{item.telefono || 'Sin teléfono'}</span>
                        </span>
                        {item.asesor_nombre && (
                          <span className="flex items-center space-x-1">
                            <User className="h-3 w-3" />
                            <span>{item.asesor_nombre}</span>
                          </span>
                        )}
                        {item.valor_estimado && (
                          <span className="flex items-center space-x-1">
                            <span>💰</span>
                            <span className="font-semibold">${item.valor_estimado.toLocaleString()}</span>
                          </span>
                        )}
                        {item.probabilidad_cierre && (
                          <span className="flex items-center space-x-1">
                            <Target className="h-3 w-3" />
                            <span>{item.probabilidad_cierre}%</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-xs space-y-1">
                        <div className="flex items-center justify-between text-gray-500">
                          <span>
                            {vistaDetalle === 'pendientes'
                              ? `⏰ Vence: ${new Date(item.fecha_programada).toLocaleDateString()} ${new Date(item.fecha_programada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : `✅ Completado: ${new Date(item.fecha_completado || item.created_at).toLocaleDateString()} ${new Date(item.fecha_completado || item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            }
                          </span>
                          {vistaDetalle === 'pendientes' && item.fecha_programada && (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              new Date(item.fecha_programada) < new Date()
                                ? 'bg-red-100 text-red-700'
                                : new Date(item.fecha_programada) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {new Date(item.fecha_programada) < new Date()
                                ? '🚨 Vencido'
                                : new Date(item.fecha_programada) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                                ? '⚠️ Hoy'
                                : '📅 Programado'
                              }
                            </span>
                          )}
                        </div>

                        {item.descripcion && (
                          <div className="text-gray-600 bg-gray-50 p-2 rounded">
                            <span className="font-medium">📝 Notas:</span> {item.descripcion}
                          </div>
                        )}

                        {item.estado && (
                          <div className="flex items-center text-gray-500">
                            <span className="font-medium">Estado:</span>
                            <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                              item.estado === 'Negociacion' ? 'bg-orange-100 text-orange-700' :
                              item.estado === 'Cotizado' ? 'bg-blue-100 text-blue-700' :
                              item.estado === 'Cerrado' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {item.estado}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.vencido && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                          Vencido
                        </span>
                      )}
                      {item.tipo && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {item.tipo}
                        </span>
                      )}
                      {item.valor_estimado && item.valor_estimado >= 2000 && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                          💎 Alto valor
                        </span>
                      )}
                      {item.valor_estimado && item.valor_estimado >= 1000 && item.valor_estimado < 2000 && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          💼 Valor medio
                        </span>
                      )}
                      {item.estado === 'Negociacion' && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          🎯 Conv. potencial
                        </span>
                      )}

                      {/* Botones de acción - solo para pendientes */}
                      {vistaDetalle === 'pendientes' && !item.completado && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => abrirModalConfirmar(item)}
                            className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors flex items-center space-x-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            <span>CONFIRMAR</span>
                          </button>

                          <button
                            onClick={() => abrirModalReprogramar(item)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
                          >
                            <Calendar className="h-3 w-3" />
                            <span>REPROGRAMAR</span>
                          </button>
                        </div>
                      )}

                      <button className="p-2 hover:bg-gray-100 rounded transition-colors">
                        <Eye className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">Error al cargar datos</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={cargarDatos}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Componente Modal de Confirmación
  const renderModalConfirmar = () => {
    if (!modalConfirmar) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ✅ Confirmar Seguimiento
          </h3>

          {/* Información del seguimiento */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <div><strong>Cliente:</strong> {modalConfirmar.nombre_cliente || modalConfirmar.prospecto_nombre}</div>
              <div><strong>Tipo:</strong> {modalConfirmar.tipo}</div>
              <div><strong>Teléfono:</strong> {modalConfirmar.telefono}</div>
              {modalConfirmar.vencido && (
                <div className="text-red-600 font-medium">⚠️ Vencido</div>
              )}
            </div>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const datos = {
              seguimiento_id: modalConfirmar.prospecto_id, // Usar prospecto_id que viene de la API
              detalles: formData.get('detalles'),
              resultado: formData.get('resultado')
            };
            confirmarSeguimiento(datos);
          }}>
            {/* Campo de detalles */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Qué hiciste?
              </label>
              <textarea
                name="detalles"
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Describe lo que hiciste en este seguimiento..."
                required
              />
            </div>

            {/* Opciones de resultado */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Resultado del contacto?
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="resultado"
                    value="interesado"
                    className="mr-2"
                    required
                  />
                  <span className="text-sm">Interesado - Reprogramar</span>
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    🎯 Alto potencial conversión
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="resultado"
                    value="no_interesado"
                    className="mr-2"
                  />
                  <span className="text-sm">No interesado - Descartar</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="resultado"
                    value="no_respondio"
                    className="mr-2"
                  />
                  <span className="text-sm">No respondió - Reprogramar</span>
                </label>
              </div>
            </div>

            {/* Botones */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setModalConfirmar(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                disabled={procesandoConfirmacion}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                disabled={procesandoConfirmacion}
              >
                {procesandoConfirmacion ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  'CONFIRMAR'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Función para validar horario laboral
  const esHorarioLaboral = (fecha) => {
    const date = new Date(fecha);
    const diaSemana = date.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    const hora = date.getHours();

    // Lunes a Viernes: 8am-6pm
    if (diaSemana >= 1 && diaSemana <= 5) {
      return hora >= 8 && hora < 18;
    }
    // Sábado: 9am-12pm
    if (diaSemana === 6) {
      return hora >= 9 && hora < 12;
    }
    // Domingo: Cerrado
    return false;
  };

  // Componente Modal de Reprogramar
  const renderModalReprogramar = () => {
    if (!modalReprogramar) return null;

    // Calcular fecha mínima (hoy)
    const fechaMinima = new Date().toISOString().slice(0, 16);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📅 Reprogramar Seguimiento
          </h3>

          {/* Información del seguimiento */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <div><strong>Cliente:</strong> {modalReprogramar.nombre_cliente || modalReprogramar.prospecto_nombre}</div>
              <div><strong>Tipo:</strong> {modalReprogramar.tipo}</div>
              <div><strong>Fecha actual:</strong> {new Date(modalReprogramar.fecha_programada).toLocaleString()}</div>
              {modalReprogramar.vencido && (
                <div className="text-red-600 font-medium">⚠️ Vencido</div>
              )}
            </div>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const nuevaFecha = formData.get('nueva_fecha');

            // Validar horario laboral
            if (!esHorarioLaboral(nuevaFecha)) {
              mostrarNotificacion('error', '⚠️ La fecha debe estar dentro del horario laboral: L-V 8am-6pm, Sáb 9am-12pm');
              return;
            }

            const datos = {
              seguimiento_id: modalReprogramar.prospecto_id, // Usar prospecto_id que viene de la API
              nueva_fecha: nuevaFecha,
              motivo: formData.get('motivo')
            };
            reprogramarSeguimiento(datos);
          }}>
            {/* Campo de nueva fecha */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nueva fecha y hora
              </label>
              <input
                type="datetime-local"
                name="nueva_fecha"
                min={fechaMinima}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="mt-1 text-xs text-gray-500">
                📅 Horario laboral: L-V 8am-6pm, Sáb 9am-12pm
              </div>
            </div>

            {/* Campo de motivo */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de la reprogramación
              </label>
              <textarea
                name="motivo"
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Indica por qué reprogramas este seguimiento..."
                required
              />
            </div>

            {/* Botones */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setModalReprogramar(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                disabled={procesandoReprogramacion}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                disabled={procesandoReprogramacion}
              >
                {procesandoReprogramacion ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Reprogramando...
                  </>
                ) : (
                  'REPROGRAMAR'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Modal explicativo del Score
  const renderModalScore = () => {
    if (!mostrarModalScore) return null;

    const scoreActual = dashboardData?.metricas?.score_productividad || 0;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Award className="h-8 w-8 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Score de Productividad</h2>
                <p className="text-gray-600">Tu puntaje actual: <span className="font-bold text-yellow-600">{scoreActual}/100</span></p>
              </div>
            </div>
            <button
              onClick={() => setMostrarModalScore(false)}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Indicador visual del score */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Score actual</span>
              <span className="text-sm font-medium text-gray-700">{scoreActual}/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${
                  scoreActual >= 80 ? 'bg-green-500' :
                  scoreActual >= 60 ? 'bg-yellow-500' :
                  scoreActual >= 40 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(scoreActual, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span className={`font-medium ${
                scoreActual >= 80 ? 'text-green-600' :
                scoreActual >= 60 ? 'text-yellow-600' :
                scoreActual >= 40 ? 'text-orange-600' : 'text-red-600'
              }`}>
                {scoreActual >= 80 ? '🌟 Excelente' :
                 scoreActual >= 60 ? '👍 Bueno' :
                 scoreActual >= 40 ? '⚠️ Regular' : '🔻 Necesita mejora'}
              </span>
              <span>100</span>
            </div>
          </div>

          {/* Componentes del score */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">¿Cómo se calcula tu Score?</h3>

            {/* Componente 1: Tasa de conversión */}
            <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-400">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Tasa de Conversión</span>
                </div>
                <span className="text-green-700 font-bold">40% del score</span>
              </div>
              <p className="text-sm text-green-700 mb-2">
                Porcentaje de prospectos que conviertes en ventas reales.
              </p>
              <div className="text-xs text-green-600">
                📊 <strong>Meta:</strong> 20% o más para obtener el puntaje máximo (40 puntos)
              </div>
            </div>

            {/* Componente 2: Velocidad de proceso */}
            <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800">Velocidad de Proceso</span>
                </div>
                <span className="text-blue-700 font-bold">30% del score</span>
              </div>
              <p className="text-sm text-blue-700 mb-2">
                Qué tan rápido cierras prospectos desde el primer contacto.
              </p>
              <div className="text-xs text-blue-600">
                ⚡ <strong>Meta:</strong> Menos días = mejor score. Ideal bajo 10 días.
              </div>
            </div>

            {/* Componente 3: Probabilidad promedio */}
            <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-400">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-purple-800">Calidad de Prospectos</span>
                </div>
                <span className="text-purple-700 font-bold">30% del score</span>
              </div>
              <p className="text-sm text-purple-700 mb-2">
                Probabilidad promedio de cierre de tus prospectos activos.
              </p>
              <div className="text-xs text-purple-600">
                🎯 <strong>Meta:</strong> Prospectos con alta probabilidad = mejor score.
              </div>
            </div>
          </div>

          {/* Consejos para mejorar */}
          <div className="mt-8 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <h4 className="font-semibold text-yellow-800 mb-3 flex items-center">
              <span className="text-lg mr-2">💡</span>
              Consejos para mejorar tu Score
            </h4>
            <ul className="space-y-2 text-sm text-yellow-700">
              <li className="flex items-start">
                <span className="mr-2">🎯</span>
                <span><strong>Mejor conversión:</strong> Enfócate en prospectos calificados y mejora tu técnica de cierre</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">⚡</span>
                <span><strong>Más velocidad:</strong> Responde rápido, programa seguimientos efectivos y no dejes prospectos "fríos"</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">📈</span>
                <span><strong>Mejor calidad:</strong> Califica bien tus prospectos y ajusta probabilidades realistas</span>
              </li>
            </ul>
          </div>

          {/* Botón cerrar */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setMostrarModalScore(false)}
              className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
            >
              ¡Entendido! 🚀
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Componente de Notificación Toast
  const renderNotificacion = () => {
    if (!notificacion) return null;

    const esExito = notificacion.tipo === 'success';

    return (
      <div className="fixed top-4 right-4 z-50">
        <div className={`
          max-w-sm w-full rounded-lg shadow-lg p-4 border-l-4 transform transition-all duration-300 ease-in-out
          ${esExito
            ? 'bg-green-50 border-green-400 text-green-800'
            : 'bg-red-50 border-red-400 text-red-800'
          }
        `}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {esExito ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                {notificacion.mensaje}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setNotificacion(null)}
                  className={`inline-flex rounded-md p-1.5 transition-colors ${
                    esExito
                      ? 'text-green-500 hover:bg-green-100'
                      : 'text-red-500 hover:bg-red-100'
                  }`}
                >
                  <span className="sr-only">Cerrar</span>
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative" style={{ zIndex: 1 }}>
      {renderBalanza()}
      {renderListaDetalle()}
      {renderModalConfirmar()}
      {renderModalReprogramar()}
      {renderNotificacion()}
      {renderModalScore()}

      {/* Modal Historial Completo */}
      {mostrarHistorial && (
        <HistorialCompleto
          asesorId={asesorId}
          onClose={() => setMostrarHistorial(false)}
        />
      )}
    </div>
  );
};

export default BalanzaSeguimientos;