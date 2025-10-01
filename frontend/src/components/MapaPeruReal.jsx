import React, { useState, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { formatearMoneda, formatearMonedaCompacta } from '../utils/currency';
import peruGeoData from '../data/peru-simple.json';

const MapaPeruReal = ({ departamentos = [] }) => {
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [hoveredDepartment, setHoveredDepartment] = useState(null);

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
    if (!ingresos || estadisticas.maxIngresos === 0) return '#e5e7eb';

    const normalizado = (parseFloat(ingresos) - estadisticas.minIngresos) /
                       (estadisticas.maxIngresos - estadisticas.minIngresos);

    if (normalizado >= 0.8) return '#047857'; // verde muy oscuro
    if (normalizado >= 0.6) return '#059669'; // verde oscuro
    if (normalizado >= 0.4) return '#10b981'; // verde medio
    if (normalizado >= 0.2) return '#34d399'; // verde claro
    return '#a7f3d0'; // verde muy claro
  };

  // Datos del departamento
  const getDepartmentData = (geoName) => {
    // Normalizar nombres para matching
    const normalizedGeoName = geoName.toUpperCase().trim();

    return departamentos.find(d => {
      const normalizedDataName = d.departamento.toUpperCase().trim();
      return normalizedDataName === normalizedGeoName ||
             normalizedDataName.includes(normalizedGeoName) ||
             normalizedGeoName.includes(normalizedDataName);
    });
  };

  // Ciudades principales para marcadores (opcional)
  const ciudadesPrincipales = [
    { name: "LIMA", coordinates: [-77.0428, -12.0464] },
    { name: "AREQUIPA", coordinates: [-71.5430, -16.4090] },
    { name: "CUSCO", coordinates: [-71.9675, -13.5320] },
    { name: "TRUJILLO", coordinates: [-79.0292, -8.1116] },
    { name: "PIURA", coordinates: [-80.6328, -5.1945] }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
          🗺️ Mapa Geográfico del Perú
        </h3>
        <p className="text-sm text-gray-600">
          Distribución territorial real de ventas por departamento
        </p>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Mapa Principal */}
        <div className="flex-1">
          <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-4 relative border border-gray-200">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                center: [-75, -9.5],
                scale: 1800
              }}
              width={800}
              height={600}
              className="w-full h-auto"
            >
              <Geographies geography={peruGeoData}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const departmentName = geo.properties.name;
                    const data = getDepartmentData(departmentName);
                    const ingresos = data?.ingresos_totales || 0;
                    const color = getColorByIngresos(ingresos);
                    const isHovered = hoveredDepartment === departmentName;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={color}
                        stroke="#374151"
                        strokeWidth={isHovered ? 2 : 0.8}
                        style={{
                          default: { outline: "none" },
                          hover: {
                            outline: "none",
                            filter: "brightness(1.1)",
                            cursor: "pointer"
                          },
                          pressed: { outline: "none" }
                        }}
                        onMouseEnter={() => {
                          setHoveredDepartment(departmentName);
                          setSelectedDepartment({ nombre: departmentName, data });
                        }}
                        onMouseLeave={() => {
                          setHoveredDepartment(null);
                          setSelectedDepartment(null);
                        }}
                      />
                    );
                  })
                }
              </Geographies>

              {/* Marcadores de ciudades principales (opcional) */}
              {ciudadesPrincipales.map(({ name, coordinates }) => {
                const data = getDepartmentData(name);
                if (!data) return null;

                return (
                  <Marker key={name} coordinates={coordinates}>
                    <circle
                      r={4}
                      fill="#dc2626"
                      stroke="#fff"
                      strokeWidth={2}
                      className="drop-shadow-sm"
                    />
                  </Marker>
                );
              })}
            </ComposableMap>

            {/* Tooltip flotante */}
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

        {/* Panel de estadísticas mejorado */}
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
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-xs text-blue-600 font-medium mb-2">💡 INFORMACIÓN</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Haz hover sobre cualquier departamento del mapa para ver información detallada de ventas, ingresos y cobertura territorial.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapaPeruReal;