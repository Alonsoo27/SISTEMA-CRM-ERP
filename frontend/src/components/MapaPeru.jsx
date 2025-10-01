import React, { useState } from 'react';
import { formatearMoneda, formatearMonedaCompacta } from '../utils/currency';

const MapaPeru = ({ departamentos = [] }) => {
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  // Calcular rangos para el color mapping
  const maxIngresos = Math.max(...departamentos.map(d => parseFloat(d.ingresos_totales) || 0));
  const minIngresos = Math.min(...departamentos.map(d => parseFloat(d.ingresos_totales) || 0));

  // Función para obtener el color basado en los ingresos
  const getColorByIngresos = (ingresos) => {
    if (!ingresos || maxIngresos === 0) return '#e5e7eb'; // gris claro si no hay datos

    const normalizado = (parseFloat(ingresos) - minIngresos) / (maxIngresos - minIngresos);

    if (normalizado >= 0.8) return '#059669'; // verde muy oscuro
    if (normalizado >= 0.6) return '#10b981'; // verde oscuro
    if (normalizado >= 0.4) return '#34d399'; // verde medio
    if (normalizado >= 0.2) return '#6ee7b7'; // verde claro
    return '#a7f3d0'; // verde muy claro
  };

  // Datos del departamento para el tooltip
  const getDepartmentData = (nombre) => {
    return departamentos.find(d =>
      d.departamento.toLowerCase() === nombre.toLowerCase() ||
      d.departamento.toLowerCase().includes(nombre.toLowerCase())
    );
  };

  // Representación simplificada de departamentos del Perú usando rectángulos posicionados
  const peruDepartments = [
    { nombre: 'TUMBES', x: 20, y: 20, width: 60, height: 40 },
    { nombre: 'PIURA', x: 10, y: 60, width: 80, height: 60 },
    { nombre: 'LAMBAYEQUE', x: 90, y: 60, width: 50, height: 60 },
    { nombre: 'CAJAMARCA', x: 90, y: 120, width: 70, height: 50 },
    { nombre: 'LA LIBERTAD', x: 140, y: 120, width: 60, height: 50 },
    { nombre: 'AMAZONAS', x: 160, y: 70, width: 70, height: 50 },
    { nombre: 'SAN MARTIN', x: 200, y: 120, width: 60, height: 50 },
    { nombre: 'LORETO', x: 260, y: 30, width: 120, height: 140 },
    { nombre: 'ANCASH', x: 120, y: 170, width: 60, height: 50 },
    { nombre: 'HUANUCO', x: 180, y: 170, width: 50, height: 50 },
    { nombre: 'PASCO', x: 160, y: 220, width: 40, height: 40 },
    { nombre: 'UCAYALI', x: 230, y: 170, width: 80, height: 90 },
    { nombre: 'LIMA', x: 120, y: 220, width: 40, height: 60 },
    { nombre: 'JUNIN', x: 180, y: 260, width: 50, height: 50 },
    { nombre: 'HUANCAVELICA', x: 160, y: 280, width: 40, height: 40 },
    { nombre: 'ICA', x: 120, y: 280, width: 40, height: 50 },
    { nombre: 'AYACUCHO', x: 180, y: 310, width: 50, height: 50 },
    { nombre: 'CUSCO', x: 230, y: 310, width: 60, height: 60 },
    { nombre: 'MADRE DE DIOS', x: 290, y: 310, width: 50, height: 60 },
    { nombre: 'APURIMAC', x: 180, y: 360, width: 50, height: 40 },
    { nombre: 'AREQUIPA', x: 120, y: 330, width: 60, height: 70 },
    { nombre: 'MOQUEGUA', x: 120, y: 400, width: 40, height: 30 },
    { nombre: 'TACNA', x: 120, y: 430, width: 40, height: 30 },
    { nombre: 'PUNO', x: 230, y: 370, width: 60, height: 60 }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Mapa de Ventas por Departamento
        </h3>
        <p className="text-sm text-gray-600">
          Visualización geográfica de la distribución de ingresos
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Mapa SVG */}
        <div className="flex-1">
          <div className="bg-gray-50 rounded-lg p-4 relative">
            <svg
              viewBox="0 0 400 480"
              className="w-full h-auto max-h-96 border border-gray-200 rounded"
              style={{ background: '#f8fafc' }}
            >
              {peruDepartments.map((dept) => {
                const data = getDepartmentData(dept.nombre);
                const ingresos = data?.ingresos_totales || 0;
                const color = getColorByIngresos(ingresos);

                return (
                  <g key={dept.nombre}>
                    <rect
                      x={dept.x}
                      y={dept.y}
                      width={dept.width}
                      height={dept.height}
                      fill={color}
                      stroke="#374151"
                      strokeWidth="1"
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onMouseEnter={() => setSelectedDepartment({ nombre: dept.nombre, data })}
                      onMouseLeave={() => setSelectedDepartment(null)}
                      rx="2"
                    />
                    <text
                      x={dept.x + dept.width / 2}
                      y={dept.y + dept.height / 2 + 3}
                      fontSize="7"
                      fill={data && parseFloat(data.ingresos_totales) > 0 ? "#1f2937" : "#6b7280"}
                      textAnchor="middle"
                      className="pointer-events-none font-medium"
                    >
                      {dept.nombre.slice(0, 3)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Tooltip */}
            {selectedDepartment && selectedDepartment.data && (
              <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg p-3 shadow-lg z-10 min-w-48">
                <h4 className="font-semibold text-gray-900 mb-2">
                  {selectedDepartment.nombre}
                </h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-600">Ventas:</span>{' '}
                    <span className="font-medium">{selectedDepartment.data.total_ventas}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">Ingresos:</span>{' '}
                    <span className="font-medium text-green-600">
                      {formatearMoneda(selectedDepartment.data.ingresos_totales)}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">Ciudades:</span>{' '}
                    <span className="font-medium">{selectedDepartment.data.ciudades}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">Asesores:</span>{' '}
                    <span className="font-medium">{selectedDepartment.data.asesores_activos}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Leyenda */}
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Escala de Ingresos:</p>
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-100 border mr-1"></div>
                <span>Bajo</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-300 border mr-1"></div>
                <span>Medio</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 border mr-1"></div>
                <span>Alto</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-gray-200 border mr-1"></div>
                <span>Sin datos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de estadísticas */}
        <div className="lg:w-80">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Estadísticas Nacionales</h4>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Total Departamentos Activos</p>
                <p className="text-lg font-bold text-blue-600">{departamentos.length}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Ingresos Totales</p>
                <p className="text-lg font-bold text-green-600">
                  {formatearMonedaCompacta(
                    departamentos.reduce((sum, d) => sum + parseFloat(d.ingresos_totales || 0), 0)
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Ventas Totales</p>
                <p className="text-lg font-bold text-purple-600">
                  {departamentos.reduce((sum, d) => sum + parseInt(d.total_ventas || 0), 0)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Ciudades Cubiertas</p>
                <p className="text-lg font-bold text-orange-600">
                  {departamentos.reduce((sum, d) => sum + parseInt(d.ciudades || 0), 0)}
                </p>
              </div>
            </div>

            {/* Top 3 departamentos */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h5 className="font-medium text-gray-900 mb-3">TOP 3 Departamentos</h5>
              <div className="space-y-2">
                {departamentos
                  .sort((a, b) => parseFloat(b.ingresos_totales) - parseFloat(a.ingresos_totales))
                  .slice(0, 3)
                  .map((dept, index) => (
                    <div key={dept.departamento} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium">{dept.departamento}</span>
                      </div>
                      <span className="text-xs text-green-600 font-medium">
                        {formatearMonedaCompacta(dept.ingresos_totales)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapaPeru;