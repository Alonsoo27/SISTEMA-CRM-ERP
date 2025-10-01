import React, { useState, useEffect } from 'react';
import {
  Package, TrendingUp, DollarSign, BarChart3, Award,
  Download, Calendar, RefreshCw, AlertCircle, Star,
  ShoppingCart, Target, Users, Activity, Box, Bell,
  Lightbulb, TrendingDown, Zap, Eye, CheckCircle
} from 'lucide-react';
import ventasService from '../services/ventasService';
import { formatearMoneda, formatearCantidad } from '../utils/currency';
import PeriodSelectorAdvanced from './ventas/PeriodSelector/PeriodSelectorAdvanced';

const ABCProductos = ({ usuarioActual }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodo, setPeriodo] = useState('mes_actual');
  const [vistaActiva, setVistaActiva] = useState('todos');

  useEffect(() => {
    cargarDatos();
  }, [periodo]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const response = await ventasService.obtenerDashboardABCProductos(periodo);
      
      if (response.success) {
        setDatos(response.data);
        setError(null);
      } else {
        setError(response.error || 'Error cargando datos ABC de productos');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error cargando ABC productos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Función de formateo movida a utils/currency.js

  const obtenerTextoSegunPeriodo = () => {
    switch(periodo) {
      case 'hoy': return 'Hoy';
      case 'semana_actual': return 'Semana Actual';
      case 'trimestre_actual': return 'Trimestre Actual';
      default: return 'Este Mes';
    }
  };

  const obtenerColorClasificacion = (clasificacion) => {
    switch(clasificacion) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-yellow-500';
      case 'C': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const obtenerProductosParaVista = () => {
    if (!datos) return [];

    switch(vistaActiva) {
      case 'clase-a': return datos.productos_clase_a || [];
      case 'clase-b': return datos.productos_clase_b || [];
      case 'clase-c': return datos.productos_clase_c || [];
      default: return datos.todos_productos || [];
    }
  };

  // 📊 ANÁLISIS INTELIGENTE ABC
  const generarAnalisisInteligente = () => {
    if (!datos || !datos.todos_productos) return null;

    const productos = datos.todos_productos;
    const productosA = datos.productos_clase_a || [];
    const productosB = datos.productos_clase_b || [];
    const productosC = datos.productos_clase_c || [];

    const analisis = {
      alertas: [],
      recomendaciones: [],
      insights: []
    };

    // 🚨 ALERTAS DE PRODUCTOS DE BAJA ROTACIÓN
    const productosBajaRotacion = productosC.filter(p =>
      parseInt(p.veces_vendido) <= 2 && parseFloat(p.ingresos_totales) < 500
    );

    if (productosBajaRotacion.length > 0) {
      analisis.alertas.push({
        tipo: 'baja_rotacion',
        nivel: 'warning',
        titulo: `${productosBajaRotacion.length} producto(s) con baja rotación`,
        descripcion: 'Productos Clase C con pocas ventas y bajos ingresos',
        productos: productosBajaRotacion.length,
        accion: 'Revisar estrategia de pricing o descontinuar'
      });
    }

    // 💎 PRODUCTOS ESTRELLA (Clase A con alta frecuencia)
    const productosEstrella = productosA.filter(p =>
      parseInt(p.veces_vendido) >= 5 && parseFloat(p.porcentaje_ingresos) >= 20
    );

    if (productosEstrella.length > 0) {
      analisis.insights.push({
        tipo: 'productos_estrella',
        titulo: `${productosEstrella.length} producto(s) estrella identificado(s)`,
        descripcion: 'Productos Clase A con alta frecuencia de venta',
        valor: productosEstrella.reduce((sum, p) => sum + parseFloat(p.ingresos_totales), 0),
        accion: 'Potenciar marketing y asegurar stock'
      });
    }

    // 📈 OPORTUNIDADES CLASE B
    const oportunidadesB = productosB.filter(p =>
      parseFloat(p.precio_promedio) > 200 && parseInt(p.veces_vendido) >= 3
    );

    if (oportunidadesB.length > 0) {
      analisis.recomendaciones.push({
        tipo: 'potencial_clase_a',
        titulo: `${oportunidadesB.length} producto(s) con potencial Clase A`,
        descripcion: 'Productos Clase B con buen precio y rotación',
        accion: 'Aumentar esfuerzos de venta para promover a Clase A'
      });
    }

    // 🎯 CONCENTRACIÓN DE VENTAS
    const totalIngresos = productos.reduce((sum, p) => sum + parseFloat(p.ingresos_totales), 0);
    const ingresosA = productosA.reduce((sum, p) => sum + parseFloat(p.ingresos_totales), 0);
    const concentracion = (ingresosA / totalIngresos) * 100;

    if (concentracion > 85) {
      analisis.alertas.push({
        tipo: 'alta_concentracion',
        nivel: 'info',
        titulo: 'Alta concentración en productos Clase A',
        descripcion: `${concentracion.toFixed(1)}% de ingresos en ${productosA.length} producto(s)`,
        accion: 'Evaluar diversificación de cartera'
      });
    }

    return analisis;
  };

  // 🎨 MATRIZ ABC VISUAL
  const MatrizABCVisual = () => {
    if (!datos || !datos.todos_productos) return null;

    const productos = datos.todos_productos;
    const maxIngresos = Math.max(...productos.map(p => parseFloat(p.ingresos_totales)));
    const maxCantidad = Math.max(...productos.map(p => parseFloat(p.cantidad_total)));

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-blue-500" />
          Matriz ABC Visual
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Clase A */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-green-700 flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                Clase A - Alto Valor
              </h4>
              <span className="text-sm text-gray-500">{datos.productos_clase_a?.length || 0} productos</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(datos.productos_clase_a || []).map((producto, index) => (
                <div key={producto.producto_id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-800 truncate">
                      {producto.codigo}
                    </span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {producto.porcentaje_ingresos}%
                    </span>
                  </div>
                  <div className="text-xs text-green-700 mb-2 truncate" title={producto.descripcion}>
                    {producto.descripcion}
                  </div>
                  <div className="text-xs text-green-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Ingresos:</span>
                      <span className="font-medium">{formatearMoneda(producto.ingresos_totales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cantidad:</span>
                      <span>{formatearCantidad(producto.cantidad_total, producto.unidad_medida)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ventas:</span>
                      <span>{producto.veces_vendido}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clase B */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-yellow-700 flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                Clase B - Valor Medio
              </h4>
              <span className="text-sm text-gray-500">{datos.productos_clase_b?.length || 0} productos</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(datos.productos_clase_b || []).map((producto, index) => (
                <div key={producto.producto_id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-yellow-800 truncate">
                      {producto.codigo}
                    </span>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                      {producto.porcentaje_ingresos}%
                    </span>
                  </div>
                  <div className="text-xs text-yellow-700 mb-2 truncate" title={producto.descripcion}>
                    {producto.descripcion}
                  </div>
                  <div className="text-xs text-yellow-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Ingresos:</span>
                      <span className="font-medium">{formatearMoneda(producto.ingresos_totales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cantidad:</span>
                      <span>{formatearCantidad(producto.cantidad_total, producto.unidad_medida)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ventas:</span>
                      <span>{producto.veces_vendido}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clase C */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-red-700 flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                Clase C - Bajo Valor
              </h4>
              <span className="text-sm text-gray-500">{datos.productos_clase_c?.length || 0} productos</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(datos.productos_clase_c || []).map((producto, index) => (
                <div key={producto.producto_id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-800 truncate">
                      {producto.codigo}
                    </span>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                      {producto.porcentaje_ingresos}%
                    </span>
                  </div>
                  <div className="text-xs text-red-700 mb-2 truncate" title={producto.descripcion}>
                    {producto.descripcion}
                  </div>
                  <div className="text-xs text-red-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Ingresos:</span>
                      <span className="font-medium">{formatearMoneda(producto.ingresos_totales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cantidad:</span>
                      <span>{formatearCantidad(producto.cantidad_total, producto.unidad_medida)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ventas:</span>
                      <span>{producto.veces_vendido}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">Error: {error}</span>
          <button 
            onClick={cargarDatos}
            className="ml-4 text-red-600 hover:text-red-800 underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const metricas = datos?.metricas_productos || {};
  const productosClaseA = datos?.productos_clase_a || [];
  const productosClaseB = datos?.productos_clase_b || [];
  const productosClaseC = datos?.productos_clase_c || [];
  const productosPorAsesor = datos?.productos_por_asesor || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ABC Análisis de Productos</h1>
            <p className="text-orange-100 mt-1">
              Clasificación y rentabilidad de productos
            </p>
            {datos?.fechas && (
              <p className="text-sm text-orange-200 mt-1">
                Período: {datos.fechas.fechaInicio} al {datos.fechas.fechaFin}
              </p>
            )}
          </div>

          <button
            onClick={cargarDatos}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Selector de Período */}
      <PeriodSelectorAdvanced
        asesorId={usuarioActual?.id}
        onPeriodChange={setPeriodo}
        initialPeriod={periodo}
        loading={loading}
      />

      {/* Métricas Generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Productos Vendidos</p>
              <p className="text-2xl font-bold text-gray-900">{metricas.productos_unicos_vendidos || 0}</p>
              <p className="text-xs text-blue-600">Únicos en período</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ingresos Productos</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatearMoneda(metricas.ingresos_totales_productos)}
              </p>
              <p className="text-xs text-green-600">Revenue total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Cantidad Vendida</p>
              <p className="text-2xl font-bold text-gray-900">{metricas.cantidad_total_vendida || 0}</p>
              <p className="text-xs text-purple-600">Unidades totales</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Precio Promedio</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatearMoneda(metricas.precio_promedio_productos)}
              </p>
              <p className="text-xs text-orange-600">Por producto</p>
            </div>
          </div>
        </div>
      </div>

      {/* Clasificación ABC Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Star className="h-5 w-5 text-green-500 mr-2" />
                Productos Clase A
              </h3>
              <p className="text-sm text-gray-600 mt-1">Alto rendimiento (80% ingresos)</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-green-600">{productosClaseA.length}</p>
              <p className="text-sm text-gray-500">productos</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Contribución: <span className="font-semibold text-green-600">
                {formatearMoneda(productosClaseA.reduce((sum, p) => sum + parseFloat(p.ingresos_totales || 0), 0))}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Award className="h-5 w-5 text-yellow-500 mr-2" />
                Productos Clase B
              </h3>
              <p className="text-sm text-gray-600 mt-1">Rendimiento medio (15% ingresos)</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-yellow-600">{productosClaseB.length}</p>
              <p className="text-sm text-gray-500">productos</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Contribución: <span className="font-semibold text-yellow-600">
                {formatearMoneda(productosClaseB.reduce((sum, p) => sum + parseFloat(p.ingresos_totales || 0), 0))}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Box className="h-5 w-5 text-red-500 mr-2" />
                Productos Clase C
              </h3>
              <p className="text-sm text-gray-600 mt-1">Bajo rendimiento (5% ingresos)</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-red-600">{productosClaseC.length}</p>
              <p className="text-sm text-gray-500">productos</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Contribución: <span className="font-semibold text-red-600">
                {formatearMoneda(productosClaseC.reduce((sum, p) => sum + parseFloat(p.ingresos_totales || 0), 0))}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Filtros de Vista */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Ver productos:</span>
          {[
            { key: 'todos', label: 'Todos', color: 'blue' },
            { key: 'clase-a', label: 'Clase A', color: 'green' },
            { key: 'clase-b', label: 'Clase B', color: 'yellow' },
            { key: 'clase-c', label: 'Clase C', color: 'red' }
          ].map(vista => (
            <button
              key={vista.key}
              onClick={() => setVistaActiva(vista.key)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                vistaActiva === vista.key
                  ? `bg-${vista.color}-100 text-${vista.color}-700 border border-${vista.color}-200`
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {vista.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Productos */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2 text-orange-600" />
            Productos - {vistaActiva === 'todos' ? 'Todos' : `Clase ${vistaActiva.slice(-1).toUpperCase()}`}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clasificación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ingresos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Veces Vendido
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % Ingresos
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {obtenerProductosParaVista().slice(0, 20).map((producto) => (
                <tr key={producto.producto_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="p-2 bg-gray-100 rounded-lg mr-3">
                        <Package className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {producto.descripcion || `Producto ${producto.codigo}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          {producto.codigo} • {producto.marca} • {producto.asesores_que_vendieron} asesores
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${obtenerColorClasificacion(producto.clasificacion_abc)}`}>
                      Clase {producto.clasificacion_abc}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    {formatearMoneda(producto.ingresos_totales)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatearCantidad(producto.cantidad_total, producto.unidad_medida)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {producto.veces_vendido} ventas
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {producto.porcentaje_ingresos}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matriz ABC Visual */}
      <MatrizABCVisual />

      {/* Análisis Inteligente y Alertas */}
      {(() => {
        const analisis = generarAnalisisInteligente();
        if (!analisis) return null;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel de Alertas */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Bell className="h-5 w-5 mr-2 text-red-500" />
                  Alertas Automáticas
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {analisis.alertas.length > 0 ? (
                  analisis.alertas.map((alerta, index) => (
                    <div key={index} className={`border-l-4 p-4 rounded-r-lg ${
                      alerta.nivel === 'warning' ? 'border-yellow-400 bg-yellow-50' : 'border-blue-400 bg-blue-50'
                    }`}>
                      <div className="flex items-start">
                        <AlertCircle className={`h-5 w-5 mt-0.5 mr-3 ${
                          alerta.nivel === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                        <div className="flex-1">
                          <h4 className={`font-medium ${
                            alerta.nivel === 'warning' ? 'text-yellow-800' : 'text-blue-800'
                          }`}>
                            {alerta.titulo}
                          </h4>
                          <p className={`text-sm mt-1 ${
                            alerta.nivel === 'warning' ? 'text-yellow-700' : 'text-blue-700'
                          }`}>
                            {alerta.descripcion}
                          </p>
                          <p className={`text-xs mt-2 font-medium ${
                            alerta.nivel === 'warning' ? 'text-yellow-800' : 'text-blue-800'
                          }`}>
                            💡 {alerta.accion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
                    <p>No hay alertas en este momento</p>
                    <p className="text-sm">Todos los productos están funcionando bien</p>
                  </div>
                )}
              </div>
            </div>

            {/* Panel de Recomendaciones */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Lightbulb className="h-5 w-5 mr-2 text-yellow-500" />
                  Recomendaciones Estratégicas
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {analisis.recomendaciones.length > 0 ? (
                  analisis.recomendaciones.map((rec, index) => (
                    <div key={index} className="border-l-4 border-green-400 bg-green-50 p-4 rounded-r-lg">
                      <div className="flex items-start">
                        <Target className="h-5 w-5 text-green-500 mt-0.5 mr-3" />
                        <div className="flex-1">
                          <h4 className="font-medium text-green-800">{rec.titulo}</h4>
                          <p className="text-sm text-green-700 mt-1">{rec.descripcion}</p>
                          <p className="text-xs text-green-800 font-medium mt-2">
                            🎯 {rec.accion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Zap className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>No hay recomendaciones disponibles</p>
                    <p className="text-sm">Tu cartera está optimizada</p>
                  </div>
                )}

                {/* Insights Adicionales */}
                {analisis.insights.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Eye className="h-4 w-4 mr-2" />
                      Insights de Rendimiento
                    </h4>
                    <div className="space-y-3">
                      {analisis.insights.map((insight, index) => (
                        <div key={index} className="border-l-4 border-purple-400 bg-purple-50 p-3 rounded-r-lg">
                          <h5 className="font-medium text-purple-800 text-sm">{insight.titulo}</h5>
                          <p className="text-xs text-purple-700 mt-1">{insight.descripcion}</p>
                          {insight.valor && (
                            <p className="text-xs text-purple-800 font-medium mt-1">
                              💰 Valor: {formatearMoneda(insight.valor)}
                            </p>
                          )}
                          <p className="text-xs text-purple-800 font-medium mt-1">
                            📈 {insight.accion}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Performance de Asesores por Productos */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Performance por Asesor - Productos
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {productosPorAsesor.map((asesor) => (
              <div key={asesor.asesor_id} className="border border-gray-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">
                    {asesor.nombre_completo || `Asesor #${asesor.asesor_id}`}
                  </h4>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Productos:</span>
                      <span className="font-medium">{asesor.productos_unicos}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Cantidad:</span>
                      <span className="font-medium">{asesor.cantidad_total}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Líneas:</span>
                      <span className="font-medium">{asesor.lineas_vendidas}</span>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-lg font-bold text-green-600">
                        {formatearMoneda(asesor.ingresos_productos)}
                      </p>
                      <p className="text-xs text-gray-500">ingresos productos</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ABCProductos;