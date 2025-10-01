import React, { useState } from 'react';
import { Package, BarChart3, Search, Plus, Filter, Download, Upload } from 'lucide-react';
import ProductosList from '../components/productos/ProductoList/ProductosList';
import DashboardProductos from '../components/productos/Dashboard/DashboardProductos';

const ProductosPage = () => {
  const [activeView, setActiveView] = useState('lista'); // 'dashboard', 'lista'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Optimizado - Sin redundancia */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Título y navegación integrados */}
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
              </div>

              {/* Navegación como tabs */}
              <nav className="flex space-x-8">
                <button
                  onClick={() => setActiveView('lista')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeView === 'lista'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Gestionar
                </button>
                <button
                  onClick={() => setActiveView('dashboard')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeView === 'dashboard'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Dashboard
                </button>
              </nav>
            </div>

            {/* Acciones rápidas */}
            <div className="flex items-center space-x-3">
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </button>
              <button className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Producto
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeView === 'lista' ? (
          <ProductosList />
        ) : (
          <DashboardProductos />
        )}
      </main>
    </div>
  );
};

export default ProductosPage;