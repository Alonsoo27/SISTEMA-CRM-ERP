// src/components/prospectos/BalanzaSeguimientos/BalanzaSeguimientos.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock, CheckCircle, AlertTriangle, TrendingUp, Users, Eye,
  RefreshCw, User, Bell, Calendar, ArrowRight, ChevronDown,
  Timer, Target, Award, Activity, BarChart3
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';
import HistorialCompleto from '../HistorialCompleto/HistorialCompleto';
import VistaSelector from '../../common/VistaSelector';
import ModalCompletarConReprogramacion from '../ModalCompletarConReprogramacion';
import ProspectoDetailsView from '../ProspectoDetailsView';
import ModalListaSeguimientos from './ModalListaSeguimientos';
import { formatearFechaHora } from '../../../utils/dateHelpers';

const BalanzaSeguimientos = ({ asesorId: asesorIdProp = null, refreshTrigger = 0 }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalListaAbierto, setModalListaAbierto] = useState(false); // Modal de lista de seguimientos
  const [tipoListaModal, setTipoListaModal] = useState(null); // 'pendientes' | 'completados' | null
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [modalCompletarAbierto, setModalCompletarAbierto] = useState(false);
  const [seguimientoSeleccionado, setSeguimientoSeleccionado] = useState(null);
  const [procesandoCompletar, setProcesandoCompletar] = useState(false);

  // Sistema de notificaciones
  const [notificacion, setNotificacion] = useState(null); // { tipo: 'success'|'error', mensaje: string }

  // Modal historial completo
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // Modal explicativo del Score
  const [mostrarModalScore, setMostrarModalScore] = useState(false);

  // Modal de detalles del prospecto
  const [mostrarDetallesProspecto, setMostrarDetallesProspecto] = useState(false);
  const [prospectoSeleccionadoDetalles, setProspectoSeleccionadoDetalles] = useState(null);

  // Estados para filtros y búsqueda
  const [filtros, setFiltros] = useState({
    tipo: 'todos', // 'todos', 'WhatsApp', 'Llamada', 'Email', etc.
    urgencia: 'todos', // 'todos', 'vencidos', 'hoy', 'proximos'
    busqueda: ''
  });

  // Estado para controlar qué prospectos están expandidos (desplegables)
  const [prospectosExpandidos, setProspectosExpandidos] = useState({});

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

  // 🎯 CALCULAR VISTA INICIAL SEGÚN ROL (síncrono)
  const getVistaInicial = useCallback(() => {
    if (!usuarioActual) {
      console.log('⚠️ [BalanzaSeguimientos] getVistaInicial: usuarioActual es null');
      return null;
    }

    const rolUsuario = usuarioActual.rol?.toUpperCase();
    console.log('🔍 [BalanzaSeguimientos] getVistaInicial:', { rol: rolUsuario, id: usuarioActual.id });

    if (rolUsuario === 'VENDEDOR') {
      console.log('✅ [BalanzaSeguimientos] VENDEDOR detectado, vista inicial:', usuarioActual.id);
      return usuarioActual.id; // VENDEDOR: vista personal
    } else {
      const vista = asesorIdProp !== undefined ? asesorIdProp : null;
      console.log('✅ [BalanzaSeguimientos] EJECUTIVO detectado, vista inicial:', vista);
      return vista; // EJECUTIVOS: prop o global
    }
  }, [usuarioActual, asesorIdProp]);

  // 🎯 Estado interno de vista (inicializado correctamente)
  const [vistaSeleccionada, setVistaSeleccionada] = useState(() => {
    const inicial = getVistaInicial();
    console.log('🎬 [BalanzaSeguimientos] useState inicial con vista:', inicial);
    return inicial;
  });

  // 🔄 Actualizar vista si cambian las dependencias
  useEffect(() => {
    const nuevaVista = getVistaInicial();
    if (nuevaVista !== vistaSeleccionada) {
      setVistaSeleccionada(nuevaVista);
      console.log('🔄 [BalanzaSeguimientos] Vista actualizada a:', nuevaVista);
    }
  }, [getVistaInicial]);

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

  // Función para toggle expandir/colapsar prospecto
  const toggleProspectoExpandido = (prospectoId) => {
    setProspectosExpandidos(prev => ({
      ...prev,
      [prospectoId]: !prev[prospectoId]
    }));
  };

  // Función para abrir modal de lista de seguimientos
  const abrirModalLista = (tipo) => {
    setTipoListaModal(tipo);
    setModalListaAbierto(true);
  };

  useEffect(() => {
    console.log('🔄 [BalanzaSeguimientos] useEffect cargarDatos disparado:', {
      vistaSeleccionada,
      refreshTrigger,
      usuarioActual: usuarioActual?.id,
      rol: usuarioActual?.rol
    });

    // Solo cargar si usuarioActual existe
    if (usuarioActual) {
      cargarDatos();
    } else {
      console.log('⚠️ [BalanzaSeguimientos] No se carga porque usuarioActual es null');
    }
  }, [vistaSeleccionada, refreshTrigger, usuarioActual]);

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

      const response = await prospectosService.obtenerDashboardSeguimientos(asesorIdFinal);

      if (response.success) {
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
    if (!dashboardData) return { pendientes: 0, realizados: 0, balance: 0 };

    const seguimientos = dashboardData.seguimientos || {};
    const conteos = seguimientos.conteos || {}; // ✅ FIX: conteos está dentro de seguimientos

    // ⚖️ LÓGICA REAL DE NEGOCIO:
    // - Sistema usa 18 horas laborales para vencimiento
    // - Vencidos tienen tiempo de recuperación antes de traspaso
    // - Solo seguimientos confirmados van a "realizados"

    // ✅ CORRECCIÓN: Usar conteos.proximos (no pendientes) para evitar contar vencidos dos veces
    const pendientesProximos = conteos.proximos || 0;  // Solo próximos (sin vencidos)
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

    return resultado;
  }, [dashboardData]);

  // 🎯 Datos filtrados para el modal
  const datosModalFiltrados = useMemo(() => {
    if (!dashboardData || !tipoListaModal) return [];

    const seguimientos = dashboardData.seguimientos || {};
    let datos = tipoListaModal === 'pendientes'
      ? [...(seguimientos.proximos || []), ...(seguimientos.vencidos || [])]
      : seguimientos.realizados_semana || [];

    // Aplicar filtros
    datos = datos.filter(item => {
      // Filtro por tipo
      if (filtros.tipo !== 'todos' && item.tipo !== filtros.tipo) {
        return false;
      }

      // Filtro por urgencia (solo para pendientes)
      if (tipoListaModal === 'pendientes' && filtros.urgencia !== 'todos') {
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

    // 🎯 AGRUPACIÓN POR PROSPECTO (solo para completados)
    if (tipoListaModal === 'completados') {
      const gruposPorProspecto = {};

      datos.forEach(seguimiento => {
        const prospectoId = seguimiento.prospecto_id || seguimiento.id;

        if (!gruposPorProspecto[prospectoId]) {
          gruposPorProspecto[prospectoId] = {
            prospecto: seguimiento,
            seguimientos: [],
            seguimiento_mas_reciente: seguimiento
          };
        }

        gruposPorProspecto[prospectoId].seguimientos.push(seguimiento);

        // Actualizar el más reciente
        const fechaActual = new Date(seguimiento.fecha_completado || seguimiento.created_at);
        const fechaReciente = new Date(gruposPorProspecto[prospectoId].seguimiento_mas_reciente.fecha_completado || gruposPorProspecto[prospectoId].seguimiento_mas_reciente.created_at);

        if (fechaActual > fechaReciente) {
          gruposPorProspecto[prospectoId].seguimiento_mas_reciente = seguimiento;
        }
      });

      return Object.values(gruposPorProspecto);
    }

    return datos;
  }, [dashboardData, tipoListaModal, filtros]);

  // Tipos disponibles para el filtro
  const tiposDisponibles = useMemo(() => {
    if (!dashboardData) return [];
    const seguimientos = dashboardData.seguimientos || {};
    return [...new Set([
      ...(seguimientos.proximos || []).map(s => s.tipo),
      ...(seguimientos.vencidos || []).map(s => s.tipo),
      ...(seguimientos.realizados_semana || []).map(s => s.tipo)
    ])].filter(Boolean);
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

    return inclinacion;
  };

  // Función para abrir modal de completar con reprogramación
  const abrirModalCompletar = (seguimiento) => {
    setSeguimientoSeleccionado(seguimiento);
    setModalCompletarAbierto(true);
  };

  // Función para abrir modal de detalles del prospecto
  const abrirDetallesProspecto = async (item) => {
    try {
      // Obtener el ID del prospecto
      const prospectoId = item.prospecto_id || item.id;

      if (!prospectoId) {
        mostrarNotificacion('error', 'No se pudo obtener el ID del prospecto');
        return;
      }

      // Cargar datos completos del prospecto
      const response = await prospectosService.obtenerPorId(prospectoId);

      if (response.success && response.data) {
        setProspectoSeleccionadoDetalles(response.data);
        setMostrarDetallesProspecto(true);
      } else {
        mostrarNotificacion('error', 'Error al cargar el prospecto');
      }
    } catch (error) {
      console.error('Error cargando prospecto:', error);
      mostrarNotificacion('error', 'Error al cargar el prospecto');
    }
  };

  // Función para completar seguimiento con reprogramación múltiple
  const completarSeguimientoConReprogramacion = async (payload) => {
    try {
      setProcesandoCompletar(true);

      console.log('🔄 Completando seguimiento con reprogramación:', payload);

      // Llamar a la API con la nueva estructura que soporta múltiples seguimientos futuros
      const response = await prospectosService.completarSeguimiento(payload.seguimiento_id, {
        resultado: payload.resultado,
        notas: payload.notas,
        calificacion: payload.calificacion,
        seguimientos_futuros: payload.seguimientos_futuros // Array de seguimientos
      });

      if (response.success) {
        console.log('✅ Seguimiento completado exitosamente');

        // Mensaje dinámico según cantidad de reprogramaciones
        const cantidadSeguimientos = payload.seguimientos_futuros.length;
        let mensaje = '✅ Seguimiento completado';

        if (cantidadSeguimientos > 0) {
          mensaje += ` y ${cantidadSeguimientos} seguimiento${cantidadSeguimientos > 1 ? 's' : ''} programado${cantidadSeguimientos > 1 ? 's' : ''}`;
        }

        // Verificar si hubo conversión automática
        if (response.data?.conversion?.success) {
          mostrarNotificacion('success', `🎉 ${mensaje} - Venta creada: ${response.data.conversion.venta_codigo}`);
          console.log('🎯 Conversión automática exitosa:', response.data.conversion);
        } else if (response.data?.conversion?.success === false) {
          mostrarNotificacion('warning', `${mensaje}. ${response.data.conversion.error || 'Conversión pendiente'}`);
          console.log('⚠️ Error en conversión automática:', response.data.conversion);
        } else {
          mostrarNotificacion('success', mensaje);
        }

        // Recargar datos
        await cargarDatos();

        // Si hubo conversión exitosa, recargar después de un momento
        if (response.data?.conversion?.success) {
          console.log('🔄 Recargando pipeline después de conversión...');
          setTimeout(async () => {
            await cargarDatos();
          }, 2000);
        }

        // Cerrar modal
        setModalCompletarAbierto(false);
        setSeguimientoSeleccionado(null);
      } else {
        throw new Error(response.error || 'Error al completar seguimiento');
      }

    } catch (error) {
      console.error('❌ Error completando seguimiento:', error);
      mostrarNotificacion('error', '❌ Error: ' + error.message);
    } finally {
      setProcesandoCompletar(false);
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
            <VistaSelector
              usuarioActual={usuarioActual}
              onVistaChange={handleCambioVista}
              vistaActual={vistaSeleccionada}
              textos={{
                global: 'Vista Global',
                globalDesc: 'Todos los seguimientos',
                personal: 'Mi Vista Personal',
                personalDesc: 'Solo mis seguimientos',
                otrosLabel: 'Otros Asesores'
              }}
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
                  onClick={() => abrirModalLista('pendientes')}
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
                  onClick={() => abrirModalLista('completados')}
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
      {renderNotificacion()}
      {renderModalScore()}

      {/* Modal Completar con Reprogramación */}
      <ModalCompletarConReprogramacion
        isOpen={modalCompletarAbierto}
        seguimiento={seguimientoSeleccionado}
        onClose={() => {
          setModalCompletarAbierto(false);
          setSeguimientoSeleccionado(null);
        }}
        onSubmit={completarSeguimientoConReprogramacion}
        loading={procesandoCompletar}
      />

      {/* Modal Historial Completo */}
      {mostrarHistorial && (
        <HistorialCompleto
          asesorId={vistaSeleccionada}
          onClose={() => setMostrarHistorial(false)}
        />
      )}

      {/* Modal Detalles del Prospecto */}
      {mostrarDetallesProspecto && prospectoSeleccionadoDetalles && (
        <ProspectoDetailsView
          prospecto={prospectoSeleccionadoDetalles}
          onClose={() => {
            setMostrarDetallesProspecto(false);
            setProspectoSeleccionadoDetalles(null);
          }}
          onEdit={(prospecto) => {
            // Cerrar el modal de detalles
            setMostrarDetallesProspecto(false);
            setProspectoSeleccionadoDetalles(null);
            // Aquí podrías agregar lógica para abrir el formulario de edición si fuera necesario
            console.log('Editar prospecto:', prospecto);
          }}
          currentUser={usuarioActual}
        />
      )}

      {/* Modal Lista de Seguimientos */}
      <ModalListaSeguimientos
        isOpen={modalListaAbierto}
        onClose={() => {
          setModalListaAbierto(false);
          setTipoListaModal(null);
        }}
        tipo={tipoListaModal}
        datos={datosModalFiltrados}
        filtros={filtros}
        setFiltros={setFiltros}
        tiposDisponibles={tiposDisponibles}
        prospectosExpandidos={prospectosExpandidos}
        toggleExpansion={toggleProspectoExpandido}
        onCompletarSeguimiento={abrirModalCompletar}
        onVerDetalles={abrirDetallesProspecto}
      />
    </div>
  );
};

export default BalanzaSeguimientos;