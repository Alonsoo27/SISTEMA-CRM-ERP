// src/components/ventas/ActividadPage/ActividadPageEnhanced.jsx
import React, { useState, useEffect } from 'react';
import {
  Clock, CheckCircle, XCircle, Activity, Phone, MessageSquare,
  Play, Square, RefreshCw, AlertCircle, Timer, Calendar,
  User, BarChart3, Eye, TrendingUp, History, ChevronDown,
  ChevronUp, Target, Users, Zap, Award, Filter, Bell
} from 'lucide-react';
import { API_CONFIG } from '../../../config/apiConfig';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import actividadService from '../../../services/actividadService';
import ModalCheckIn from './ModalCheckIn';
import ModalCheckOut from './ModalCheckOut';

const ActividadPageEnhanced = () => {
  // Estados principales
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalCheckInOpen, setModalCheckInOpen] = useState(false);
  const [modalCheckOutOpen, setModalCheckOutOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState('00:00:00');
  const [horasDecimales, setHorasDecimales] = useState(0);

  // Estados para el nuevo diseño
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [vistaMode, setVistaMode] = useState('global'); // 'global' o 'por_asesor'
  const [graphData, setGraphData] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('semanal');
  const [vendedores, setVendedores] = useState([]);
  const [activeTab, setActiveTab] = useState('actividad');
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [historialData, setHistorialData] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [campanasData, setCampanasData] = useState([]);
  const [campanasLoading, setCampanasLoading] = useState(false);

  // Obtener información del usuario desde localStorage
  const obtenerInfoUsuario = () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Decodificar el token JWT (asumiendo formato estándar)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const rol = payload.rol || 'VENDEDOR';
        const id = payload.id || payload.user_id;
        const nombre = payload.nombre || '';

        setUserRole(rol);
        setUserId(id);
        setUserName(nombre);
      }
    } catch (error) {
      console.error('Error decodificando token:', error);
      setUserRole('VENDEDOR'); // Default fallback
    }
  };

  // Funciones principales
  const obtenerEstado = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await actividadService.getEstadoHoy();

      if (response.success) {
        setEstado(response.data);
        evaluarFloatingButton(response.data);
      } else {
        throw new Error(response.error || 'Error desconocido');
      }
    } catch (err) {
      console.error('Error cargando actividad:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const evaluarFloatingButton = (estadoData) => {
    if (!estadoData) return;

    const ahora = new Date();
    const hora = ahora.getHours();
    const minutos = ahora.getMinutes();

    // Mostrar floating button si:
    // 1. Tardanza (después de 8:15 AM sin check-in)
    // 2. Tiempo de check-out urgente (5:50-6:00 PM)
    // 3. Falta crítica detectada

    let shouldShow = false;

    // Caso 1: Tardanza
    if (!estadoData.jornada?.check_in_realizado &&
        (hora > 8 || (hora === 8 && minutos > 15))) {
      shouldShow = true;
    }

    // Caso 2: Check-out urgente
    if (estadoData.jornada?.check_in_realizado &&
        !estadoData.jornada?.check_out_realizado &&
        hora >= 17 && hora < 18) {
      shouldShow = true;
    }

    setShowFloatingButton(shouldShow);
  };

  const handleCheckInSuccess = async (data) => {
    setModalCheckInOpen(false);
    showNotification('Check-in registrado exitosamente', 'success');
    setTimeout(() => obtenerEstado(), 1000);
  };

  const handleCheckOutSuccess = async (data) => {
    setModalCheckOutOpen(false);
    showNotification('Check-out registrado exitosamente', 'success');
    setTimeout(() => obtenerEstado(), 1000);
  };

  const showNotification = (mensaje, tipo = 'info') => {
    setNotification({ mensaje, tipo, id: Date.now() });
    setTimeout(() => setNotification(null), 2000); // Auto-close en 2 segundos
  };

  const calcularTiempoTranscurrido = (checkInTime) => {
    if (!checkInTime) return { formato: '00:00:00', decimales: 0 };

    const ahora = new Date();
    const inicio = new Date(checkInTime);
    const diferencia = ahora - inicio;

    const segundos = Math.floor(diferencia / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);

    const formatoHMS = `${String(horas).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
    const decimales = diferencia / (1000 * 60 * 60);

    return {
      formato: formatoHMS,
      decimales: Math.round(decimales * 100) / 100
    };
  };

  // Verificar si el usuario puede ver datos de otros
  const isManager = () => {
    return ['SUPER_ADMIN', 'GERENTE', 'ADMIN', 'JEFE_VENTAS'].includes(userRole);
  };

  // Cargar datos de gráficos
  const cargarDatosGraficos = async () => {
    try {
      setGraphLoading(true);
      const params = new URLSearchParams({
        periodo: selectedPeriod,
        ...(selectedUser && { usuario_id: selectedUser })
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/actividad/datos-graficos?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGraphData(data.data);
        }
      }
    } catch (error) {
      console.error('Error cargando datos de gráficos:', error);
    } finally {
      setGraphLoading(false);
    }
  };

  // Cargar historial
  const cargarHistorial = async () => {
    try {
      setHistorialLoading(true);

      // Construir parámetros según el modo de vista
      const params = { limite: 30 };

      // Si es manager y está en modo "por_asesor" con usuario seleccionado
      if (isManager() && vistaMode === 'por_asesor' && selectedUser) {
        params.usuario_id = selectedUser;
      }
      // Si no es manager o está en modo global sin selección, traer solo datos del usuario actual
      // (el backend ya hace esto por defecto)

      const response = await actividadService.getHistorial(params);

      console.log('🔍 Respuesta completa del historial:', response);

      if (response.success) {
        // El backend devuelve { success: true, data: { registros: [...] } }
        const data = response.data?.data || response.data;

        if (Array.isArray(data)) {
          setHistorialData(data);
        } else if (data && Array.isArray(data.registros)) {
          setHistorialData(data.registros);
        } else {
          console.warn('Historial data estructura inesperada:', data);
          console.warn('response.data:', response.data);
          setHistorialData([]);
        }
      } else {
        console.error('Respuesta no exitosa:', response);
        setHistorialData([]);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      setHistorialData([]);
    } finally {
      setHistorialLoading(false);
    }
  };

  // Cargar campañas activas
  const cargarCampanas = async () => {
    try {
      setCampanasLoading(true);

      let url = `${API_CONFIG.BASE_URL}/api/campanas-asesor/mis-campanas?estado=todas`;

      // Si es manager, usar vista de equipo
      if (isManager()) {
        url = `${API_CONFIG.BASE_URL}/api/campanas-asesor/vista-equipo?estado=todas`;

        // Si hay usuario seleccionado en modo por_asesor
        if (vistaMode === 'por_asesor' && selectedUser) {
          url += `&usuario_id=${selectedUser}`;
        }
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCampanasData(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error cargando campañas:', error);
      setCampanasData([]);
    } finally {
      setCampanasLoading(false);
    }
  };

  // Cargar lista de vendedores para managers
  const cargarVendedores = async () => {
    if (!isManager()) return;

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/usuarios/vendedores`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVendedores(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error cargando vendedores:', error);
    }
  };

  // useEffects
  useEffect(() => {
    obtenerInfoUsuario(); // Obtener info del usuario primero
    obtenerEstado();
    if (activeTab === 'graficos') {
      cargarDatosGraficos();
    }
    if (activeTab === 'historial') {
      cargarHistorial();
    }
    if (activeTab === 'campanas') {
      cargarCampanas();
    }
    const interval = setInterval(obtenerEstado, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Cargar vendedores cuando el rol esté disponible
  useEffect(() => {
    if (userRole && isManager()) {
      cargarVendedores();
    }
  }, [userRole, userId, userName]);

  useEffect(() => {
    if (activeTab === 'graficos') {
      cargarDatosGraficos();
    }
  }, [selectedPeriod, selectedUser, activeTab]);

  useEffect(() => {
    if (activeTab === 'historial') {
      cargarHistorial();
    }
    if (activeTab === 'campanas') {
      cargarCampanas();
    }
  }, [activeTab]);

  // Recargar historial cuando cambie el modo de vista o usuario seleccionado
  useEffect(() => {
    if (activeTab === 'historial' && isManager()) {
      cargarHistorial();
    }
  }, [vistaMode, selectedUser]);

  // Recargar campañas cuando cambie el modo de vista o usuario seleccionado
  useEffect(() => {
    if (activeTab === 'campanas') {
      cargarCampanas();
    }
  }, [vistaMode, selectedUser]);

  useEffect(() => {
    let interval = null;

    if (estado?.jornada?.check_in_realizado && !estado?.jornada?.check_out_realizado && estado?.jornada?.hora_check_in) {
      interval = setInterval(() => {
        const tiempo = calcularTiempoTranscurrido(estado.jornada.hora_check_in);
        setTiempoTranscurrido(tiempo.formato);
        setHorasDecimales(tiempo.decimales);
      }, 1000);

      const tiempo = calcularTiempoTranscurrido(estado.jornada.hora_check_in);
      setTiempoTranscurrido(tiempo.formato);
      setHorasDecimales(tiempo.decimales);
    } else {
      setTiempoTranscurrido('00:00:00');
      setHorasDecimales(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [estado?.jornada?.check_in_realizado, estado?.jornada?.check_out_realizado, estado?.jornada?.hora_check_in]);

  // Obtener color del widget según estado
  const getWidgetStatus = () => {
    if (!estado) return { color: 'gray', text: 'Cargando...', needsAction: false };

    const ahora = new Date();
    const hora = ahora.getHours();
    const minutos = ahora.getMinutes();
    const checkInRealizado = estado.jornada?.check_in_realizado;
    const checkOutRealizado = estado.jornada?.check_out_realizado;

    // Rojo: Tardanza crítica
    if (!checkInRealizado && (hora > 8 || (hora === 8 && minutos > 15))) {
      return { color: 'red', text: 'Tardanza - Check-in urgente', needsAction: true };
    }

    // Amarillo: Tiempo de check-out
    if (checkInRealizado && !checkOutRealizado && hora >= 17 && hora < 18) {
      return { color: 'yellow', text: 'Tiempo de check-out', needsAction: true };
    }

    // Verde: Trabajando normalmente
    if (checkInRealizado && !checkOutRealizado) {
      return { color: 'green', text: 'Trabajando', needsAction: false };
    }

    // Azul: Jornada completada
    if (checkInRealizado && checkOutRealizado) {
      return { color: 'blue', text: 'Jornada completada', needsAction: false };
    }

    // Gris: Fuera de horario
    return { color: 'gray', text: 'Fuera de horario', needsAction: false };
  };

  // Componente de notificación mejorado
  const NotificationComponent = () => {
    if (!notification) return null;

    const colors = {
      success: 'bg-green-500 text-white border-green-600',
      error: 'bg-red-500 text-white border-red-600',
      info: 'bg-blue-500 text-white border-blue-600'
    };

    return (
      <div className={`fixed top-4 right-4 z-50 p-3 rounded-lg border shadow-lg ${colors[notification.tipo]} max-w-sm animate-slideInRight`}>
        <div className="flex items-center">
          <CheckCircle className="h-4 w-4 mr-2" />
          <span className="text-sm font-medium">{notification.mensaje}</span>
        </div>
      </div>
    );
  };

  // Widget compacto en header
  const HeaderWidget = () => {
    const status = getWidgetStatus();
    const estadoActual = estado?.estado_actual || 'sin_iniciar';

    const colorClasses = {
      red: 'bg-red-100 border-red-300 text-red-700',
      yellow: 'bg-yellow-100 border-yellow-300 text-yellow-700',
      green: 'bg-green-100 border-green-300 text-green-700',
      blue: 'bg-blue-100 border-blue-300 text-blue-700',
      gray: 'bg-gray-100 border-gray-300 text-gray-700'
    };

    const dotClasses = {
      red: 'bg-red-500 animate-pulse',
      yellow: 'bg-yellow-500 animate-pulse',
      green: 'bg-green-500',
      blue: 'bg-blue-500',
      gray: 'bg-gray-400'
    };

    return (
      <div
        className={`inline-flex items-center px-4 py-2 rounded-full border cursor-pointer transition-all hover:shadow-md ${colorClasses[status.color]}`}
        onClick={() => {
          if (estado?.jornada?.puede_check_in) {
            setModalCheckInOpen(true);
          } else if (estado?.jornada?.puede_check_out) {
            setModalCheckOutOpen(true);
          }
        }}
      >
        <div className={`w-2 h-2 rounded-full mr-2 ${dotClasses[status.color]}`}></div>
        <span className="text-sm font-medium">{status.text}</span>
        {estadoActual === 'en_progreso' && (
          <>
            <div className="mx-2 text-xs">•</div>
            <span className="text-xs font-mono">{tiempoTranscurrido}</span>
          </>
        )}
        {status.needsAction && (
          <Bell className="h-3 w-3 ml-2 animate-bounce" />
        )}
      </div>
    );
  };

  // Botón flotante inteligente
  const FloatingActionButton = () => {
    if (!showFloatingButton) return null;

    const status = getWidgetStatus();

    const buttonColors = {
      red: 'bg-red-500 hover:bg-red-600 shadow-red-200',
      yellow: 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-200',
      green: 'bg-green-500 hover:bg-green-600 shadow-green-200'
    };

    return (
      <button
        onClick={() => {
          if (estado?.jornada?.puede_check_in) {
            setModalCheckInOpen(true);
          } else if (estado?.jornada?.puede_check_out) {
            setModalCheckOutOpen(true);
          }
        }}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full text-white shadow-2xl z-50 transition-all hover:scale-110 animate-pulse ${buttonColors[status.color]}`}
      >
        {estado?.jornada?.puede_check_in ? (
          <Play className="h-6 w-6 mx-auto" />
        ) : (
          <Square className="h-6 w-6 mx-auto" />
        )}
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
        </div>
      </button>
    );
  };

  // Modal ultra-compacto
  const CompactModalCheckIn = () => {
    if (!modalCheckInOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
          {/* Header compacto */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Check-in</h3>
            <button
              onClick={() => setModalCheckInOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          {/* Contenido simplificado */}
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-4">
              ¿Confirmas tu entrada para hoy?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setModalCheckInOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleCheckInSuccess();
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Sistema de tabs
  const TabSystem = () => {
    // Definir tabs según rol del usuario
    const allTabs = [
      { id: 'actividad', label: 'Actividad Hoy', icon: Activity, roles: ['VENDEDOR', 'ASESOR_VENTAS', 'SUPER_ADMIN'] },
      { id: 'graficos', label: 'Gráficos', icon: BarChart3, roles: ['VENDEDOR', 'ASESOR_VENTAS', 'SUPER_ADMIN', 'JEFE_VENTAS', 'GERENTE', 'ADMIN'] },
      { id: 'historial', label: 'Historial', icon: History, roles: ['VENDEDOR', 'ASESOR_VENTAS', 'SUPER_ADMIN', 'JEFE_VENTAS', 'GERENTE', 'ADMIN'] },
      { id: 'campanas', label: 'Campañas', icon: Target, roles: ['VENDEDOR', 'ASESOR_VENTAS', 'SUPER_ADMIN', 'JEFE_VENTAS', 'GERENTE', 'ADMIN'] }
    ];

    // Filtrar tabs según el rol del usuario
    const tabs = allTabs.filter(tab => tab.roles.includes(userRole));

    // Si el tab activo no está permitido, cambiar al primero disponible
    useEffect(() => {
      if (!tabs.find(tab => tab.id === activeTab) && tabs.length > 0) {
        setActiveTab(tabs[0].id);
      }
    }, [userRole, tabs]);

    return (
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <IconComponent className="h-4 w-4" />
                  <span>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  // Contenido de cada tab
  const TabContent = () => {
    switch (activeTab) {
      case 'actividad':
        return <ActividadHoyContent />;
      case 'graficos':
        return <GraficosContent />;
      case 'historial':
        return <HistorialContent />;
      case 'campanas':
        return <CampanasContent />;
      default:
        return <ActividadHoyContent />;
    }
  };

  // Contenido de Actividad Hoy
  const ActividadHoyContent = () => {
    const estadoActual = estado?.estado_actual || 'sin_iniciar';

    return (
      <div className="space-y-6">
        {/* Métricas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Actividad Hoy</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(estado?.actividad?.total_mensajes || 0) + (estado?.actividad?.total_llamadas || 0)}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Horas Trabajadas</p>
                <p className="text-2xl font-bold text-green-600">
                  {estadoActual === 'en_progreso' ? horasDecimales.toFixed(1) :
                   (estado?.jornada?.horas_jornada || 0).toFixed(1)}h
                </p>
              </div>
              <Timer className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Puntualidad</p>
                <p className="text-2xl font-bold text-purple-600">95%</p>
              </div>
              <Award className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rendimiento</p>
                <p className="text-2xl font-bold text-orange-600">
                  {Math.round((estado?.actividad?.total_mensajes || 0) / Math.max(horasDecimales || 0.01, 0.01))}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Estado de check-in/out simplificado */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado Actual</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Check-in</p>
              <p className="text-lg font-bold text-green-600">
                {estado?.jornada?.hora_check_in ?
                  new Date(estado.jornada.hora_check_in).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '--:--'
                }
              </p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <CheckCircle className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Check-out</p>
              <p className="text-lg font-bold text-blue-600">
                {estado?.jornada?.hora_check_out ?
                  new Date(estado.jornada.hora_check_out).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '--:--'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Contenido de Gráficos
  const GraficosContent = () => {
    return (
      <div className="space-y-6">
        {/* Panel de filtros */}
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Análisis Temporal</h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                    <option value="semanal">Última Semana</option>
                    <option value="mensual">Último Mes</option>
                    <option value="trimestral">Último Trimestre</option>
                    <option value="anual">Último Año</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Selector de Vista para Managers */}
            {isManager() && (
              <div className="flex items-center space-x-4 pt-3 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Modo de Vista:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => {
                        setVistaMode('global');
                        setSelectedUser(null);
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        vistaMode === 'global'
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Vista Global
                    </button>
                    <button
                      onClick={() => setVistaMode('por_asesor')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        vistaMode === 'por_asesor'
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Por Asesor
                    </button>
                  </div>
                </div>

                {/* Selector de Asesor (solo visible en modo "Por Asesor") */}
                {vistaMode === 'por_asesor' && (
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                      value={selectedUser || ''}
                      onChange={(e) => setSelectedUser(e.target.value || null)}
                    >
                      <option value="">Seleccionar asesor...</option>
                      {vendedores.map((vendedor) => (
                        <option key={vendedor.id} value={vendedor.id}>
                          {vendedor.nombre} {vendedor.apellido}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Actividad {selectedPeriod === 'semanal' ? 'Semanal' :
                        selectedPeriod === 'mensual' ? 'Mensual' :
                        selectedPeriod === 'trimestral' ? 'Trimestral' : 'Anual'}
            </h3>
            {graphLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : graphData?.datos ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={graphData.datos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === 'mensajes' ? 'Mensajes' :
                      name === 'llamadas' ? 'Llamadas' :
                      name === 'horas' ? 'Horas' : name
                    ]}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="mensajes"
                    stackId="1"
                    stroke="#3B82F6"
                    fill="#93C5FD"
                    name="mensajes"
                  />
                  <Area
                    type="monotone"
                    dataKey="llamadas"
                    stackId="1"
                    stroke="#10B981"
                    fill="#6EE7B7"
                    name="llamadas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No hay datos para mostrar</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Puntualidad y Rendimiento</h3>
            {graphLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : graphData?.datos ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={graphData.datos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === 'horas' ? 'Horas Trabajadas' :
                      name === 'actividad_total' ? 'Actividad Total' : name
                    ]}
                  />
                  <Bar dataKey="horas" fill="#8B5CF6" name="horas" />
                  <Bar dataKey="actividad_total" fill="#F59E0B" name="actividad_total" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Award className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No hay datos de rendimiento</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico adicional de línea temporal */}
        {graphData?.datos && graphData.datos.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Actividad</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={graphData.datos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) => [
                    value,
                    name === 'actividad_total' ? 'Actividad Total' : name
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="actividad_total"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8 }}
                  name="actividad_total"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  // Contenido de Historial
  const HistorialContent = () => {
    return (
      <div className="space-y-6">
        {/* Panel de filtros para Historial */}
        {isManager() && (
          <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Modo de Vista:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => {
                      setVistaMode('global');
                      setSelectedUser(null);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      vistaMode === 'global'
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Vista Global
                  </button>
                  <button
                    onClick={() => setVistaMode('por_asesor')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      vistaMode === 'por_asesor'
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Por Asesor
                  </button>
                </div>
              </div>

              {/* Selector de Asesor (solo visible en modo "Por Asesor") */}
              {vistaMode === 'por_asesor' && (
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                    value={selectedUser || ''}
                    onChange={(e) => setSelectedUser(e.target.value || null)}
                  >
                    <option value="">Seleccionar asesor...</option>
                    {vendedores.map((vendedor) => (
                      <option key={vendedor.id} value={vendedor.id}>
                        {vendedor.nombre} {vendedor.apellido}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Historial de Actividad</h3>
        {historialLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !Array.isArray(historialData) || historialData.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No hay historial disponible</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historialData.map((registro, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    {/* Mostrar nombre del usuario en vista global */}
                    {isManager() && vistaMode === 'global' && registro.usuario_nombre && (
                      <p className="text-xs font-semibold text-purple-600 mb-1">
                        {registro.usuario_nombre}
                      </p>
                    )}
                    <p className="font-medium text-gray-900">
                      {new Date(registro.fecha).toLocaleDateString('es-PE')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {registro.check_in_time ?
                        `Check-in: ${new Date(registro.check_in_time).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Lima'
                        })}` :
                        'Sin check-in'
                      }
                      {registro.check_out_time &&
                        ` • Check-out: ${new Date(registro.check_out_time).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Lima'
                        })}`
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {parseFloat(registro.horas_calculadas || 0).toFixed(1)}h trabajadas
                    </p>
                    <p className="text-xs text-gray-500">
                      {registro.total_mensajes_recibidos || 0} mensajes • {registro.total_llamadas || 0} llamadas
                    </p>
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

  // Contenido de Campañas
  const CampanasContent = () => {
    const finalizarCampana = async (campanaId) => {
      if (!window.confirm('¿Estás seguro de finalizar esta campaña?')) return;

      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/campanas-asesor/${campanaId}/finalizar`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          cargarCampanas(); // Recargar lista
        }
      } catch (error) {
        console.error('Error finalizando campaña:', error);
      }
    };

    const formatMoney = (monto) => {
      return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto || 0);
    };

    const formatDate = (fecha) => {
      if (!fecha) return '-';
      return new Date(fecha).toLocaleDateString('es-PE');
    };

    if (campanasLoading) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      );
    }

    const campanasActivas = campanasData.filter(c => c.estado === 'activa');
    const campanasFinalizadas = campanasData.filter(c => c.estado === 'finalizada');

    return (
      <div className="space-y-6">
        {/* Selector de Vista para Managers */}
        {isManager() && (
          <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Modo de Vista:</span>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => { setVistaMode('global'); setSelectedUser(null); }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${vistaMode === 'global' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Vista Global
                  </button>
                  <button
                    onClick={() => setVistaMode('por_asesor')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${vistaMode === 'por_asesor' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Por Asesor
                  </button>
                </div>
              </div>

              {vistaMode === 'por_asesor' && (
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
                    value={selectedUser || ''}
                    onChange={(e) => setSelectedUser(e.target.value || null)}
                  >
                    <option value="">Seleccionar asesor...</option>
                    {vendedores.map((vendedor) => (
                      <option key={vendedor.id} value={vendedor.id}>
                        {vendedor.nombre} {vendedor.apellido}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Campañas Activas */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Campañas Activas</h3>
          {campanasActivas.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay campañas activas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campanasActivas.map((campana) => (
                <div key={campana.id} className="border border-gray-200 p-4 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{campana.nombre_campana || campana.linea_producto}</h4>
                      <p className="text-sm text-gray-600">
                        Desde {formatDate(campana.fecha_inicio)} ({campana.dias_trabajados} días trabajados)
                      </p>
                      {isManager() && campana.asesor_nombre && (
                        <p className="text-xs text-purple-600 font-medium mt-1">{campana.asesor_nombre}</p>
                      )}
                    </div>
                    <button
                      onClick={() => finalizarCampana(campana.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Finalizar
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-600 font-medium">Mensajes</p>
                      <p className="text-xl font-bold text-blue-700">{campana.total_mensajes || 0}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs text-green-600 font-medium">Llamadas</p>
                      <p className="text-xl font-bold text-green-700">{campana.total_llamadas || 0}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-xs text-purple-600 font-medium">Ventas</p>
                      <p className="text-xl font-bold text-purple-700">{campana.total_ventas || 0}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-xs text-orange-600 font-medium">Conversión</p>
                      <p className="text-xl font-bold text-orange-700">{campana.tasa_conversion || 0}%</p>
                    </div>
                  </div>

                  {campana.monto_total_vendido > 0 && (
                    <div className="mt-3 text-sm text-gray-600">
                      Monto vendido: <span className="font-semibold">$ {formatMoney(campana.monto_total_vendido)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Historial de Campañas Finalizadas */}
        {campanasFinalizadas.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Historial de Campañas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2">Línea Producto</th>
                    {isManager() && <th className="py-2 px-2">Asesor</th>}
                    <th className="py-2 px-2">Período</th>
                    <th className="py-2 px-2 text-right">Días</th>
                    <th className="py-2 px-2 text-right">Mensajes</th>
                    <th className="py-2 px-2 text-right">Ventas</th>
                    <th className="py-2 px-2 text-right">Monto</th>
                    <th className="py-2 px-2 text-right">Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {campanasFinalizadas.map((campana) => (
                    <tr key={campana.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">{campana.linea_producto}</td>
                      {isManager() && <td className="py-2 px-2 text-xs text-gray-600">{campana.asesor_nombre}</td>}
                      <td className="py-2 px-2 text-xs">{formatDate(campana.fecha_inicio)} - {formatDate(campana.fecha_fin)}</td>
                      <td className="py-2 px-2 text-right">{campana.dias_trabajados}</td>
                      <td className="py-2 px-2 text-right">{campana.total_mensajes}</td>
                      <td className="py-2 px-2 text-right">{campana.total_ventas}</td>
                      <td className="py-2 px-2 text-right">$ {formatMoney(campana.monto_total_vendido)}</td>
                      <td className="py-2 px-2 text-right text-purple-600 font-medium">{campana.tasa_conversion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900">Cargando Dashboard</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error de Conexión</h3>
          <p className="text-red-700 mb-6">{error}</p>
          <button
            onClick={obtenerEstado}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header con widget compacto */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard de Actividad</h1>
            <p className="text-gray-600">Control de jornada y análisis de rendimiento</p>
          </div>
          <div className="flex items-center space-x-4">
            <HeaderWidget />
            <button
              onClick={obtenerEstado}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sistema de tabs */}
        <TabSystem />

        {/* Contenido de tabs */}
        <TabContent />

        {/* Botón flotante inteligente */}
        <FloatingActionButton />

        {/* Modales */}
        <ModalCheckIn
          isOpen={modalCheckInOpen}
          onClose={() => setModalCheckInOpen(false)}
          onSubmit={async (data) => {
            try {
              const response = await actividadService.checkIn(data);
              if (response.success) {
                handleCheckInSuccess(response.data);
              } else {
                throw new Error(response.error);
              }
            } catch (error) {
              console.error('Error en check-in:', error);
              showNotification('Error al iniciar jornada: ' + error.message, 'error');
            }
          }}
        />

        <ModalCheckOut
          isOpen={modalCheckOutOpen}
          onClose={() => setModalCheckOutOpen(false)}
          onSubmit={async (data) => {
            try {
              const response = await actividadService.checkOut(data);
              if (response.success) {
                handleCheckOutSuccess(response.data);
              } else {
                throw new Error(response.error);
              }
            } catch (error) {
              console.error('Error en check-out:', error);
              showNotification('Error al finalizar jornada: ' + error.message, 'error');
            }
          }}
        />

        {/* Notificaciones */}
        <NotificationComponent />
      </div>
    </div>
  );
};

export default ActividadPageEnhanced;