import React, { useState, useEffect, useCallback } from 'react';
import ubicacionesService from '../../services/ubicacionesService';

const UbicacionesSelector = ({
  value = {},
  onChange,
  disabled = false,
  required = false,
  showDistrito = true,
  placeholder = {},
  className = "",
  size = "default" // "sm", "default", "lg"
}) => {
  const [departamentos, setDepartamentos] = useState([]);
  const [provincias, setProvincias] = useState([]);
  const [distritos, setDistritos] = useState([]);
  const [loading, setLoading] = useState({
    departamentos: false,
    provincias: false,
    distritos: false
  });
  const [errors, setErrors] = useState({});

  // Valores internos
  const [selectedDepartamento, setSelectedDepartamento] = useState(value.departamento || '');
  const [selectedProvincia, setSelectedProvincia] = useState(value.provincia || '');
  const [selectedDistrito, setSelectedDistrito] = useState(value.distrito || '');

  // Configuración de tamaños
  const sizeClasses = {
    sm: "text-sm py-1 px-2",
    default: "text-sm py-2 px-3",
    lg: "text-base py-3 px-4"
  };

  const selectClass = `
    border border-gray-300 rounded-md shadow-sm
    focus:ring-blue-500 focus:border-blue-500
    disabled:bg-gray-100 disabled:cursor-not-allowed
    ${sizeClasses[size]}
    ${className}
  `.trim();

  // Cargar departamentos al montar el componente
  useEffect(() => {
    const cargarDepartamentos = async () => {
      setLoading(prev => ({ ...prev, departamentos: true }));
      try {
        const data = await ubicacionesService.getDepartamentos();
        setDepartamentos(data);
        setErrors(prev => ({ ...prev, departamentos: null }));
      } catch (error) {
        console.error('Error cargando departamentos:', error);
        setErrors(prev => ({ ...prev, departamentos: 'Error cargando departamentos' }));
      } finally {
        setLoading(prev => ({ ...prev, departamentos: false }));
      }
    };

    cargarDepartamentos();
  }, []);

  // Cargar provincias cuando cambia el departamento
  useEffect(() => {
    const cargarProvincias = async () => {
      if (!selectedDepartamento) {
        setProvincias([]);
        return;
      }

      setLoading(prev => ({ ...prev, provincias: true }));
      try {
        const data = await ubicacionesService.getProvinciasByDepartamento(selectedDepartamento);
        setProvincias(data);
        setErrors(prev => ({ ...prev, provincias: null }));
      } catch (error) {
        console.error('Error cargando provincias:', error);
        setErrors(prev => ({ ...prev, provincias: 'Error cargando provincias' }));
        setProvincias([]);
      } finally {
        setLoading(prev => ({ ...prev, provincias: false }));
      }
    };

    cargarProvincias();
  }, [selectedDepartamento]);

  // Cargar distritos cuando cambia la provincia
  useEffect(() => {
    const cargarDistritos = async () => {
      if (!selectedDepartamento || !selectedProvincia || !showDistrito) {
        setDistritos([]);
        return;
      }

      setLoading(prev => ({ ...prev, distritos: true }));
      try {
        const data = await ubicacionesService.getDistritosByProvincia(selectedDepartamento, selectedProvincia);
        setDistritos(data);
        setErrors(prev => ({ ...prev, distritos: null }));
      } catch (error) {
        console.error('Error cargando distritos:', error);
        setErrors(prev => ({ ...prev, distritos: 'Error cargando distritos' }));
        setDistritos([]);
      } finally {
        setLoading(prev => ({ ...prev, distritos: false }));
      }
    };

    cargarDistritos();
  }, [selectedDepartamento, selectedProvincia, showDistrito]);

  // Notificar cambios al componente padre
  const notifyChange = useCallback((newValues) => {
    if (onChange) {
      onChange(newValues);
    }
  }, [onChange]);

  // Manejar cambio de departamento
  const handleDepartamentoChange = (e) => {
    const nuevoDepartamento = e.target.value;
    setSelectedDepartamento(nuevoDepartamento);
    setSelectedProvincia('');
    setSelectedDistrito('');

    notifyChange({
      departamento: nuevoDepartamento,
      provincia: '',
      distrito: ''
    });
  };

  // Manejar cambio de provincia
  const handleProvinciaChange = (e) => {
    const nuevaProvincia = e.target.value;
    setSelectedProvincia(nuevaProvincia);
    setSelectedDistrito('');

    notifyChange({
      departamento: selectedDepartamento,
      provincia: nuevaProvincia,
      distrito: ''
    });
  };

  // Manejar cambio de distrito
  const handleDistritoChange = (e) => {
    const nuevoDistrito = e.target.value;
    setSelectedDistrito(nuevoDistrito);

    notifyChange({
      departamento: selectedDepartamento,
      provincia: selectedProvincia,
      distrito: nuevoDistrito
    });
  };

  // Actualizar valores cuando cambian las props
  useEffect(() => {
    setSelectedDepartamento(value.departamento || '');
    setSelectedProvincia(value.provincia || '');
    setSelectedDistrito(value.distrito || '');
  }, [value]);

  return (
    <div className="space-y-4">
      {/* Departamento */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Departamento {required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={selectedDepartamento}
          onChange={handleDepartamentoChange}
          disabled={disabled || loading.departamentos}
          className={selectClass}
          required={required}
        >
          <option value="">
            {loading.departamentos ? 'Cargando...' : (placeholder.departamento || 'Seleccionar departamento')}
          </option>
          {departamentos.map((dept) => (
            <option key={dept.departamento_codigo} value={dept.departamento}>
              {dept.departamento}
            </option>
          ))}
        </select>
        {errors.departamentos && (
          <p className="mt-1 text-sm text-red-600">{errors.departamentos}</p>
        )}
      </div>

      {/* Provincia */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Provincia {required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={selectedProvincia}
          onChange={handleProvinciaChange}
          disabled={disabled || !selectedDepartamento || loading.provincias}
          className={selectClass}
          required={required}
        >
          <option value="">
            {!selectedDepartamento
              ? 'Primero selecciona un departamento'
              : loading.provincias
                ? 'Cargando...'
                : (placeholder.provincia || 'Seleccionar provincia')
            }
          </option>
          {provincias.map((prov) => (
            <option key={prov.provincia_codigo} value={prov.provincia}>
              {prov.provincia}
            </option>
          ))}
        </select>
        {errors.provincias && (
          <p className="mt-1 text-sm text-red-600">{errors.provincias}</p>
        )}
      </div>

      {/* Distrito (opcional) */}
      {showDistrito && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Distrito {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={selectedDistrito}
            onChange={handleDistritoChange}
            disabled={disabled || !selectedProvincia || loading.distritos}
            className={selectClass}
            required={required && showDistrito}
          >
            <option value="">
              {!selectedProvincia
                ? 'Primero selecciona una provincia'
                : loading.distritos
                  ? 'Cargando...'
                  : (placeholder.distrito || 'Seleccionar distrito')
              }
            </option>
            {distritos.map((dist) => (
              <option key={dist.distrito_codigo} value={dist.distrito}>
                {dist.distrito}
              </option>
            ))}
          </select>
          {errors.distritos && (
            <p className="mt-1 text-sm text-red-600">{errors.distritos}</p>
          )}
        </div>
      )}

      {/* Información de ayuda */}
      <div className="text-xs text-gray-500">
          
      </div>
    </div>
  );
};

export default UbicacionesSelector;