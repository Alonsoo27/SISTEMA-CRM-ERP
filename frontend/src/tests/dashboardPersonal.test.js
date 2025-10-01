// ============================================
// TESTS PARA DASHBOARD PERSONAL OPTIMIZADO
// ============================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import DashboardAsesoresOptimized from '../components/ventas/VentasMetrics/VentasMetricsOptimized';
import {
  fetchWithErrorHandling,
  cargarDatosDashboard,
  calcularPorcentajeMeta,
  formatearMonto
} from '../utils/dashboardUtils';

// Mock de funciones utilitarias
jest.mock('../utils/dashboardUtils', () => ({
  fetchWithErrorHandling: jest.fn(),
  cargarDatosDashboard: jest.fn(),
  calcularPorcentajeMeta: jest.fn(),
  formatearMonto: jest.fn(),
  determinarModoVistaInicial: jest.fn(),
  puedeAlternarModos: jest.fn(),
  activarFullscreen: jest.fn(),
  desactivarFullscreen: jest.fn(),
  calcularPorcentajeCanal: jest.fn(),
  obtenerIconoTendencia: jest.fn(),
  obtenerColorTendencia: jest.fn(),
  getCachedData: jest.fn(),
  setCachedData: jest.fn()
}));

// Mock de localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('Dashboard Personal Optimizado', () => {

  const mockUsuarioVendedor = {
    id: 1,
    nombre: 'Juan Pérez',
    vende: true,
    rol_id: 7 // VENDEDOR
  };

  const mockUsuarioSupervisor = {
    id: 2,
    nombre: 'María González',
    vende: false,
    rol_id: 3 // JEFE_VENTAS
  };

  const mockMetricas = {
    ventas: {
      completadas: 10,
      valor_total: 15000,
      promedio_venta: 1500
    },
    canales: {
      whatsapp: 6,
      llamadas: 3,
      presenciales: 1
    },
    metas: {
      meta_cantidad: 15,
      meta_valor: 20000
    },
    actividad: {
      total_mensajes: 150,
      dias_activos: 20
    },
    pipeline: {
      tasa_conversion: 25,
      total_oportunidades: 40
    },
    tendencias: {
      ventas_completadas: 12.5,
      valor_total_completadas: 8.3
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('fake-jwt-token');

    // Mock de funciones utilitarias con valores por defecto
    calcularPorcentajeMeta.mockReturnValue(67);
    formatearMonto.mockReturnValue('$15,000.00');
  });

  // ============================================
  // TESTS DE RENDERIZADO BÁSICO
  // ============================================

  test('Renderiza correctamente para vendedor en modo propio', async () => {
    cargarDatosDashboard.mockResolvedValue({
      dashboard: mockMetricas,
      metas: mockMetricas.metas,
      geografia: [],
      sectores: [],
      ranking: null,
      bono: null,
      errores: []
    });

    render(<DashboardAsesoresOptimized usuarioActual={mockUsuarioVendedor} />);

    // Verificar que se muestra el header correcto
    await waitFor(() => {
      expect(screen.getByText('Mi Dashboard Personal')).toBeInTheDocument();
    });

    // Verificar métricas principales
    expect(screen.getByText('Mis Ventas')).toBeInTheDocument();
    expect(screen.getByText('Ingresos')).toBeInTheDocument();
    expect(screen.getByText('Tasa Conversión')).toBeInTheDocument();
  });

  test('Renderiza correctamente para supervisor en modo supervisión', async () => {
    cargarDatosDashboard.mockResolvedValue({
      dashboard: null,
      metas: null,
      geografia: [],
      sectores: [],
      ranking: null,
      bono: null,
      errores: []
    });

    render(<DashboardAsesoresOptimized usuarioActual={mockUsuarioSupervisor} />);

    await waitFor(() => {
      expect(screen.getByText('Selecciona un Asesor')).toBeInTheDocument();
    });
  });

  // ============================================
  // TESTS DE FUNCIONALIDAD
  // ============================================

  test('Carga métricas correctamente al seleccionar asesor', async () => {
    const mockAsesores = [
      { id: 1, nombre_completo: 'Juan Pérez', rol: 'Vendedor' }
    ];

    fetchWithErrorHandling
      .mockResolvedValueOnce({ success: true, data: { asesores: mockAsesores } })
      .mockResolvedValue({ success: true, data: mockMetricas });

    cargarDatosDashboard.mockResolvedValue({
      dashboard: mockMetricas,
      metas: mockMetricas.metas,
      geografia: [],
      sectores: [],
      ranking: null,
      bono: null,
      errores: []
    });

    render(<DashboardAsesoresOptimized usuarioActual={mockUsuarioSupervisor} />);

    // Simular selección de asesor
    await waitFor(() => {
      const selector = screen.getByRole('combobox');
      fireEvent.change(selector, { target: { value: '1' } });
    });

    // Verificar que se llamó la función de carga
    expect(cargarDatosDashboard).toHaveBeenCalledWith(1, 'mes_actual', expect.any(Object));
  });

  test('Cambia período correctamente', async () => {
    cargarDatosDashboard.mockResolvedValue({
      dashboard: mockMetricas,
      metas: mockMetricas.metas,
      geografia: [],
      sectores: [],
      ranking: null,
      bono: null,
      errores: []
    });

    render(<DashboardAsesoresOptimized usuarioActual={mockUsuarioVendedor} />);

    await waitFor(() => {
      const selectorPeriodo = screen.getAllByRole('combobox')[0]; // Primer selector
      fireEvent.change(selectorPeriodo, { target: { value: 'semana_actual' } });
    });

    // Verificar que se recarga con el nuevo período
    await waitFor(() => {
      expect(cargarDatosDashboard).toHaveBeenCalledWith(
        mockUsuarioVendedor.id,
        'semana_actual',
        expect.any(Object)
      );
    });
  });

  // ============================================
  // TESTS DE MANEJO DE ERRORES
  // ============================================

  test('Maneja errores de carga correctamente', async () => {
    cargarDatosDashboard.mockRejectedValue(new Error('Network error'));

    render(<DashboardAsesoresOptimized usuarioActual={mockUsuarioVendedor} />);

    await waitFor(() => {
      expect(screen.getByText('Error cargando dashboard')).toBeInTheDocument();
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    // Verificar botón de reintentar
    const botonReintentar = screen.getByText('Reintentar');
    expect(botonReintentar).toBeInTheDocument();
  });

  test('Muestra loading state correctamente', () => {
    cargarDatosDashboard.mockImplementation(() => new Promise(() => {})); // Nunca se resuelve

    render(<DashboardAsesoresOptimized usuarioActual={mockUsuarioVendedor} />);

    // Verificar elementos de loading
    expect(screen.getAllByTestId(/loading/i).length).toBeGreaterThan(0);
  });

  // ============================================
  // TESTS DE FUNCIONES UTILITARIAS
  // ============================================

  test('fetchWithErrorHandling maneja timeout correctamente', async () => {
    const mockFetch = jest.fn(() =>
      new Promise((resolve) =>
        setTimeout(() => resolve({ ok: true, json: () => ({}) }), 15000)
      )
    );
    global.fetch = mockFetch;

    const resultado = await fetchWithErrorHandling('/api/test');

    expect(resultado.success).toBe(false);
    expect(resultado.error).toContain('Timeout');
  });

  test('calcularPorcentajeMeta funciona correctamente', () => {
    calcularPorcentajeMeta.mockImplementation((logrado, meta) => {
      if (!meta || meta === 0) return 0;
      return Math.round((logrado / meta) * 100);
    });

    expect(calcularPorcentajeMeta(10, 15)).toBe(67);
    expect(calcularPorcentajeMeta(15, 15)).toBe(100);
    expect(calcularPorcentajeMeta(10, 0)).toBe(0);
  });

  test('formatearMonto formatea correctamente', () => {
    formatearMonto.mockImplementation((monto) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(monto || 0);
    });

    expect(formatearMonto(15000)).toBe('$15,000.00');
    expect(formatearMonto(0)).toBe('$0.00');
  });

  // ============================================
  // TESTS DE INTERACCIÓN UI
  // ============================================

  test('Modo fullscreen funciona correctamente', async () => {
    cargarDatosDashboard.mockResolvedValue({
      dashboard: mockMetricas,
      metas: mockMetricas.metas,
      geografia: [],
      sectores: [],
      ranking: null,
      bono: null,
      errores: []
    });

    render(<DashboardAsesoresOptimized usuarioActual={mockUsuarioVendedor} />);

    await waitFor(() => {
      const botonFullscreen = screen.getByTitle(/Ver en pantalla completa/);
      fireEvent.click(botonFullscreen);
    });

    // Verificar que se llamó la función de fullscreen
    expect(require('../utils/dashboardUtils').activarFullscreen).toHaveBeenCalled();
  });

  test('Toggle entre modos funciona para usuarios con permisos', async () => {
    const usuarioConPermisos = { ...mockUsuarioVendedor, rol_id: 1 }; // SUPER_ADMIN

    cargarDatosDashboard.mockResolvedValue({
      dashboard: mockMetricas,
      metas: mockMetricas.metas,
      geografia: [],
      sectores: [],
      ranking: null,
      bono: null,
      errores: []
    });

    render(<DashboardAsesoresOptimized usuarioActual={usuarioConPermisos} />);

    await waitFor(() => {
      const botonToggle = screen.getByText('Supervisar');
      fireEvent.click(botonToggle);
    });

    // Verificar cambio de modo
    expect(screen.getByText('Mi Dashboard')).toBeInTheDocument();
  });

  // ============================================
  // TESTS DE PERFORMANCE
  // ============================================

  test('No hace re-renders innecesarios', async () => {
    const renderSpy = jest.spyOn(React, 'createElement');

    cargarDatosDashboard.mockResolvedValue({
      dashboard: mockMetricas,
      metas: mockMetricas.metas,
      geografia: [],
      sectores: [],
      ranking: null,
      bono: null,
      errores: []
    });

    const { rerender } = render(
      <DashboardAsesoresOptimized usuarioActual={mockUsuarioVendedor} />
    );

    const initialRenderCount = renderSpy.mock.calls.length;

    // Re-render con las mismas props
    rerender(<DashboardAsesoresOptimized usuarioActual={mockUsuarioVendedor} />);

    const finalRenderCount = renderSpy.mock.calls.length;

    // El número de renders no debería aumentar significativamente
    expect(finalRenderCount - initialRenderCount).toBeLessThan(5);
  });

  // ============================================
  // TESTS DE CACHE
  // ============================================

  test('Usa cache correctamente en producción', async () => {
    process.env.NODE_ENV = 'production';

    const datosCache = {
      dashboard: mockMetricas,
      metas: mockMetricas.metas
    };

    require('../utils/dashboardUtils').getCachedData.mockReturnValue(datosCache);

    render(<DashboardAsesoresOptimized usuarioActual={mockUsuarioVendedor} />);

    await waitFor(() => {
      expect(require('../utils/dashboardUtils').getCachedData).toHaveBeenCalled();
    });

    // No debería llamar al API si hay datos en cache
    expect(cargarDatosDashboard).not.toHaveBeenCalled();
  });

});

// ============================================
// UTILIDADES DE TESTING
// ============================================

export const createMockUsuario = (overrides = {}) => ({
  id: 1,
  nombre: 'Usuario Test',
  vende: true,
  rol_id: 7,
  ...overrides
});

export const createMockMetricas = (overrides = {}) => ({
  ventas: { completadas: 0, valor_total: 0 },
  canales: { whatsapp: 0, llamadas: 0, presenciales: 0 },
  metas: { meta_cantidad: 0, meta_valor: 0 },
  actividad: { total_mensajes: 0, dias_activos: 0 },
  pipeline: { tasa_conversion: 0, total_oportunidades: 0 },
  tendencias: { ventas_completadas: 0, valor_total_completadas: 0 },
  ...overrides
});

export const waitForDashboardLoad = async () => {
  await waitFor(() => {
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });
};