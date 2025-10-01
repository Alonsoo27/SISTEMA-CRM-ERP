// src/components/prospectos/SeguimientosDashboard/SeguimientosDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Clock, AlertTriangle, Calendar, Phone, Mail, MessageSquare,
  MapPin, CheckCircle, XCircle, RefreshCw, User, Bell, Settings,
  TrendingUp, Eye, ExternalLink, Loader2, ChevronDown, ChevronUp,
  Zap, Filter, BarChart3, Target, Star, DollarSign, Users,
  Flame, ShieldAlert, Award, Activity
} from 'lucide-react';
import prospectosService from '../../../services/prospectosService';

const SeguimientosDashboard = ({ asesorId = null, refreshTrigger = 0 }) => {
  const [dashboardData, setDashboardData] = useState({
    seguimientos: { proximos: [], vencidos: [], hoy: [] },
    conteos: {},
    metricas: {},
    alertas: {},
    sistema: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [procesandoVencidos, setProcesandoVencidos] = useState(false);
  const [notification, setNotification] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    criticos: true,
    medios: true,
    bajos: false
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [modoProcesamientoAvanzado, setModoProcesamientoAvanzado] = useState(true);
  const [filtrosActivos, setFiltrosActivos] = useState({
    valor_minimo: null,
    solo_alta_prioridad: false
  });
  const intervalRef = useRef(null);

  // Auto-refresh cada 5 minutos si está habilitado
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        cargarDashboardSeguimientos(true); // silent refresh
      }, 5 * 60 * 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  useEffect(() => {
    cargarDashboardSeguimientos();
  }, [asesorId, refreshTrigger]);

  const cargarDashboardSeguimientos = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      
      const response = await prospectosService.obtenerDashboardSeguimientos(asesorId);
      
      if (!response.success) throw new Error(response.error);
      
      const nuevosSegimientos = {
        pendientes: response.data.seguimientos?.proximos || [],
        vencidos: response.data.seguimientos?.vencidos || [],
        completados_hoy: response.data.seguimientos?.hoy || [],
        stats: {
          ...response.data.metricas,
          conteos: response.data.conteos,
          sistema: response.data.sistema
        }
      };

      setSeguimientos(nuevosSegimientos);
      setLastUpdate(new Date());
      
      if (!silent) {
        console.log(`✅ Seguimientos cargados: ${response.data.conteos?.total || 0} total, ${response.data.conteos?.vencidos || 0} vencidos`);
      }
      
      // Mostrar notificación si hay nuevos vencidos (solo en refresh automático)
      if (silent && response.data.conteos?.vencidos > seguimientos.stats.conteos?.vencidos) {
        mostrarNotificacion('warning', `⚠️ Nuevos seguimientos vencidos detectados: ${response.data.conteos.vencidos}`);
      }
      
    } catch (err) {
      setError(err.message);
      console.error('❌ Error cargando seguimientos desde API:', err);
      
      if (!silent) {
        setSeguimientos({
          pendientes: [],
          vencidos: [],
          completados_hoy: [],
          stats: { conteos: { total: 0, pendientes: 0, vencidos: 0, completados_hoy: 0 } }
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [asesorId, seguimientos.stats.conteos?.vencidos]);

  const mostrarNotificacion = useCallback((tipo, mensaje, duracion = 4000) => {
    setNotification({ tipo, mensaje });
    setTimeout(() => setNotification(null), duracion);
  }, []);

  const completarSeguimiento = async (seguimientoId, resultado = '') => {
    try {
      if (seguimientoId.startsWith('prospecto_')) {
        const prospectoId = seguimientoId.replace('prospecto_', '');
        
        await prospectosService.actualizar(prospectoId, {
          seguimiento_completado: true,
          fecha_seguimiento: new Date().toISOString(),
          resultado_seguimiento: resultado
        });
        
        mostrarNotificacion('success', '✅ Seguimiento marcado como completado');
        cargarDashboardSeguimientos();
      }
    } catch (err) {
      mostrarNotificacion('error', 'Error completando seguimiento: ' + err.message);
    }
  };

  const posponerSeguimiento = async (seguimientoId, nuevaFecha, motivo) => {
    try {
      if (seguimientoId.startsWith('prospecto_')) {
        const prospectoId = seguimientoId.replace('prospecto_', '');
        
        // Validaciones mejoradas
        if (!nuevaFecha?.trim()) {
          throw new Error('La fecha es requerida');
        }
        
        if (!motivo?.trim()) {
          throw new Error('El motivo es requerido');
        }

        const fechaValida = new Date(nuevaFecha);
        if (isNaN(fechaValida.getTime())) {
          throw new Error('Formato de fecha inválido. Use: YYYY-MM-DD HH:MM');
        }

        const ahora = new Date();
        if (fechaValida <= ahora) {
          throw new Error('La nueva fecha debe ser futura');
        }
        
        await prospectosService.actualizar(prospectoId, {
          seguimiento_obligatorio: nuevaFecha,
          fecha_seguimiento: nuevaFecha,
          seguimiento_completado: false,
          motivo_postergacion: motivo
        });
        
        mostrarNotificacion('success', '📅 Seguimiento reprogramado correctamente');
        cargarDashboardSeguimientos();
      }
    } catch (err) {
      mostrarNotificacion('error', err.message);
    }
  };

  /**
   * 🚀 MÉTODO SUPERIOR UNIFICADO - INTEGRADO CON EL NUEVO BACKEND
   * Usa el método unificado con opciones configurables
   */
  const procesarSeguimientosVencidos = async (opcionesPersonalizadas = {}) => {
    if (seguimientos.vencidos.length === 0) {
      mostrarNotificacion('info', 'ℹ️ No hay seguimientos vencidos que procesar');
      return;
    }

    try {
      setProcesandoVencidos(true);
      
      // Mostrar loading inicial
      mostrarNotificacion('info', '🔄 Procesando seguimientos vencidos...', 2000);
      
      // CONFIGURACIÓN INTELIGENTE: Usar método unificado superior
      const opcionesProcesamiento = {
        modo: modoProcesamientoAvanzado ? 'mejorado' : 'basico',
        incluir_notificaciones: modoProcesamientoAvanzado,
        generar_estadisticas: true,
        crear_reporte_detallado: modoProcesamientoAvanzado,
        filtros: {
          ...(asesorId ? { asesor_id: asesorId } : {}),
          ...(filtrosActivos.valor_minimo ? { valor_minimo: filtrosActivos.valor_minimo } : {}),
          ...opcionesPersonalizadas
        }
      };

      console.log('🔧 Opciones de procesamiento:', opcionesProcesamiento);
      
      // USAR EL MÉTODO UNIFICADO SUPERIOR
      const response = await prospectosService.procesarSeguimientosVencidos(opcionesProcesamiento);
      
      if (!response.success) {
        throw new Error(response.error || 'Error desconocido en el procesamiento');
      }

      const { data } = response;
      
      // Mostrar resultado según el éxito
      if (data.exitosos > 0) {
        // Mostrar notificación de éxito con estadísticas
        mostrarNotificacion('success', 
          `✅ Procesamiento ${data.modo_ejecutado}: ${data.exitosos}/${data.total_procesados} seguimientos`, 
          6000
        );

        // Modal detallado mejorado para el método unificado
        const alertasHtml = data.alertas ? `
          <div class="bg-orange-50 p-4 rounded-lg border border-orange-200 mb-4">
            <h4 class="font-semibold text-orange-900 mb-2">🚨 Alertas del Sistema:</h4>
            <ul class="text-sm text-orange-800 space-y-1">
              ${data.alertas.valor_alto_riesgo ? '<li>• ⚠️ Valor en alto riesgo: Superior a $50,000</li>' : ''}
              ${data.alertas.multiples_asesores_afectados ? '<li>• 👥 Múltiples asesores afectados (>3)</li>' : ''}
              ${data.alertas.tasa_error_alta ? '<li>• ❌ Tasa de error elevada</li>' : ''}
              ${data.alertas.seguimientos_muy_vencidos ? '<li>• ⏰ Seguimientos con más de 30 días de retraso</li>' : ''}
            </ul>
          </div>
        ` : '';

        const estadisticasHtml = data.estadisticas ? `
          <div class="bg-blue-50 p-4 rounded-lg mb-4">
            <h4 class="font-semibold text-blue-900 mb-2">📊 Estadísticas Detalladas:</h4>
            <div class="grid grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <ul class="space-y-1">
                  <li>• <strong>Procesados:</strong> ${data.estadisticas.procesados_exitosamente || data.exitosos}</li>
                  <li>• <strong>Errores:</strong> ${data.estadisticas.errores || data.errores}</li>
                  <li>• <strong>Tasa éxito:</strong> ${data.estadisticas.tasa_exito || '100%'}</li>
                </ul>
              </div>
              <div>
                <ul class="space-y-1">
                  <li>• <strong>Valor afectado:</strong> $${(data.estadisticas.valor_total_afectado || 0).toLocaleString()}</li>
                  <li>• <strong>Asesores:</strong> ${data.estadisticas.asesores_afectados || 1}</li>
                  <li>• <strong>Notificaciones:</strong> ${data.notificaciones_enviadas?.length || 0}</li>
                </ul>
              </div>
            </div>
          </div>
        ` : '';

        const resumenHtml = data.resumen ? `
          <div class="bg-green-50 p-4 rounded-lg">
            <h4 class="font-semibold text-green-900 mb-2">🎯 Próximos Pasos:</h4>
            <ul class="text-sm text-green-800 space-y-1">
              ${data.resumen.proximos_pasos?.map(paso => `<li>• ${paso}</li>`).join('') || '<li>• Seguimientos procesados correctamente</li>'}
            </ul>
          </div>
        ` : '';

        // Usar SweetAlert2 o modal nativo dependiendo de disponibilidad
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: data.resumen?.titulo || `✅ Procesamiento ${data.modo_ejecutado.toUpperCase()} Completado`,
            html: `
              <div class="text-left space-y-4">
                <p class="text-gray-700 mb-4">${data.resumen?.descripcion || `Se procesaron ${data.exitosos} seguimientos vencidos exitosamente.`}</p>
                
                ${alertasHtml}
                ${estadisticasHtml}
                ${resumenHtml}

                ${data.filtros_aplicados ? `
                  <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 class="font-semibold text-purple-900 mb-2">🔍 Filtros Aplicados:</h4>
                    <pre class="text-xs text-purple-800">${JSON.stringify(data.filtros_aplicados, null, 2)}</pre>
                  </div>
                ` : ''}
              </div>
            `,
            icon: data.resumen?.criticidad === 'alta' ? 'warning' : 'success',
            confirmButtonText: 'Entendido',
            confirmButtonColor: data.resumen?.criticidad === 'alta' ? '#EF4444' : '#10B981',
            width: 800,
            customClass: {
              popup: 'text-left'
            }
          });
        } else {
          // Fallback para modal nativo
          alert(`✅ Procesamiento ${data.modo_ejecutado} completado: ${data.exitosos}/${data.total_procesados} seguimientos procesados`);
        }

      } else {
        // Sin seguimientos procesados
        mostrarNotificacion('warning', 
          `⚠️ No se pudieron procesar seguimientos: ${data.errores} errores`, 
          5000
        );
        
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: '⚠️ Procesamiento Sin Resultados',
            text: `Se encontraron ${data.total_procesados} seguimientos vencidos, pero no se pudieron procesar. Revisar logs del sistema.`,
            icon: 'warning',
            confirmButtonText: 'Revisar Logs',
            confirmButtonColor: '#F59E0B'
          });
        }
      }

      // Recargar datos para reflejar cambios
      setTimeout(() => {
        cargarDashboardSeguimientos();
      }, 1000);

      // Log detallado para debug
      console.log('📊 Procesamiento unificado completado:', {
        modo_ejecutado: data.modo_ejecutado,
        total_procesados: data.total_procesados,
        exitosos: data.exitosos,
        errores: data.errores,
        valor_afectado: data.estadisticas?.valor_total_afectado || 0,
        asesores_afectados: data.estadisticas?.asesores_afectados || 0,
        notificaciones_enviadas: data.notificaciones_enviadas?.length || 0,
        filtros_aplicados: data.filtros_aplicados,
        opciones_usadas: opcionesProcesamiento
      });

    } catch (err) {
      console.error('❌ Error procesando seguimientos:', err);
      
      mostrarNotificacion('error', `❌ Error: ${err.message}`, 6000);
      
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: '❌ Error en Procesamiento',
          text: `Ocurrió un error al procesar los seguimientos: ${err.message}`,
          icon: 'error',
          confirmButtonText: 'Reintentar',
          confirmButtonColor: '#EF4444',
          showCancelButton: true,
          cancelButtonText: 'Cerrar'
        }).then((result) => {
          if (result.isConfirmed) {
            // Reintentar automáticamente
            procesarSeguimientosVencidos();
          }
        });
      } else {
        // Fallback sin SweetAlert
        if (confirm(`❌ Error: ${err.message}\n\n¿Desea reintentar?`)) {
          procesarSeguimientosVencidos();
        }
      }
      
    } finally {
      setProcesandoVencidos(false);
    }
  };

  /**
   * 🎯 MÉTODOS DE CONVENIENCIA para diferentes tipos de procesamiento
   */
  const procesarSeguimientosBasico = () => {
    procesarSeguimientosVencidos({ modo: 'basico' });
  };

  const procesarSeguimientosAltoValor = () => {
    const valorMinimo = prompt('Ingrese el valor mínimo para filtrar (ejemplo: 10000):');
    if (valorMinimo && !isNaN(valorMinimo)) {
      procesarSeguimientosVencidos({ 
        filtros: { valor_minimo: parseFloat(valorMinimo) }
      });
    }
  };

  const formatearFecha = useCallback((fecha) => {
    if (!fecha) return 'Sin fecha';
    const fechaObj = new Date(fecha);
    const ahora = new Date();
    const diffHoras = (fechaObj - ahora) / (1000 * 60 * 60);
    
    if (diffHoras < 0) {
      const horasVencidas = Math.abs(Math.floor(diffHoras));
      if (horasVencidas < 24) {
        return `Vencido hace ${horasVencidas}h`;
      } else if (horasVencidas < 48) {
        return `Vencido hace 1 día`;
      } else {
        return `Vencido hace ${Math.floor(horasVencidas / 24)} días`;
      }
    } else if (diffHoras < 1) {
      return `En ${Math.floor(diffHoras * 60)} min`;
    } else if (diffHoras < 24) {
      return `En ${Math.floor(diffHoras)}h`;
    } else if (diffHoras < 48) {
      return `Mañana`;
    } else {
      return fechaObj.toLocaleDateString('es-PE', { 
        day: '2-digit', 
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }, []);

  const getTipoIcon = useCallback((tipo) => {
    const iconos = {
      'WhatsApp': MessageSquare,
      'Llamada': Phone,
      'Email': Mail,
      'Presencial': MapPin,
      'Messenger': MessageSquare,
      'Facebook': MessageSquare,
      'TikTok': MessageSquare
    };
    return iconos[tipo] || Phone;
  }, []);

  const obtenerUrgenciaSeguimiento = useCallback((fechaProgramada) => {
    const ahora = new Date();
    const fecha = new Date(fechaProgramada);
    const diffHoras = (fecha - ahora) / (1000 * 60 * 60);
    const diffDias = diffHoras / 24;
    
    if (diffDias <= 1) {
      return {
        nivel: 'critico',
        color: 'red',
        bgColor: 'bg-red-50',
        borderColor: 'border-l-red-500',
        textColor: 'text-red-600',
        descripcion: diffDias < 0 ? 'Vencido' : 'Urgente (hoy/mañana)',
        priority: 1
      };
    } else if (diffDias <= 5) {
      return {
        nivel: 'medio',
        color: 'yellow',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-l-yellow-500',
        textColor: 'text-yellow-600',
        descripcion: 'Próximo (hasta 5 días)',
        priority: 2
      };
    } else {
      return {
        nivel: 'bajo',
        color: 'green',
        bgColor: 'bg-green-50',
        borderColor: 'border-l-green-500',
        textColor: 'text-green-600',
        descripcion: 'Programado (más de 5 días)',
        priority: 3
      };
    }
  }, []);

  const seguimientosPorUrgencia = useMemo(() => {
    if (!seguimientos.pendientes.length) {
      return { criticos: [], medios: [], bajos: [] };
    }

    const categorizado = seguimientos.pendientes.reduce((acc, seguimiento) => {
      const urgencia = obtenerUrgenciaSeguimiento(seguimiento.fecha_programada);
      
      switch (urgencia.nivel) {
        case 'critico':
          acc.criticos.push({ ...seguimiento, urgencia });
          break;
        case 'medio':
          acc.medios.push({ ...seguimiento, urgencia });
          break;
        case 'bajo':
          acc.bajos.push({ ...seguimiento, urgencia });
          break;
      }
      
      return acc;
    }, { criticos: [], medios: [], bajos: [] });

    // Ordenar cada categoría por fecha
    Object.keys(categorizado).forEach(key => {
      categorizado[key].sort((a, b) => new Date(a.fecha_programada) - new Date(b.fecha_programada));
    });

    return categorizado;
  }, [seguimientos.pendientes, obtenerUrgenciaSeguimiento]);

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const SeguimientoCard = ({ seguimiento, tipo = 'pendiente' }) => {
    const IconComponent = getTipoIcon(seguimiento.tipo);
    const esVencido = tipo === 'vencido';
    const esCompletado = tipo === 'completado';
    const urgencia = seguimiento.urgencia || (esVencido ? null : obtenerUrgenciaSeguimiento(seguimiento.fecha_programada));

    return (
      <div className={`bg-white rounded-lg border-l-4 p-4 shadow-sm hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1 ${
        esVencido ? 'border-l-red-500 bg-red-50' : 
        esCompletado ? 'border-l-green-500 bg-green-50' : 
        urgencia ? `${urgencia.borderColor} ${urgencia.bgColor}` :
        'border-l-blue-500'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2 flex-wrap gap-2">
              <div className="flex items-center">
                <IconComponent className={`h-4 w-4 mr-2 ${
                  esVencido ? 'text-red-600' : 
                  esCompletado ? 'text-green-600' : 
                  urgencia ? urgencia.textColor :
                  'text-blue-600'
                }`} />
                <h4 className="font-medium text-gray-900">
                  {seguimiento.prospecto_nombre || 'Prospecto'}
                </h4>
              </div>
              
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {seguimiento.prospecto_codigo}
              </span>
              
              {urgencia && !esVencido && !esCompletado && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  urgencia.nivel === 'critico' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                  urgencia.nivel === 'medio' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                  'bg-green-100 text-green-700 hover:bg-green-200'
                }`}>
                  {urgencia.descripcion}
                </span>
              )}
              
              {esVencido && seguimiento.horas_laborales_pasadas && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse">
                  +{seguimiento.horas_laborales_pasadas}h laborales
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-600 mb-3">
              {seguimiento.descripcion || `${seguimiento.tipo} programada`}
            </p>
            
            <div className="flex items-center text-xs text-gray-500 space-x-4 flex-wrap gap-2">
              <span className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {formatearFecha(seguimiento.fecha_programada)}
              </span>
              <span className="flex items-center">
                <User className="h-3 w-3 mr-1" />
                {seguimiento.asesor_nombre}
              </span>
              {seguimiento.telefono && (
                <span className="flex items-center">
                  <Phone className="h-3 w-3 mr-1" />
                  {seguimiento.telefono}
                </span>
              )}
              {seguimiento.estado && (
                <span className="flex items-center">
                  <Eye className="h-3 w-3 mr-1" />
                  {seguimiento.estado}
                </span>
              )}
            </div>
          </div>

          {!esCompletado && (
            <div className="flex space-x-1 ml-2">
              <button
                onClick={() => completarSeguimiento(seguimiento.id, 'Completado desde dashboard')}
                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full transition-all duration-200"
                title="Marcar como completado"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const nuevaFecha = prompt('Nueva fecha (YYYY-MM-DD HH:MM):\nEjemplo: 2025-07-28 14:30');
                  if (nuevaFecha) {
                    const motivo = prompt('Motivo de la postergación:');
                    if (motivo) {
                      posponerSeguimiento(seguimiento.id, nuevaFecha, motivo);
                    }
                  }
                }}
                className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded-full transition-all duration-200"
                title="Posponer"
              >
                <Clock className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {seguimiento.resultado && (
          <div className="mt-3 p-2 bg-gray-50 rounded text-xs border-l-2 border-gray-300">
            <strong>Resultado:</strong> {seguimiento.resultado}
          </div>
        )}
      </div>
    );
  };

  const Notification = () => {
    if (!notification) return null;

    const colors = {
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
    };

    return (
      <div className={`fixed top-4 right-4 p-4 rounded-lg border z-50 shadow-lg animate-slide-in ${colors[notification.tipo]}`}>
        <div className="flex items-center">
          {notification.tipo === 'success' && <CheckCircle className="h-5 w-5 mr-2" />}
          {notification.tipo === 'error' && <XCircle className="h-5 w-5 mr-2" />}
          {notification.tipo === 'info' && <Bell className="h-5 w-5 mr-2" />}
          {notification.tipo === 'warning' && <AlertTriangle className="h-5 w-5 mr-2" />}
          <span className="font-medium">{notification.mensaje}</span>
        </div>
      </div>
    );
  };

  const SectionHeader = ({ title, count, icon: Icon, urgency, isExpanded, onToggle, color }) => (
    <div 
      className={`flex items-center justify-between p-3 ${color} rounded-lg cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onToggle}
    >
      <h4 className="text-sm font-medium flex items-center">
        <Icon className="h-4 w-4 mr-2" />
        {title} ({count})
        {urgency === 'critico' && <span className="ml-2 animate-pulse">🔴</span>}
      </h4>
      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Cargando seguimientos...</span>
        </div>
      </div>
    );
  }

  const stats = seguimientos.stats || {};
  const conteos = stats.conteos || {};

  return (
    <div className="space-y-6">
      <Notification />
      
      {/* Header con estadísticas mejoradas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-100">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{conteos.pendientes || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-red-100">
              <AlertTriangle className={`h-6 w-6 text-red-600 ${conteos.vencidos > 0 ? 'animate-pulse' : ''}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Vencidos</p>
              <p className="text-2xl font-bold text-gray-900">{conteos.vencidos || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completados Hoy</p>
              <p className="text-2xl font-bold text-gray-900">{conteos.completados_hoy || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Efectividad</p>
              <p className="text-2xl font-bold text-gray-900">{stats.efectividad || 0}%</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-100">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Panel de control mejorado */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4 flex-wrap gap-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Auto-actualizar (5 min)</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={modoProcesamientoAvanzado}
                onChange={(e) => setModoProcesamientoAvanzado(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700 flex items-center">
                <Zap className="h-4 w-4 mr-1 text-blue-600" />
                Procesamiento Avanzado
              </span>
            </label>
            
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Última actualización: {lastUpdate.toLocaleTimeString('es-PE')}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => cargarDashboardSeguimientos()}
              className="flex items-center px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
              title="Refrescar ahora"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Actualizar
            </button>
            
            <button
              onClick={() => {
                const minimo = prompt('Valor mínimo para filtrar (ejemplo: 10000):');
                if (minimo && !isNaN(minimo)) {
                  setFiltrosActivos({...filtrosActivos, valor_minimo: parseFloat(minimo)});
                }
              }}
              className="flex items-center px-3 py-1 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
              title="Configurar filtros"
            >
              <Filter className="h-4 w-4 mr-1" />
              Filtros
            </button>
          </div>
        </div>

        {filtrosActivos.valor_minimo && (
          <div className="mt-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
            <span className="text-sm text-purple-700">
              🔍 Filtro activo: Valor mínimo ${filtrosActivos.valor_minimo.toLocaleString()}
              <button
                onClick={() => setFiltrosActivos({...filtrosActivos, valor_minimo: null})}
                className="ml-2 text-purple-600 hover:text-purple-800"
              >
                ✖️
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Alertas de seguimientos vencidos con opciones mejoradas */}
      {seguimientos.vencidos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center mb-3 flex-wrap gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2 animate-pulse" />
            <h3 className="text-lg font-medium text-red-800">
              🚨 Seguimientos Vencidos ({seguimientos.vencidos.length})
            </h3>
            
            <div className="ml-auto flex items-center space-x-2 flex-wrap gap-2">
              <button
                onClick={procesarSeguimientosBasico}
                disabled={procesandoVencidos}
                className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center"
                title="Procesamiento rápido y básico"
              >
                <Target className="h-4 w-4 mr-1" />
                Básico
              </button>
              
              <button
                onClick={procesarSeguimientosAltoValor}
                disabled={procesandoVencidos}
                className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center"
                title="Solo prospectos de alto valor"
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Alto Valor
              </button>

              <button
                onClick={() => procesarSeguimientosVencidos()}
                disabled={procesandoVencidos}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center"
                title="Procesamiento completo con todas las funciones"
              >
                {procesandoVencidos ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    {modoProcesamientoAvanzado ? 'Completo' : 'Estándar'}
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seguimientos.vencidos.map((seguimiento) => (
              <SeguimientoCard key={seguimiento.id} seguimiento={seguimiento} tipo="vencido" />
            ))}
          </div>
        </div>
      )}

      {/* Seguimientos pendientes organizados por urgencia */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Seguimientos Pendientes ({seguimientos.pendientes.length})
          </h3>
        </div>
        <div className="p-6">
          {seguimientos.pendientes.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No hay seguimientos pendientes</p>
              <p className="text-sm text-gray-500 mt-2">
                Los seguimientos aparecerán cuando tengas prospectos con fechas programadas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Críticos */}
              {seguimientosPorUrgencia.criticos.length > 0 && (
                <div>
                  <SectionHeader
                    title="Urgentes - Hoy y Mañana"
                    count={seguimientosPorUrgencia.criticos.length}
                    icon={AlertTriangle}
                    urgency="critico"
                    isExpanded={expandedSections.criticos}
                    onToggle={() => toggleSection('criticos')}
                    color="bg-red-100 text-red-700"
                  />
                  {expandedSections.criticos && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {seguimientosPorUrgencia.criticos.map((seguimiento) => (
                        <SeguimientoCard key={seguimiento.id} seguimiento={seguimiento} tipo="pendiente" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Medios */}
              {seguimientosPorUrgencia.medios.length > 0 && (
                <div>
                  <SectionHeader
                    title="Próximos - Hasta 5 Días"
                    count={seguimientosPorUrgencia.medios.length}
                    icon={Clock}
                    isExpanded={expandedSections.medios}
                    onToggle={() => toggleSection('medios')}
                    color="bg-yellow-100 text-yellow-700"
                  />
                  {expandedSections.medios && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {seguimientosPorUrgencia.medios.map((seguimiento) => (
                        <SeguimientoCard key={seguimiento.id} seguimiento={seguimiento} tipo="pendiente" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bajos */}
              {seguimientosPorUrgencia.bajos.length > 0 && (
                <div>
                  <SectionHeader
                    title="Programados - Más de 5 Días"
                    count={seguimientosPorUrgencia.bajos.length}
                    icon={Calendar}
                    isExpanded={expandedSections.bajos}
                    onToggle={() => toggleSection('bajos')}
                    color="bg-green-100 text-green-700"
                  />
                  {expandedSections.bajos && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {seguimientosPorUrgencia.bajos.map((seguimiento) => (
                        <SeguimientoCard key={seguimiento.id} seguimiento={seguimiento} tipo="pendiente" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Seguimientos completados hoy */}
      {seguimientos.completados_hoy.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Completados Hoy ({seguimientos.completados_hoy.length})
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {seguimientos.completados_hoy.map((seguimiento) => (
                <SeguimientoCard key={seguimiento.id} seguimiento={seguimiento} tipo="completado" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Información del sistema mejorada */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-start">
          <Settings className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-800 mb-1">🚀 Sistema de Seguimientos Avanzado v2.0</h4>
            <p className="text-sm text-blue-700 mb-2">
              Procesamiento unificado con opciones configurables. 
              Modo avanzado incluye: estadísticas detalladas, notificaciones automáticas, filtros personalizados y alertas inteligentes.
            </p>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• 🎯 Procesamiento básico: Rápido y eficiente</li>
              <li>• ⚡ Procesamiento avanzado: Completo con estadísticas y notificaciones</li>
              <li>• 🔍 Filtros: Por asesor, valor mínimo, estado específico</li>
              <li>• 📊 Alertas: Valores altos, múltiples asesores, errores</li>
            </ul>
            
            {stats.sistema && (
              <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-600">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <p>📅 Última actualización: {new Date(stats.sistema.ultima_actualizacion).toLocaleString('es-PE')}</p>
                  <p>📊 Prospectos evaluados: {stats.sistema.prospectos_evaluados}</p>
                  {stats.sistema.filtro_asesor && (
                    <p>👤 Filtrado por asesor ID: {stats.sistema.filtro_asesor}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-400 mr-2" />
            <div>
              <p className="text-red-700 font-medium">Error del sistema</p>
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => cargarDashboardSeguimientos()}
                className="mt-2 text-sm text-red-600 underline hover:text-red-800"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeguimientosDashboard;