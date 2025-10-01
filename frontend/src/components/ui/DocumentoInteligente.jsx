// ============================================
// DOCUMENTO INTELIGENTE - COMPONENTE EMPRESARIAL
// Auto-detección de tipo de documento y búsqueda automática
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, CheckCircle, AlertCircle, User, Building, Loader } from 'lucide-react';
import clientesService from '../../services/clientesService';

// Función debounce personalizada
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// ⚡ FUNCIONES DE VALIDACIÓN DEFINIDAS PRIMERO (HOISTING)
function validarDNI(dni) {
  if (dni.length !== 8) return false;

  // Verificar que no sean todos números iguales
  if (/^(\d)\1{7}$/.test(dni)) return false;

  // Verificar que no comience con 00
  if (dni.startsWith('00')) return false;

  return true;
}

function validarRUC(ruc) {
  if (ruc.length !== 11) return false;

  // Verificar primer dígito (tipo de contribuyente)
  const primerDigito = ruc.charAt(0);
  if (!['1', '2'].includes(primerDigito)) return false;

  // Validar dígito verificador
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;

  for (let i = 0; i < 10; i++) {
    suma += parseInt(ruc.charAt(i)) * factores[i];
  }

  const resto = suma % 11;
  const digitoVerificador = resto < 2 ? resto : 11 - resto;

  return digitoVerificador === parseInt(ruc.charAt(10));
}

const DocumentoInteligente = ({
  value = '',
  onChange,
  onClienteEncontrado,
  onClienteNoEncontrado,
  placeholder = "Ingrese DNI, RUC, Pasaporte...",
  className = "",
  disabled = false
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [estadoBusqueda, setEstadoBusqueda] = useState('idle'); // idle, searching, found, notfound, error

  // Validaciones y auto-detección de tipo de documento
  const documentoInfo = useMemo(() => {
    const documento = value?.toString().trim();

    if (!documento) {
      return { tipo: '', valido: false, mensaje: '' };
    }

    // DNI (exactamente 8 dígitos)
    if (/^\d{8}$/.test(documento)) {
      const esValido = validarDNI(documento);
      return {
        tipo: 'DNI',
        valido: esValido,
        mensaje: esValido ? 'DNI válido - Persona Natural' : 'DNI inválido',
        icono: User,
        color: esValido ? 'green' : 'red',
        tipoCliente: 'persona'
      };
    }

    // RUC (exactamente 11 dígitos)
    if (/^\d{11}$/.test(documento)) {
      const esValido = validarRUC(documento);
      return {
        tipo: 'RUC',
        valido: esValido,
        mensaje: esValido ? 'RUC válido - Empresa' : 'RUC inválido',
        icono: Building,
        color: esValido ? 'green' : 'red',
        tipoCliente: 'empresa'
      };
    }

    // Documento incompleto (menos de 6 dígitos)
    if (/^\d{1,7}$/.test(documento)) {
      return {
        tipo: 'ESCRIBIENDO',
        valido: false,
        mensaje: `${documento.length}/8 dígitos para DNI o ${documento.length}/11 para RUC`,
        icono: Search,
        color: 'gray'
      };
    }

    // Pasaporte (6-12 caracteres alfanuméricos, no solo números)
    if (/^[A-Z0-9]{6,12}$/i.test(documento) && !/^\d+$/.test(documento)) {
      return {
        tipo: 'PASAPORTE',
        valido: documento.length >= 6,
        mensaje: 'Formato de pasaporte válido - Persona Natural',
        icono: User,
        color: 'blue',
        tipoCliente: 'persona'
      };
    }

    // Carnet de Extranjería (formato específico CE)
    if (/^CE[A-Z0-9]{6,10}$/i.test(documento)) {
      return {
        tipo: 'CE',
        valido: true,
        mensaje: 'Carnet de Extranjería válido - Persona Natural',
        icono: User,
        color: 'blue',
        tipoCliente: 'persona'
      };
    }

    // Formato no reconocido o incompleto
    return {
      tipo: 'INVALIDO',
      valido: false,
      mensaje: 'Formato no reconocido. Use DNI (8), RUC (11), Pasaporte o CE',
      icono: AlertCircle,
      color: 'red'
    };
  }, [value]);

  // Búsqueda automática con debounce
  const buscarCliente = useCallback(
    debounce(async (documento) => {
      if (!documento || !documentoInfo.valido || documentoInfo.tipo === 'ESCRIBIENDO' || documentoInfo.tipo === 'INVALIDO') {
        setClienteEncontrado(null);
        setEstadoBusqueda('idle');
        return;
      }

      setLoading(true);
      setError('');
      setEstadoBusqueda('searching');

      try {
        const response = await clientesService.buscarPorDocumento(documento);

        if (response.success && response.data) {
          // Cliente encontrado
          setClienteEncontrado(response.data);
          setEstadoBusqueda('found');

          // Notificar al componente padre
          if (onClienteEncontrado) {
            onClienteEncontrado({
              cliente: response.data,
              documento: documento,
              tipo_documento: response.data.tipo_documento // Usar el tipo del cliente encontrado
            });
          }
        } else {
          // Cliente no encontrado
          setClienteEncontrado(null);
          setEstadoBusqueda('notfound');

          // Notificar que se puede crear nuevo cliente
          if (onClienteNoEncontrado) {
            const tiposValidosParaBD = ['DNI', 'RUC', 'PASAPORTE', 'CE'];
            onClienteNoEncontrado({
              documento: documento,
              tipo_documento: tiposValidosParaBD.includes(documentoInfo.tipo) ? documentoInfo.tipo : '',
              tipo_cliente: documentoInfo.tipoCliente,
              puede_crear: tiposValidosParaBD.includes(documentoInfo.tipo)
            });
          }
        }
      } catch (error) {
        console.error('Error buscando cliente:', error);
        setError('Error al buscar cliente');
        setEstadoBusqueda('error');
        setClienteEncontrado(null);
      } finally {
        setLoading(false);
      }
    }, 800), // 800ms de delay para evitar demasiadas consultas
    [documentoInfo.valido, documentoInfo.tipo, onClienteEncontrado, onClienteNoEncontrado]
  );

  // Ejecutar búsqueda cuando cambie el documento válido
  useEffect(() => {
    if (documentoInfo.valido && value?.toString().trim()) {
      buscarCliente(value.toString().trim());
    } else {
      setClienteEncontrado(null);
      setEstadoBusqueda('idle');
    }
  }, [value, documentoInfo.valido, buscarCliente]);

  // Manejador de cambio de input con validación de errores
  const handleChange = (e) => {
    try {
      const nuevoValor = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Limpiar errores previos
      setError('');

      // ⚡ DETECTAR TIPO INMEDIATAMENTE CON EL NUEVO VALOR
      let tipoDetectado = '';

      if (/^\d{8}$/.test(nuevoValor)) {
        tipoDetectado = 'DNI';
      } else if (/^\d{11}$/.test(nuevoValor)) {
        tipoDetectado = 'RUC';
      } else if (/^[A-Z0-9]{6,12}$/i.test(nuevoValor) && !/^\d+$/.test(nuevoValor)) {
        tipoDetectado = 'PASAPORTE';
      } else if (/^CE[A-Z0-9]{6,10}$/i.test(nuevoValor)) {
        tipoDetectado = 'CE';
      }

      // ⚡ SOLO ENVIAR TIPOS VÁLIDOS AL PADRE
      const tiposValidosParaBD = ['DNI', 'RUC', 'PASAPORTE', 'CE'];
      const tipoParaEnviar = tiposValidosParaBD.includes(tipoDetectado) ? tipoDetectado : '';

      // Validar si el documento es válido
      let esValido = false;
      if (tipoDetectado === 'DNI') {
        esValido = validarDNI(nuevoValor);
      } else if (tipoDetectado === 'RUC') {
        esValido = validarRUC(nuevoValor);
      } else if (tipoDetectado === 'PASAPORTE' || tipoDetectado === 'CE') {
        esValido = nuevoValor.length >= 6;
      }

      // Notificar cambio al padre con información adicional
      if (onChange) {
        onChange({
          documento: nuevoValor,
          tipo_documento: tipoParaEnviar, // Tipo detectado inmediatamente
          valido: esValido
        });
      }
    } catch (error) {
      console.error('Error en handleChange:', error);
      setError('Error procesando documento');
    }
  };

  // Obtener estilo del input según estado
  const getInputStyle = () => {
    const baseStyle = "w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 text-sm";

    if (loading) return `${baseStyle} border-blue-300 focus:ring-blue-500 focus:border-blue-500`;
    if (error) return `${baseStyle} border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50`;
    if (clienteEncontrado) return `${baseStyle} border-green-300 focus:ring-green-500 focus:border-green-500 bg-green-50`;
    if (documentoInfo.valido) return `${baseStyle} border-blue-300 focus:ring-blue-500 focus:border-blue-500`;
    if (value && !documentoInfo.valido) return `${baseStyle} border-red-300 focus:ring-red-500 focus:border-red-500`;

    return `${baseStyle} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
  };

  // Obtener icono de estado
  const getStatusIcon = () => {
    if (loading) return <Loader className="h-4 w-4 text-blue-500 animate-spin" />;
    if (error) return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (clienteEncontrado) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (documentoInfo.valido) {
      const IconoTipo = documentoInfo.icono;
      return <IconoTipo className={`h-4 w-4 text-${documentoInfo.color}-500`} />;
    }
    if (value && !documentoInfo.valido) return <AlertCircle className="h-4 w-4 text-red-500" />;

    return <Search className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Input principal */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={getInputStyle()}
          maxLength="12"
          autoComplete="off"
        />

        {/* Icono de estado */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>

      {/* Información del documento */}
      {value && documentoInfo.tipo !== 'ESCRIBIENDO' && (
        <div className={`flex items-center text-xs px-2 py-1 rounded ${
          documentoInfo.valido
            ? 'text-green-700 bg-green-50'
            : 'text-red-700 bg-red-50'
        }`}>
          <span className="font-medium">{documentoInfo.tipo}</span>
          {documentoInfo.tipo !== 'INVALIDO' && (
            <span className="ml-2">• {documentoInfo.mensaje}</span>
          )}
        </div>
      )}

      {/* Cliente encontrado */}
      {clienteEncontrado && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800">
                Cliente encontrado
              </p>
              <p className="text-sm text-green-700 font-semibold">
                {clienteEncontrado.nombre_completo}
              </p>
              <div className="mt-1 space-y-1">
                {clienteEncontrado.telefono && (
                  <p className="text-xs text-green-600">
                    📞 {clienteEncontrado.telefono}
                  </p>
                )}
                {clienteEncontrado.email && (
                  <p className="text-xs text-green-600">
                    ✉️ {clienteEncontrado.email}
                  </p>
                )}
                {clienteEncontrado.ubicacion_completa && (
                  <p className="text-xs text-green-600">
                    📍 {clienteEncontrado.ubicacion_completa}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado: Cliente no encontrado pero puede crear */}
      {estadoBusqueda === 'notfound' && documentoInfo.valido && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <User className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Cliente nuevo
              </p>
              <p className="text-xs text-blue-600">
                Se creará automáticamente al guardar la venta
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
};

export default DocumentoInteligente;