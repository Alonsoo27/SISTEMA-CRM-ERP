// Archivo: src/components/ventas/BonoProyectado.jsx
import React, { useState, useEffect } from 'react';
import { DollarSign, Target, TrendingUp, X, Award, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthUtils } from '../../utils/auth';

const BonoProyectado = ({ asesorId = 1 }) => {
  const [datosBonus, setDatosBonus] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    cargarDatosBonus();
  }, [asesorId]);

  const cargarDatosBonus = async () => {
    try {
      setCargando(true);
      
      // ✅ Usar AuthUtils para obtener token y hacer request seguro
      const response = await AuthUtils.authenticatedFetch(`http://localhost:3001/api/comisiones/bono-actual/${asesorId}`);
      
      const data = await response.json();
      console.log('🔍 Respuesta API bonos:', data); // DEBUG
      
      if (data.success) {
        setDatosBonus(data.data);
      }
    } catch (error) {
      console.error('❌ Error cargando bonos:', error);
      
      // Si es error de autenticación, AuthUtils ya manejó la redirección
      if (error.message === 'No authenticated' || error.message === 'Authentication failed') {
        return; // No hacer nada más, ya se redirigió al login
      }
    } finally {
      setCargando(false);
    }
  };
  const formatearMoneda = (monto) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(monto);
  };

  const calcularBarraProgreso = () => {
    if (!datosBonus) return 0;
    return Math.min(datosBonus.bono_actual.porcentaje, 100);
  };

  const obtenerNivelActual = () => {
    if (!datosBonus) return null;
    const porcentaje = datosBonus.bono_actual.porcentaje;
    
    if (porcentaje >= 100) return { nivel: '100%', alcanzado: true, color: 'text-green-600' };
    if (porcentaje >= 90) return { nivel: '90%', alcanzado: true, color: 'text-blue-600' };
    if (porcentaje >= 80) return { nivel: '80%', alcanzado: true, color: 'text-yellow-600' };
    return { nivel: 'En progreso', alcanzado: false, color: 'text-gray-600' };
  };

  const calcularBonosDisponibles = () => {
    if (!datosBonus) return [];
    
    const meta = datosBonus.asesor.meta_usd;
    const porcentaje = datosBonus.bono_actual.porcentaje;
    
    // Basado en la tabla de bonos del controller
    const configuracionBonos = {
      2500: { bono_100: 92.00, bono_90: 46.00, bono_80: null },
      4000: { bono_100: 144.80, bono_90: 72.40, bono_80: null },
      5000: { bono_100: 197.25, bono_90: 98.63, bono_80: null },
      8000: { bono_100: 276.00, bono_90: 138.00, bono_80: 69.00 }
    };
    
    const config = configuracionBonos[meta] || configuracionBonos[8000];
    
    return [
      {
        nivel: '80%',
        bono: config.bono_80,
        alcanzado: porcentaje >= 80,
        falta: porcentaje < 80 ? Math.ceil((meta * 0.8) - datosBonus.asesor.vendido_usd) : 0
      },
      {
        nivel: '90%', 
        bono: config.bono_90,
        alcanzado: porcentaje >= 90,
        falta: porcentaje < 90 ? Math.ceil((meta * 0.9) - datosBonus.asesor.vendido_usd) : 0
      },
      {
        nivel: '100%',
        bono: config.bono_100,
        alcanzado: porcentaje >= 100,
        falta: porcentaje < 100 ? Math.ceil(meta - datosBonus.asesor.vendido_usd) : 0
      }
    ].filter(item => item.bono !== null);
  };

  if (cargando) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!datosBonus) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center text-gray-500">
          <DollarSign className="w-5 h-5 mr-2" />
          <span>No hay datos de bonos disponibles</span>
        </div>
      </div>
    );
  }

  const nivelActual = obtenerNivelActual();
  const bonosDisponibles = calcularBonosDisponibles();

  return (
    <>
      {/* Componente Principal */}
      <div 
        className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-sm border border-green-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setMostrarModal(true)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="bg-green-100 p-2 rounded-lg mr-3">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">💰 Bono Proyectado</h3>
          </div>
          <div className="text-xs text-gray-500">Click para detalles</div>
        </div>

        <div className="space-y-3">
          <div className="text-3xl font-bold text-green-600">
            {formatearMoneda(datosBonus.bono_actual.bono_usd)}
          </div>
          
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4 text-blue-500" />
            <span className={`text-sm font-medium ${nivelActual.color}`}>
              📊 {datosBonus.bono_actual.porcentaje}% de meta
            </span>
          </div>

          {datosBonus.siguiente_nivel && datosBonus.siguiente_nivel.falta_usd > 0 && (
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-gray-600">
                ⚡ {formatearMoneda(datosBonus.siguiente_nivel.falta_usd)} para siguiente nivel
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalles */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                🎯 PROGRESO DE BONO - {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
              </h2>
              <button 
                onClick={() => setMostrarModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 space-y-6">
              {/* Meta y Progreso */}
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Tu Meta</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatearMoneda(datosBonus.asesor.meta_usd)}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Vendido</div>
                  <div className="text-xl font-semibold text-green-600">
                    {formatearMoneda(datosBonus.asesor.vendido_usd)} ({datosBonus.bono_actual.porcentaje}%)
                  </div>
                </div>

                {/* Barra de Progreso */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 relative">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full transition-all duration-500 relative"
                      style={{ width: `${Math.min(calcularBarraProgreso(), 100)}%` }}
                    >
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-xs font-bold">
                        {datosBonus.bono_actual.porcentaje}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bonos Disponibles */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-yellow-500" />
                  🏆 Bonos Disponibles
                </h3>
                
                <div className="space-y-2">
                  {bonosDisponibles.map((bono, index) => (
                    <div 
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        bono.alcanzado 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`text-sm font-medium ${bono.alcanzado ? 'text-green-600' : 'text-gray-600'}`}>
                          {bono.alcanzado ? '✅' : '⭕'} {bono.nivel}
                        </div>
                        <div className="text-sm font-bold">
                          {formatearMoneda(bono.bono)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {bono.alcanzado ? 'ALCANZADO' : `Faltan ${formatearMoneda(bono.falta)}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen Actual */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">🔥 Bono Actual:</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatearMoneda(datosBonus.bono_actual.bono_usd)}
                    </span>
                  </div>
                  
                  {datosBonus.siguiente_nivel && datosBonus.siguiente_nivel.falta_usd > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">🚀 Próximo Objetivo:</span>
                      <span className="text-sm text-blue-600">
                        {formatearMoneda(datosBonus.siguiente_nivel.falta_usd)} para {formatearMoneda(datosBonus.siguiente_nivel.bono_objetivo)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensaje Motivacional */}
              <div className="text-center text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                💪 {datosBonus.bono_actual.mensaje}
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button 
                onClick={() => setMostrarModal(false)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BonoProyectado;