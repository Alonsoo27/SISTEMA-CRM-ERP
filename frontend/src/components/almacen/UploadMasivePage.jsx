import React, { useState } from 'react';
import {
  Upload,
  Download,
  FileText,
  Info,
  AlertTriangle,
  CheckCircle,
  Package,
  Warehouse,
  BookOpen,
  Play,
  Clock,
  Shield
} from 'lucide-react';
import UploadStock from './upload/UploadStock';

const UploadMasivePage = ({ onSuccess, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({
    ultimaSubida: null,
    productosTotal: 0,
    almacenesAfectados: 0
  });

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleUploadSuccess = (data) => {
    setStats({
      ultimaSubida: new Date(),
      productosTotal: data?.productos_procesados || 0,
      almacenesAfectados: data?.almacenes_afectados || 0
    });
    onSuccess?.(data);
    setShowModal(false);
  };

  const pasosProceso = [
    {
      numero: 1,
      titulo: "Descargar Plantilla",
      descripcion: "Obtén la plantilla oficial Excel con el formato correcto",
      icono: Download,
      tiempo: "1 min"
    },
    {
      numero: 2,
      titulo: "Completar Datos",
      descripcion: "Llena la plantilla con la información de tus productos",
      icono: FileText,
      tiempo: "15-30 min"
    },
    {
      numero: 3,
      titulo: "Cargar y Validar",
      descripcion: "Sube el archivo y revisa la validación automática",
      icono: Upload,
      tiempo: "2-5 min"
    },
    {
      numero: 4,
      titulo: "Ejecutar Importación",
      descripcion: "Confirma e importa todos los datos al sistema",
      icono: Play,
      tiempo: "1-3 min"
    }
  ];

  const consideraciones = [
    "📊 Formatos soportados: Excel (.xlsx, .xls) únicamente",
    "📈 Tamaño máximo: 10MB por archivo",
    "🏪 Multi-almacén: Puedes cargar stock para varios almacenes",
    "✅ Validación automática de datos antes de importar",
    "🔄 Los datos existentes serán actualizados, no duplicados",
    "⚡ Procesamiento en lotes para mejor rendimiento",
    "📝 Se genera log completo de la importación",
    "🔒 Solo usuarios autorizados pueden realizar cargas masivas"
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <Warehouse className="h-12 w-12 text-blue-600 mr-4" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Carga Masiva de Inventario</h1>
            <p className="text-gray-600 mt-2">
              Importa grandes volúmenes de stock de manera rápida y segura
            </p>
          </div>
        </div>

        {/* Botón principal de acción */}
        <div className="mt-6">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
          >
            <Upload className="h-5 w-5 mr-3" />
            Iniciar Carga Masiva
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Proceso guiado paso a paso
          </p>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      {stats.ultimaSubida && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
          <div className="flex items-center justify-center space-x-8">
            <div className="text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-lg font-bold text-green-900">{stats.productosTotal}</p>
              <p className="text-sm text-green-700">Productos Cargados</p>
            </div>
            <div className="text-center">
              <Package className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-lg font-bold text-blue-900">{stats.almacenesAfectados}</p>
              <p className="text-sm text-blue-700">Almacenes Actualizados</p>
            </div>
            <div className="text-center">
              <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-lg font-bold text-purple-900">
                {stats.ultimaSubida.toLocaleDateString()}
              </p>
              <p className="text-sm text-purple-700">Última Carga</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Proceso paso a paso */}
        <div className="space-y-6">
          <div className="flex items-center mb-4">
            <BookOpen className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Proceso de Importación</h2>
          </div>

          <div className="space-y-4">
            {pasosProceso.map((paso) => {
              const IconoComponent = paso.icono;
              return (
                <div key={paso.numero} className="flex items-start space-x-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <IconoComponent className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900">{paso.titulo}</h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {paso.tiempo}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{paso.descripcion}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Consideraciones importantes */}
        <div className="space-y-6">
          <div className="flex items-center mb-4">
            <Info className="h-6 w-6 text-amber-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Consideraciones Importantes</h2>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-center mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
              <h3 className="font-semibold text-amber-800">Antes de comenzar</h3>
            </div>
            <ul className="space-y-2 text-sm text-amber-700">
              {consideraciones.map((consideracion, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{consideracion}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Seguridad y permisos */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center mb-3">
              <Shield className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="font-semibold text-blue-800">Seguridad</h3>
            </div>
            <div className="text-sm text-blue-700 space-y-1">
              <p>✓ Todas las operaciones son auditadas</p>
              <p>✓ Los datos son validados antes de importar</p>
              <p>✓ Se mantiene respaldo automático</p>
              <p>✓ Acceso restringido por roles</p>
            </div>
          </div>

          {/* Botón secundario */}
          <div className="text-center">
            <button
              onClick={() => setShowModal(true)}
              className="w-full inline-flex items-center justify-center px-6 py-3 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 font-medium rounded-lg transition-colors duration-200"
            >
              <Upload className="h-5 w-5 mr-2" />
              Comenzar Importación
            </button>
          </div>
        </div>
      </div>

      {/* Ayuda rápida */}
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <h3 className="font-semibold text-gray-900 mb-2">¿Necesitas ayuda?</h3>
        <p className="text-gray-600 text-sm">
          Si es tu primera vez usando la carga masiva, contacta al administrador del sistema
          o consulta la documentación técnica para obtener ejemplos y mejores prácticas.
        </p>
      </div>

      {/* Modal de Upload */}
      <UploadStock
        isOpen={showModal}
        onClose={handleModalClose}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
};

export default UploadMasivePage;