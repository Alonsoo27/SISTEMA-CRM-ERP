import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../../../services/authService';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Si ya está autenticado, redirigir al dashboard
  useEffect(() => {
    console.log('🔍 Login - Verificando autenticación existente...');

    if (authService.isAuthenticated()) {
      console.log('✅ Login - Usuario ya autenticado, redirigiendo...');
      navigate('/', { replace: true });
    } else {
      console.log('❌ Login - No hay autenticación válida');
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀 Login - Iniciando proceso de login...');

    setLoading(true);
    setError('');

    try {
      // Usar authService.login() - ÚNICA FUENTE DE VERDAD
      const user = await authService.login(formData.email, formData.password);

      console.log('✅ Login - Autenticación exitosa:', {
        id: user.id,
        email: user.email,
        nombre: user.nombre_completo || user.nombre
      });

      // Redirigir al dashboard
      navigate('/', { replace: true });

    } catch (err) {
      console.error('❌ Login - Error:', err);
      setError(err.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
      console.log('🏁 Login - Proceso completado');
    }
  };

  const currentTime = new Date().toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit'
  });

  const currentDate = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const inspirationalQuotes = [
    "La excelencia no es un acto, sino un habito",
    "Cada cliente es una oportunidad de brillar",
    "Innovamos para transformar el futuro",
    "La calidad es nuestro compromiso diario",
    "Juntos construimos soluciones extraordinarias",
    "Hoy es el dia perfecto para superar expectativas",
    "La dedicacion convierte lo ordinario en extraordinario",
    "Creamos valor en cada interaccion",
    "El exito se mide en clientes satisfechos",
    "Transformamos desafios en oportunidades",
    "La precision es la base de la confianza",
    "Cada dia es una nueva oportunidad de crecer",
    "La pasion por servir nos define",
    "Construimos relaciones que perduran",
    "La innovacion comienza con una idea audaz"
  ];

  const randomQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-emerald-600">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-emerald-900/30"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
          <div className="flex items-center justify-center space-x-8 mb-12">
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg border border-blue-400">
                MP
              </div>
              <div className="text-xl font-semibold text-blue-100">Mundipaci</div>
            </div>
            <div className="w-px h-12 bg-white/20"></div>
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg border border-emerald-400">
                OL
              </div>
              <div className="text-xl font-semibold text-emerald-100">Olecrammi</div>
            </div>
          </div>

          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold mb-4 text-white">
              Sistema de Gestion Empresarial
            </h1>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 mb-4">
              <p className="text-blue-100 text-lg font-medium italic">
                "{randomQuote}"
              </p>
            </div>
            <p className="text-blue-200 text-base leading-relaxed">
              Plataforma integrada para equipos de ventas, marketing y soporte tecnico
            </p>
          </div>

          <div className="space-y-6 mb-12">
            <h3 className="text-lg font-semibold text-blue-100 text-center mb-6">Herramientas Disponibles</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-all duration-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium">Gestion de Prospectos</div>
                    <div className="text-blue-200 text-sm">Pipeline de ventas y seguimiento</div>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-all duration-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium">Marketing y Campanas</div>
                    <div className="text-emerald-200 text-sm">Planificacion y ejecucion</div>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-all duration-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium">Soporte Tecnico</div>
                    <div className="text-indigo-200 text-sm">Tickets y atencion al cliente</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <div className="text-center">
              <p className="text-blue-200 text-sm capitalize mb-1">
                {currentDate}
              </p>
              <p className="text-white font-medium">
                {currentTime}
              </p>
            </div>
          </div>
        </div>
        <div className="absolute top-20 right-20 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Iniciar Sesion</h2>
            <p className="text-gray-600 text-sm">Acceso al sistema de gestion</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="tu-email@empresa.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contrasena
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Verificando...</span>
                </div>
              ) : (
                <span>Ingresar</span>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            <p>Sistema ERP v2.0</p>
            <p className="mt-1">Mundipaci + Olecrammi</p>
          </div>
        </div>
      </div>

      <div className="lg:hidden absolute top-4 left-4 flex items-center space-x-2">
        <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center text-white font-bold text-xs">
          MP
        </div>
        <div className="w-8 h-8 bg-emerald-500 rounded-md flex items-center justify-center text-white font-bold text-xs">
          OL
        </div>
      </div>
    </div>
  );
};

export default Login;