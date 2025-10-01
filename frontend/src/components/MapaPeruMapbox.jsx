import React, { useState, useMemo, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { formatearMoneda, formatearMonedaCompacta } from '../utils/currency';
import 'mapbox-gl/dist/mapbox-gl.css';

// Tu token de Mapbox
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWxvbnNvb28yNyIsImEiOiJjbWZ1N21sN3gwb2swMnFxMTBkcHU2MTRiIn0.BFmiLznk7FiEyjWSUjX3jg';

// Configurar token de Mapbox
mapboxgl.accessToken = MAPBOX_TOKEN;

// GeoJSON simplificado de Perú por departamentos
const peruDepartamentos = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "AMAZONAS", "id": "AMAZONAS" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-78.5, -6.5], [-78.0, -6.3], [-77.5, -6.0], [-77.0, -6.2], [-76.8, -5.8], [-76.5, -5.5], [-76.2, -5.0], [-76.0, -4.8], [-76.3, -4.5], [-77.0, -4.2], [-77.5, -4.0], [-78.2, -4.3], [-78.8, -4.8], [-79.0, -5.5], [-78.8, -6.0], [-78.5, -6.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "ANCASH", "id": "ANCASH" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-78.5, -8.5], [-78.2, -8.2], [-77.8, -8.0], [-77.5, -8.3], [-77.2, -8.8], [-77.0, -9.2], [-76.8, -9.8], [-77.0, -10.2], [-77.5, -10.5], [-78.0, -10.3], [-78.3, -9.8], [-78.5, -9.2], [-78.5, -8.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "APURIMAC", "id": "APURIMAC" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-73.5, -13.5], [-73.2, -13.3], [-72.8, -13.0], [-72.5, -13.2], [-72.2, -13.8], [-72.0, -14.2], [-72.3, -14.5], [-72.8, -14.8], [-73.2, -14.5], [-73.5, -14.0], [-73.5, -13.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "AREQUIPA", "id": "AREQUIPA" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-73.0, -15.0], [-72.5, -14.8], [-72.0, -15.0], [-71.5, -15.3], [-71.0, -15.8], [-70.8, -16.2], [-70.5, -16.5], [-71.0, -16.8], [-71.8, -16.5], [-72.5, -16.0], [-73.0, -15.5], [-73.0, -15.0]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "AYACUCHO", "id": "AYACUCHO" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-75.0, -12.5], [-74.5, -12.2], [-74.0, -12.5], [-73.5, -12.8], [-73.0, -13.2], [-73.2, -13.8], [-73.8, -14.2], [-74.5, -14.5], [-75.0, -14.0], [-75.2, -13.2], [-75.0, -12.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "CAJAMARCA", "id": "CAJAMARCA" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-79.5, -5.5], [-79.0, -5.2], [-78.5, -5.0], [-78.0, -5.3], [-77.5, -5.8], [-77.2, -6.5], [-77.0, -7.0], [-77.5, -7.5], [-78.2, -7.8], [-79.0, -7.5], [-79.5, -6.8], [-79.5, -5.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "CUSCO", "id": "CUSCO" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-73.0, -11.5], [-72.2, -11.2], [-71.5, -11.8], [-71.0, -12.5], [-70.5, -13.2], [-70.8, -13.8], [-71.5, -14.5], [-72.2, -14.8], [-73.0, -14.5], [-73.5, -13.5], [-73.2, -12.5], [-73.0, -11.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "HUANCAVELICA", "id": "HUANCAVELICA" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-76.0, -12.0], [-75.5, -11.8], [-75.0, -12.0], [-74.5, -12.3], [-74.2, -12.8], [-74.5, -13.2], [-75.0, -13.5], [-75.5, -13.2], [-76.0, -12.8], [-76.0, -12.0]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "HUANUCO", "id": "HUANUCO" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-77.0, -8.5], [-76.5, -8.2], [-76.0, -8.5], [-75.5, -9.0], [-75.2, -9.8], [-75.5, -10.2], [-76.0, -10.5], [-76.8, -10.2], [-77.0, -9.5], [-77.0, -8.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "ICA", "id": "ICA" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-76.5, -13.5], [-76.0, -13.2], [-75.5, -13.5], [-75.0, -14.0], [-75.2, -14.5], [-75.8, -15.0], [-76.5, -14.8], [-76.8, -14.2], [-76.5, -13.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "JUNIN", "id": "JUNIN" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-76.5, -10.5], [-76.0, -10.2], [-75.5, -10.5], [-75.0, -11.0], [-74.5, -11.5], [-74.0, -12.0], [-74.5, -12.5], [-75.5, -12.8], [-76.0, -12.0], [-76.5, -11.2], [-76.5, -10.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "LA LIBERTAD", "id": "LA LIBERTAD" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-79.0, -7.0], [-78.5, -6.8], [-78.0, -7.0], [-77.5, -7.5], [-77.2, -8.0], [-77.5, -8.5], [-78.2, -8.8], [-79.0, -8.5], [-79.2, -8.0], [-79.0, -7.0]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "LAMBAYEQUE", "id": "LAMBAYEQUE" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-80.5, -5.5], [-80.0, -5.2], [-79.5, -5.5], [-79.2, -6.0], [-79.0, -6.8], [-79.5, -7.0], [-80.0, -6.8], [-80.5, -6.2], [-80.5, -5.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "LIMA", "id": "LIMA" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-77.5, -11.0], [-77.0, -10.8], [-76.5, -11.0], [-76.0, -11.5], [-75.5, -12.0], [-75.8, -12.8], [-76.5, -13.2], [-77.0, -13.5], [-77.5, -13.2], [-77.8, -12.5], [-77.5, -11.0]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "LORETO", "id": "LORETO" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-76.0, -3.0], [-75.0, -2.5], [-74.0, -3.0], [-73.0, -3.5], [-72.5, -4.5], [-73.0, -5.5], [-74.0, -6.0], [-75.0, -6.5], [-76.0, -6.0], [-76.5, -5.0], [-76.0, -3.0]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "MADRE DE DIOS", "id": "MADRE DE DIOS" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-71.0, -10.0], [-70.0, -9.8], [-69.0, -10.5], [-68.5, -11.5], [-69.0, -12.5], [-70.0, -13.0], [-71.0, -13.5], [-71.5, -12.5], [-71.0, -10.0]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "MOQUEGUA", "id": "MOQUEGUA" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-71.5, -16.0], [-71.0, -15.8], [-70.5, -16.0], [-70.0, -16.5], [-70.2, -17.0], [-70.8, -17.5], [-71.5, -17.2], [-71.8, -16.5], [-71.5, -16.0]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "PASCO", "id": "PASCO" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-76.5, -9.5], [-76.0, -9.2], [-75.5, -9.5], [-75.0, -10.0], [-75.2, -10.5], [-75.8, -11.0], [-76.5, -10.8], [-76.8, -10.0], [-76.5, -9.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "PIURA", "id": "PIURA" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-81.5, -4.5], [-81.0, -4.2], [-80.5, -4.0], [-80.0, -4.5], [-79.5, -5.0], [-79.8, -5.8], [-80.5, -6.2], [-81.0, -6.5], [-81.5, -6.0], [-81.5, -4.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "PUNO", "id": "PUNO" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-71.0, -13.5], [-70.0, -13.2], [-69.0, -13.8], [-68.5, -14.5], [-69.0, -15.5], [-70.0, -16.0], [-71.0, -16.5], [-71.5, -15.5], [-71.0, -13.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "SAN MARTIN", "id": "SAN MARTIN" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-77.5, -5.5], [-77.0, -5.2], [-76.5, -5.5], [-76.0, -6.0], [-75.5, -6.8], [-76.0, -7.5], [-76.8, -8.0], [-77.5, -7.8], [-77.8, -6.8], [-77.5, -5.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "TACNA", "id": "TACNA" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-70.5, -17.0], [-70.0, -16.8], [-69.5, -17.0], [-69.2, -17.8], [-69.5, -18.2], [-70.0, -18.5], [-70.5, -18.2], [-70.8, -17.5], [-70.5, -17.0]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "TUMBES", "id": "TUMBES" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-81.5, -3.5], [-81.0, -3.2], [-80.5, -3.0], [-80.0, -3.5], [-80.2, -4.0], [-80.8, -4.5], [-81.5, -4.2], [-81.8, -3.8], [-81.5, -3.5]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "UCAYALI", "id": "UCAYALI" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-75.5, -7.5], [-75.0, -7.2], [-74.5, -7.5], [-74.0, -8.0], [-73.5, -8.8], [-73.8, -10.0], [-74.5, -10.8], [-75.0, -11.0], [-75.5, -10.2], [-75.5, -7.5]]]
      }
    }
  ]
};

const MapaPeruMapbox = ({ departamentos = [] }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const popupRef = useRef(null);

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
    return peruDepartamentos.features.map(feature => {
      const data = getDepartmentData(feature.properties.name);
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
  }, [departamentos, estadisticas]);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-75, -9.5],
      zoom: 5.5
    });

    mapRef.current = map;

    map.on('load', () => {
      // Agregar fuente de datos
      map.addSource('peru-data', {
        type: 'geojson',
        data: {
          ...peruDepartamentos,
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
        const departmentName = feature.properties.name;
        const data = getDepartmentData(departmentName);

        let popupHTML = `<div class="p-3">
          <h4 class="font-bold text-gray-900 text-sm mb-2">${departmentName}</h4>`;

        if (data) {
          popupHTML += `
            <div class="space-y-1 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-600">Ventas:</span>
                <span class="font-semibold text-blue-600">${data.total_ventas}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Ingresos:</span>
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
          ['==', ['get', 'name'], departmentName],
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
        const departmentName = feature.properties.name;
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
        ...peruDepartamentos,
        features: featuresWithColors
      });
    }
  }, [featuresWithColors]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
          🗺️ Mapa Geográfico  
        </h3>
        <p className="text-sm text-gray-600">
          Distribución territorial real de ventas por departamento
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
                      <span className="text-gray-600">Ventas:</span>
                      <span className="font-semibold text-blue-600">
                        {selectedDepartment.data.total_ventas}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ingresos:</span>
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
            <h5 className="font-semibold text-gray-700 mb-3">Leyenda de Ingresos</h5>
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
                  <p className="text-xs text-green-600 font-medium">INGRESOS</p>
                  <p className="text-xl font-bold text-green-800">
                    {formatearMonedaCompacta(estadisticas.totalIngresos)}
                  </p>
                  <p className="text-xs text-green-600">Total nacional</p>
                </div>

                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-purple-600 font-medium">VENTAS</p>
                  <p className="text-xl font-bold text-purple-800">{estadisticas.totalVentas}</p>
                  <p className="text-xs text-purple-600">Transacciones</p>
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
                            <p className="text-xs text-gray-500">{dept.total_ventas} ventas</p>
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