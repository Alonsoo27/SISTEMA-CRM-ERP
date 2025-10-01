// ============================================
// MONITOR DE PERFORMANCE PARA DASHBOARD
// ============================================

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.isEnabled = import.meta.env.MODE === 'production';

    if (this.isEnabled) {
      this.initPerformanceObserver();
    }
  }

  // ============================================
  // MÉTRICAS DE CARGA Y RESPUESTA
  // ============================================

  startTimer(name) {
    if (!this.isEnabled) return;

    this.metrics.set(name, {
      startTime: performance.now(),
      type: 'timer'
    });
  }

  endTimer(name) {
    if (!this.isEnabled) return;

    const metric = this.metrics.get(name);
    if (metric && metric.type === 'timer') {
      const duration = performance.now() - metric.startTime;

      this.metrics.set(name, {
        ...metric,
        duration,
        endTime: performance.now()
      });

      // Log si la operación es lenta
      if (duration > 2000) {
        console.warn(`⚠️ Operación lenta detectada: ${name} tomó ${duration.toFixed(2)}ms`);
      }

      return duration;
    }
  }

  // ============================================
  // MÉTRICAS DE API
  // ============================================

  recordAPICall(endpoint, duration, success, errorType = null) {
    if (!this.isEnabled) return;

    const key = `api_${endpoint}`;
    const existing = this.metrics.get(key) || {
      calls: 0,
      totalDuration: 0,
      successes: 0,
      errors: 0,
      errorTypes: {}
    };

    existing.calls++;
    existing.totalDuration += duration;

    if (success) {
      existing.successes++;
    } else {
      existing.errors++;
      if (errorType) {
        existing.errorTypes[errorType] = (existing.errorTypes[errorType] || 0) + 1;
      }
    }

    existing.averageDuration = existing.totalDuration / existing.calls;
    existing.successRate = (existing.successes / existing.calls) * 100;

    this.metrics.set(key, existing);

    // Alertas automáticas
    if (existing.successRate < 90 && existing.calls > 5) {
      console.error(`🚨 API con baja tasa de éxito: ${endpoint} (${existing.successRate.toFixed(1)}%)`);
    }

    if (existing.averageDuration > 3000) {
      console.warn(`⏱️ API lenta: ${endpoint} (promedio: ${existing.averageDuration.toFixed(0)}ms)`);
    }
  }

  // ============================================
  // MÉTRICAS DE COMPONENTES REACT
  // ============================================

  recordComponentRender(componentName, renderTime) {
    if (!this.isEnabled) return;

    const key = `component_${componentName}`;
    const existing = this.metrics.get(key) || {
      renders: 0,
      totalTime: 0,
      maxTime: 0,
      minTime: Infinity
    };

    existing.renders++;
    existing.totalTime += renderTime;
    existing.maxTime = Math.max(existing.maxTime, renderTime);
    existing.minTime = Math.min(existing.minTime, renderTime);
    existing.averageTime = existing.totalTime / existing.renders;

    this.metrics.set(key, existing);

    // Alerta por renders costosos
    if (renderTime > 16.67) { // 60fps = 16.67ms por frame
      console.warn(`🎨 Render lento: ${componentName} (${renderTime.toFixed(2)}ms)`);
    }
  }

  // ============================================
  // MÉTRICAS DE MEMORIA
  // ============================================

  recordMemoryUsage() {
    if (!this.isEnabled || !performance.memory) return;

    const memory = {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };

    const memoryMB = {
      used: (memory.used / 1024 / 1024).toFixed(2),
      total: (memory.total / 1024 / 1024).toFixed(2),
      limit: (memory.limit / 1024 / 1024).toFixed(2)
    };

    this.metrics.set('memory_current', memoryMB);

    // Alerta por uso alto de memoria
    const usagePercentage = (memory.used / memory.limit) * 100;
    if (usagePercentage > 80) {
      console.warn(`🧠 Uso alto de memoria: ${usagePercentage.toFixed(1)}% (${memoryMB.used}MB/${memoryMB.limit}MB)`);
    }

    return memoryMB;
  }

  // ============================================
  // MÉTRICAS DE ERRORES
  // ============================================

  recordError(errorType, component, message) {
    if (!this.isEnabled) return;

    const key = 'errors';
    const existing = this.metrics.get(key) || {
      total: 0,
      byType: {},
      byComponent: {},
      recent: []
    };

    existing.total++;
    existing.byType[errorType] = (existing.byType[errorType] || 0) + 1;
    existing.byComponent[component] = (existing.byComponent[component] || 0) + 1;

    existing.recent.push({
      type: errorType,
      component,
      message,
      timestamp: Date.now()
    });

    // Mantener solo los últimos 10 errores
    if (existing.recent.length > 10) {
      existing.recent.shift();
    }

    this.metrics.set(key, existing);

    console.error(`❌ Error registrado: ${errorType} en ${component}: ${message}`);
  }

  // ============================================
  // OBSERVER DE PERFORMANCE NATIVO
  // ============================================

  initPerformanceObserver() {
    if (typeof PerformanceObserver === 'undefined') return;

    // Observer para Navigation Timing
    try {
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'navigation') {
            this.metrics.set('page_load', {
              domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
              loadComplete: entry.loadEventEnd - entry.loadEventStart,
              firstPaint: entry.fetchStart,
              domInteractive: entry.domInteractive - entry.fetchStart
            });
          }
        });
      });

      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.set('navigation', navObserver);
    } catch (e) {
      console.warn('PerformanceObserver no soportado para navigation');
    }

    // Observer para Resource Timing
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name.includes('/api/')) {
            const duration = entry.responseEnd - entry.requestStart;
            const endpoint = entry.name.split('/api/')[1];

            this.recordAPICall(endpoint, duration, entry.transferSize > 0);
          }
        });
      });

      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', resourceObserver);
    } catch (e) {
      console.warn('PerformanceObserver no soportado para resources');
    }
  }

  // ============================================
  // REPORTES Y ANÁLISIS
  // ============================================

  generateReport() {
    if (!this.isEnabled) return null;

    const report = {
      timestamp: new Date().toISOString(),
      memory: this.metrics.get('memory_current'),
      pageLoad: this.metrics.get('page_load'),
      apis: {},
      components: {},
      errors: this.metrics.get('errors'),
      summary: {
        totalAPICalls: 0,
        averageAPITime: 0,
        errorRate: 0,
        slowComponents: []
      }
    };

    // Procesar métricas de APIs
    this.metrics.forEach((value, key) => {
      if (key.startsWith('api_')) {
        const apiName = key.replace('api_', '');
        report.apis[apiName] = value;
        report.summary.totalAPICalls += value.calls;
      } else if (key.startsWith('component_')) {
        const componentName = key.replace('component_', '');
        report.components[componentName] = value;

        if (value.averageTime > 10) {
          report.summary.slowComponents.push({
            name: componentName,
            avgTime: value.averageTime
          });
        }
      }
    });

    // Calcular estadísticas generales
    const apiCount = Object.keys(report.apis).length;
    if (apiCount > 0) {
      const totalTime = Object.values(report.apis).reduce((sum, api) => sum + api.totalDuration, 0);
      const totalCalls = Object.values(report.apis).reduce((sum, api) => sum + api.calls, 0);
      report.summary.averageAPITime = totalTime / totalCalls;
    }

    if (report.errors) {
      report.summary.errorRate = (report.errors.total / report.summary.totalAPICalls) * 100;
    }

    return report;
  }

  // ============================================
  // HOOK PARA COMPONENTES REACT
  // ============================================

  useComponentPerformance(componentName) {
    if (!this.isEnabled) return () => {};

    return () => {
      const startTime = performance.now();

      return () => {
        const endTime = performance.now();
        this.recordComponentRender(componentName, endTime - startTime);
      };
    };
  }

  // ============================================
  // UTILIDADES
  // ============================================

  clear() {
    this.metrics.clear();
  }

  getMetric(name) {
    return this.metrics.get(name);
  }

  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  // Enviar métricas a servicio externo (opcional)
  async sendToAnalytics(endpoint) {
    if (!this.isEnabled) return;

    try {
      const report = this.generateReport();
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
    } catch (error) {
      console.error('Error enviando métricas:', error);
    }
  }
}

// ============================================
// INSTANCIA GLOBAL
// ============================================

const performanceMonitor = new PerformanceMonitor();

// ============================================
// WRAPPER PARA fetchWithErrorHandling
// ============================================

export const monitoredFetch = async (url, options = {}) => {
  const startTime = performance.now();

  try {
    const response = await fetch(url, options);
    const duration = performance.now() - startTime;

    performanceMonitor.recordAPICall(
      url,
      duration,
      response.ok,
      response.ok ? null : `HTTP_${response.status}`
    );

    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitor.recordAPICall(url, duration, false, 'NETWORK_ERROR');
    throw error;
  }
};

// ============================================
// HOOK PARA COMPONENTES REACT
// ============================================

export const usePerformanceMonitor = (componentName) => {
  if (import.meta.env.MODE !== 'production') return;

  const startRender = () => performance.now();

  const endRender = (startTime) => {
    const duration = performance.now() - startTime;
    performanceMonitor.recordComponentRender(componentName, duration);
  };

  return { startRender, endRender };
};

// ============================================
// AUTO-REPORTE CADA 5 MINUTOS
// ============================================

if (typeof window !== 'undefined' && import.meta.env.MODE === 'production') {
  setInterval(() => {
    const report = performanceMonitor.generateReport();
    if (report) {
      console.group('📊 Reporte de Performance');
      console.log('Memoria:', report.memory);
      console.log('APIs más lentas:', Object.entries(report.apis)
        .sort(([,a], [,b]) => b.averageDuration - a.averageDuration)
        .slice(0, 3)
      );
      console.log('Componentes más lentos:', report.summary.slowComponents);
      console.groupEnd();
    }

    performanceMonitor.recordMemoryUsage();
  }, 5 * 60 * 1000); // 5 minutos
}

export default performanceMonitor;