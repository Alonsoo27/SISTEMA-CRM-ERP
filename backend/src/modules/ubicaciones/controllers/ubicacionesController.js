const db = require('../../../config/database');

const ubicacionesController = {
  // Obtener todos los departamentos
  async getDepartamentos(req, res) {
    try {
      const result = await db.query(`
        SELECT DISTINCT departamento, ubigeo, departamento_codigo
        FROM ubicaciones_peru
        WHERE nivel = 'departamento'
        ORDER BY departamento ASC
      `);

      res.json({
        success: true,
        departamentos: result.rows
      });
    } catch (error) {
      console.error('Error obteniendo departamentos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // Obtener provincias por departamento
  async getProvinciasByDepartamento(req, res) {
    try {
      const { departamento } = req.params;

      if (!departamento) {
        return res.status(400).json({
          success: false,
          message: 'El parámetro departamento es requerido'
        });
      }

      const result = await db.query(`
        SELECT DISTINCT provincia, ubigeo, provincia_codigo
        FROM ubicaciones_peru
        WHERE nivel = 'provincia'
          AND departamento = $1
        ORDER BY provincia ASC
      `, [departamento.toUpperCase()]);

      res.json({
        success: true,
        departamento: departamento.toUpperCase(),
        provincias: result.rows
      });
    } catch (error) {
      console.error('Error obteniendo provincias:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // Obtener distritos por departamento y provincia
  async getDistritosByProvincia(req, res) {
    try {
      const { departamento, provincia } = req.params;

      if (!departamento || !provincia) {
        return res.status(400).json({
          success: false,
          message: 'Los parámetros departamento y provincia son requeridos'
        });
      }

      const result = await db.query(`
        SELECT DISTINCT distrito, ubigeo, distrito_codigo
        FROM ubicaciones_peru
        WHERE nivel = 'distrito'
          AND departamento = $1
          AND provincia = $2
        ORDER BY distrito ASC
      `, [departamento.toUpperCase(), provincia.toUpperCase()]);

      res.json({
        success: true,
        departamento: departamento.toUpperCase(),
        provincia: provincia.toUpperCase(),
        distritos: result.rows
      });
    } catch (error) {
      console.error('Error obteniendo distritos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // Obtener jerarquía completa (útil para búsquedas)
  async getJerarquiaCompleta(req, res) {
    try {
      const result = await db.query(`
        SELECT
          departamento,
          provincia,
          distrito,
          departamento_codigo,
          provincia_codigo,
          distrito_codigo,
          ubigeo,
          nivel
        FROM ubicaciones_peru
        ORDER BY departamento, provincia, distrito
      `);

      // Organizar en estructura jerárquica
      const jerarquia = {};

      result.rows.forEach(row => {
        if (!jerarquia[row.departamento]) {
          jerarquia[row.departamento] = {
            codigo: row.departamento_codigo,
            ubigeo: row.nivel === 'departamento' ? row.ubigeo : null,
            provincias: {}
          };
        }

        if (row.nivel === 'provincia' || row.nivel === 'distrito') {
          if (!jerarquia[row.departamento].provincias[row.provincia]) {
            jerarquia[row.departamento].provincias[row.provincia] = {
              codigo: row.provincia_codigo,
              ubigeo: row.nivel === 'provincia' ? row.ubigeo : null,
              distritos: {}
            };
          }
        }

        if (row.nivel === 'distrito') {
          jerarquia[row.departamento].provincias[row.provincia].distritos[row.distrito] = {
            codigo: row.distrito_codigo,
            ubigeo: row.ubigeo
          };
        }
      });

      res.json({
        success: true,
        jerarquia
      });
    } catch (error) {
      console.error('Error obteniendo jerarquía completa:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // Validar ubicación específica
  async validarUbicacion(req, res) {
    try {
      const { departamento, provincia, distrito } = req.query;

      if (!departamento) {
        return res.status(400).json({
          success: false,
          message: 'El departamento es requerido'
        });
      }

      let query = 'SELECT * FROM ubicaciones_peru WHERE departamento = $1';
      let params = [departamento.toUpperCase()];

      if (provincia) {
        query += ' AND provincia = $2';
        params.push(provincia.toUpperCase());
      }

      if (distrito) {
        query += ' AND distrito = $3';
        params.push(distrito.toUpperCase());
      }

      const result = await db.query(query, params);

      res.json({
        success: true,
        existe: result.rows.length > 0,
        ubicaciones: result.rows
      });
    } catch (error) {
      console.error('Error validando ubicación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // Búsqueda de ubicaciones (útil para autocompletado)
  async buscarUbicaciones(req, res) {
    try {
      const { termino, tipo } = req.query;

      if (!termino || termino.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El término de búsqueda debe tener al menos 2 caracteres'
        });
      }

      let query;
      let params = [`%${termino.toUpperCase()}%`];

      if (tipo === 'departamento') {
        query = `
          SELECT DISTINCT departamento as nombre, 'departamento' as tipo, ubigeo, departamento_codigo as codigo
          FROM ubicaciones_peru
          WHERE departamento ILIKE $1 AND nivel = 'departamento'
          ORDER BY departamento
          LIMIT 10
        `;
      } else if (tipo === 'provincia') {
        query = `
          SELECT DISTINCT provincia as nombre, departamento, 'provincia' as tipo, ubigeo, provincia_codigo as codigo
          FROM ubicaciones_peru
          WHERE provincia ILIKE $1 AND nivel = 'provincia'
          ORDER BY provincia
          LIMIT 10
        `;
      } else if (tipo === 'distrito') {
        query = `
          SELECT DISTINCT distrito as nombre, provincia, departamento, 'distrito' as tipo, ubigeo, distrito_codigo as codigo
          FROM ubicaciones_peru
          WHERE distrito ILIKE $1 AND nivel = 'distrito'
          ORDER BY distrito
          LIMIT 10
        `;
      } else {
        // Búsqueda general
        query = `
          (SELECT DISTINCT departamento as nombre, '' as provincia, '' as departamento_padre, 'departamento' as tipo, ubigeo, departamento_codigo as codigo
           FROM ubicaciones_peru
           WHERE departamento ILIKE $1 AND nivel = 'departamento')
          UNION
          (SELECT DISTINCT provincia as nombre, departamento as provincia, departamento as departamento_padre, 'provincia' as tipo, ubigeo, provincia_codigo as codigo
           FROM ubicaciones_peru
           WHERE provincia ILIKE $1 AND nivel = 'provincia')
          UNION
          (SELECT DISTINCT distrito as nombre, provincia, departamento as departamento_padre, 'distrito' as tipo, ubigeo, distrito_codigo as codigo
           FROM ubicaciones_peru
           WHERE distrito ILIKE $1 AND nivel = 'distrito')
          ORDER BY tipo, nombre
          LIMIT 20
        `;
      }

      const result = await db.query(query, params);

      res.json({
        success: true,
        termino,
        tipo: tipo || 'todos',
        resultados: result.rows
      });
    } catch (error) {
      console.error('Error buscando ubicaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  }
};

module.exports = ubicacionesController;