import React, { useState, useMemo, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { formatearMoneda, formatearMonedaCompacta } from '../utils/currency';
import 'mapbox-gl/dist/mapbox-gl.css';
// Importar GeoJSON oficial del Perú
import peruDepartamentosDataRaw from '../data/peru_departamental.geojson?url';

// Tu token de Mapbox
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWxvbnNvb28yNyIsImEiOiJjbWZ1N21sN3gwb2swMnFxMTBkcHU2MTRiIn0.BFmiLznk7FiEyjWSUjX3jg';

// Configurar token de Mapbox
mapboxgl.accessToken = MAPBOX_TOKEN;

const MapaPeruMapbox = ({
  departamentos = [],
  tipo = 'ventas' // 'ventas' | 'prospectos'
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [peruDepartamentosData, setPeruDepartamentosData] = useState(null);
  const popupRef = useRef(null);

  // 🏷️ ETIQUETAS DINÁMICAS SEGÚN TIPO
  const labels = tipo === 'prospectos' ? {
    cantidad: 'Prospectos',
    valor: 'Valor Estimado',
    titulo: 'Prospectos por Departamento',
    descripcion: 'Distribución territorial de intención de compra por departamento'
  } : {
    cantidad: 'Ventas',
    valor: 'Ingresos',
    titulo: 'Mapa Geográfico',
    descripcion: 'Distribución territorial real de ventas por departamento'
  };

  // Cargar GeoJSON
  useEffect(() => {
    fetch(peruDepartamentosDataRaw)
      .then(res => res.json())
      .then(data => setPeruDepartamentosData(data))
      .catch(err => console.error('Error cargando GeoJSON:', err));
  }, []);

  // Calcular rangos para el color mapping
  const estadisticas = useMemo(() => {
    const ingresos = departamentos.map(d => parseFloat(d.ingresos_totales) || 0);
    return {
      maxIngresos: Math.max(...ingresos, 0),
      minIngresos: Math.min(...ingresos, 0),
      totalVentas: departamentos.reduce((sum, d) => sum + parseInt(d.total_ventas || 0), 0),
      totalIngresos: ingresos.reduce((sum, val) => sum + val, 0),
      totalCiudades: departamentos.reduce((sum, d) => sum + parseInt(d.ciudades || 0), 0)
    };
  }, [departamentos]);

  // Función para obtener el color basado en los ingresos
  const getColorByIngresos = (ingresos) => {
    if (!ingresos || estadisticas.maxIngresos === 0) return 'rgba(229, 231, 235, 0.6)'; // gris claro

    const normalizado = (parseFloat(ingresos) - estadisticas.minIngresos) /
                       (estadisticas.maxIngresos - estadisticas.minIngresos);

    if (normalizado >= 0.8) return 'rgba(4, 120, 87, 0.8)';   // verde muy oscuro
    if (normalizado >= 0.6) return 'rgba(5, 150, 105, 0.7)';  // verde oscuro
    if (normalizado >= 0.4) return 'rgba(16, 185, 129, 0.6)'; // verde medio
    if (normalizado >= 0.2) return 'rgba(52, 211, 153, 0.5)'; // verde claro
    return 'rgba(167, 243, 208, 0.4)'; // verde muy claro
  };

  // Datos del departamento
  const getDepartmentData = (geoName) => {
    const normalizedGeoName = geoName.toUpperCase().trim();
    return departamentos.find(d => {
      const normalizedDataName = d.departamento.toUpperCase().trim();
      return normalizedDataName === normalizedGeoName ||
             normalizedDataName.includes(normalizedGeoName) ||
             normalizedGeoName.includes(normalizedDataName);
    });
  };

  // Generar datos de color para cada feature
  const featuresWithColors = useMemo(() => {
    if (!peruDepartamentosData?.features) return [];

    return peruDepartamentosData.features.map(feature => {
      const data = getDepartmentData(feature.properties.NOMBDEP);
      const color = getColorByIngresos(data?.ingresos_totales || 0);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          color: color,
          data: data
        }
      };
    });
  }, [departamentos, estadisticas, peruDepartamentosData]);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current || !peruDepartamentosData || featuresWithColors.length === 0) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-75, -9.5],
      zoom: 5.5,
      // 🔇 Deshabilitar telemetría de Mapbox para evitar errores CORS
      trackResize: true,
      preserveDrawingBuffer: false
    });

    mapRef.current = map;

    map.on('load', () => {
      // Agregar fuente de datos
      map.addSource('peru-data', {
        type: 'geojson',
        data: {
          ...peruDepartamentosData,
          features: featuresWithColors
        }
      });

      // Capa de relleno
      map.addLayer({
        id: 'peru-departments',
        type: 'fill',
        source: 'peru-data',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.7
        }
      });

      // Capa de borde
      map.addLayer({
        id: 'peru-departments-stroke',
        type: 'line',
        source: 'peru-data',
        paint: {
          'line-color': '#374151',
          'line-width': 1
        }
      });

      // Crear popup
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
      });
      popupRef.current = popup;

      // Eventos de mouse
      map.on('mouseenter', 'peru-departments', (e) => {
        map.getCanvas().style.cursor = 'pointer';

        const feature = e.features[0];
        const coordinates = e.lngLat;
        const departmentName = feature.properties.NOMBDEP;
        const data = getDepartmentData(departmentName);

        let popupHTML = `<div class="p-3">
          <h4 class="font-bold text-gray-900 text-sm mb-2">${departmentName}</h4>`;

        if (data) {
          popupHTML += `
            <div class="space-y-1 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-600">${labels.cantidad}:</span>
                <span class="font-semibold text-blue-600">${data.total_ventas}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">${labels.valor}:</span>
                <span class="font-semibold text-green-600">${formatearMoneda(data.ingresos_totales)}</span>
              </div>
            </div>`;
        } else {
          popupHTML += `<p class="text-xs text-gray-500">Sin datos disponibles</p>`;
        }

        popupHTML += `</div>`;

        popup.setLngLat(coordinates).setHTML(popupHTML).addTo(map);

        // Highlight efecto
        map.setPaintProperty('peru-departments-stroke', 'line-width', [
          'case',
          ['==', ['get', 'NOMBDEP'], departmentName],
          3,
          1
        ]);
      });

      map.on('mouseleave', 'peru-departments', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();

        // Resetear highlight
        map.setPaintProperty('peru-departments-stroke', 'line-width', 1);
      });

      map.on('click', 'peru-departments', (e) => {
        const feature = e.features[0];
        const departmentName = feature.properties.NOMBDEP;
        const data = getDepartmentData(departmentName);
        setSelectedDepartment({ nombre: departmentName, data });
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [featuresWithColors]);

  // Actualizar datos cuando cambien
  useEffect(() => {
    if (mapRef.current && mapRef.current.getSource('peru-data')) {
      mapRef.current.getSource('peru-data').setData({
        ...peruDepartamentosData,
        features: featuresWithColors
      });
    }
  }, [featuresWithColors]);

  // Mostrar loading mientras carga el GeoJSON
  if (!peruDepartamentosData) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
            🗺️ {labels.titulo}
          </h3>
          <p className="text-sm text-gray-600">
            {labels.descripcion}
          </p>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando mapa geográfico...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
          🗺️ {labels.titulo}
        </h3>
        <p className="text-sm text-gray-600">
          {labels.descripcion}
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Mapa Principal */}
        <div className="flex-1">
          <div className="relative">
            <div
              ref={mapContainerRef}
              className="rounded-xl overflow-hidden border border-gray-200"
              style={{ width: '100%', height: '600px' }}
            />

            {/* Panel de información fijo */}
            {selectedDepartment && selectedDepartment.data && (
              <div className="absolute top-4 right-4 bg-white border border-gray-300 rounded-lg p-4 shadow-xl z-20 min-w-64 max-w-80">
                <div className="border-l-4 border-green-500 pl-3">
                  <h4 className="font-bold text-gray-900 text-lg mb-2">
                    {selectedDepartment.nombre}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{labels.cantidad}:</span>
                      <span className="font-semibold text-blue-600">
                        {selectedDepartment.data.total_ventas}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{labels.valor}:</span>
                      <span className="font-semibold text-green-600">
                        {formatearMoneda(selectedDepartment.data.ingresos_totales)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ciudades:</span>
                      <span className="font-semibold text-purple-600">
                        {selectedDepartment.data.ciudades}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Asesores:</span>
                      <span className="font-semibold text-orange-600">
                        {selectedDepartment.data.asesores_activos}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ticket Promedio:</span>
                        <span className="font-semibold text-indigo-600">
                          {formatearMoneda(selectedDepartment.data.ticket_promedio)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDepartment(null)}
                    className="mt-3 text-xs text-gray-500 hover:text-gray-700"
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Leyenda del mapa */}
          <div className="mt-4 bg-gray-50 rounded-lg p-4">
            <h5 className="font-semibold text-gray-700 mb-3">Leyenda de {labels.valor}</h5>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-100 border border-gray-300 rounded"></div>
                <span>Muy Bajo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-300 border border-gray-300 rounded"></div>
                <span>Bajo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-500 border border-gray-300 rounded"></div>
                <span>Medio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-700 border border-gray-300 rounded"></div>
                <span>Alto</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-900 border border-gray-300 rounded"></div>
                <span>Muy Alto</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gray-200 border border-gray-300 rounded"></div>
                <span>Sin datos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de estadísticas */}
        <div className="xl:w-80">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200">
            <h4 className="font-bold text-gray-900 mb-4 text-lg flex items-center">
              📊 Resumen Nacional
            </h4>

            <div className="space-y-4">
              {/* Métricas principales */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium">DEPARTAMENTOS</p>
                  <p className="text-xl font-bold text-blue-800">{departamentos.length}</p>
                  <p className="text-xs text-blue-600">Con actividad</p>
                </div>

                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-green-600 font-medium">{labels.valor.toUpperCase()}</p>
                  <p className="text-xl font-bold text-green-800">
                    {formatearMonedaCompacta(estadisticas.totalIngresos)}
                  </p>
                  <p className="text-xs text-green-600">Total nacional</p>
                </div>

                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-purple-600 font-medium">{labels.cantidad.toUpperCase()}</p>
                  <p className="text-xl font-bold text-purple-800">{estadisticas.totalVentas}</p>
                  <p className="text-xs text-purple-600">{tipo === 'prospectos' ? 'Intenciones' : 'Transacciones'}</p>
                </div>

                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <p className="text-xs text-orange-600 font-medium">CIUDADES</p>
                  <p className="text-xl font-bold text-orange-800">{estadisticas.totalCiudades}</p>
                  <p className="text-xs text-orange-600">Mercados</p>
                </div>
              </div>

              {/* Ranking TOP 5 */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                  🏆 TOP 5 Departamentos
                </h5>
                <div className="space-y-2">
                  {departamentos
                    .sort((a, b) => parseFloat(b.ingresos_totales) - parseFloat(a.ingresos_totales))
                    .slice(0, 5)
                    .map((dept, index) => (
                      <div key={dept.departamento} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                            index === 0 ? 'bg-yellow-500' :
                            index === 1 ? 'bg-gray-400' :
                            index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{dept.departamento}</p>
                            <p className="text-xs text-gray-500">{dept.total_ventas} {tipo === 'prospectos' ? 'prospectos' : 'ventas'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-green-600">
                            {formatearMonedaCompacta(dept.ingresos_totales)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Información adicional */}
              
                
            
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapaPeruMapbox;