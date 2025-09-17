/**
 * Utilidades centralizadas para manejo de productos de interés
 * Soluciona problemas de serialización JSON y normaliza datos
 */

export const normalizarProductosInteres = (productos) => {
  if (!productos || !Array.isArray(productos)) return [];
  
  return productos.map(producto => {
    // Si es string JSON, parsearlo
    if (typeof producto === 'string') {
      try {
        const parsed = JSON.parse(producto);
        return {
          ...parsed,
          tipo: parsed.tipo || 'legacy-parsed'
        };
      } catch {
        // Si no se puede parsear, crear objeto básico
        return { 
          id: Date.now() + Math.random(), 
          nombre: producto, 
          tipo: 'legacy-string' 
        };
      }
    }
    
    // Si ya es objeto, devolverlo normalizado
    if (typeof producto === 'object' && producto !== null) {
      return {
        ...producto,
        tipo: producto.tipo || 'object'
      };
    }
    
    // Fallback para casos inesperados
    return { 
      id: Date.now() + Math.random(), 
      nombre: String(producto), 
      tipo: 'fallback' 
    };
  });
};

export const formatearProductoParaVisualizacion = (producto, maxLength = 20) => {
  // Si es string JSON, parsearlo primero
  if (typeof producto === 'string') {
    try {
      const parsed = JSON.parse(producto);
      const nombre = parsed.codigo ? `${parsed.codigo} - ${parsed.nombre}` : parsed.nombre;
      return nombre?.length > maxLength ? `${nombre.substring(0, maxLength)}...` : nombre || 'Producto';
    } catch {
      // Si no se puede parsear, tratar como string normal
      return producto.length > maxLength ? `${producto.substring(0, maxLength)}...` : producto;
    }
  }
  
  // Si es objeto, extraer nombre legible
  if (typeof producto === 'object' && producto !== null) {
    const nombre = producto.codigo ? `${producto.codigo} - ${producto.nombre}` : producto.nombre;
    return nombre?.length > maxLength ? `${nombre.substring(0, maxLength)}...` : nombre || 'Producto';
  }
  
  return 'Producto';
};

export const serializarProductosParaEnvio = (productos) => {
  if (!Array.isArray(productos)) return [];
  
  return productos
    .filter(p => p && (typeof p === 'object' || typeof p === 'string'))
    .map(producto => {
      // Mantener objetos como objetos (no serializar a JSON string)
      if (typeof producto === 'object') {
        return producto;
      }
      // Los strings se mantienen como strings
      return producto;
    });
};

export const contarProductosValidos = (productos) => {
  if (!Array.isArray(productos)) return 0;
  return productos.filter(p => p && (typeof p === 'object' || typeof p === 'string')).length;
};

export const extraerResumenProductos = (productos, limite = 3) => {
  const productosNormalizados = normalizarProductosInteres(productos);
  const resumen = productosNormalizados
    .slice(0, limite)
    .map(p => formatearProductoParaVisualizacion(p, 15));
  
  const restantes = productosNormalizados.length - limite;
  
  return {
    productos: resumen,
    restantes: restantes > 0 ? restantes : 0,
    total: productosNormalizados.length
  };
};