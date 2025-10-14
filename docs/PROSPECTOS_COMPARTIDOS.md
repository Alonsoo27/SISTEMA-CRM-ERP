# Sistema de Prospectos Compartidos

## Descripción General

Sistema multinivel de validación de duplicados que permite a múltiples asesores registrar el mismo prospecto (teléfono) bajo ciertas condiciones, fomentando la competencia interna y flexibilidad operativa.

## Filosofía del Sistema

**"Permitir competencia sana, bloquear conflictos reales"**

- ✅ **Permitir**: Múltiples asesores pueden trabajar el mismo prospecto si no hay conflicto directo
- ⚠️ **Advertir**: Sistema notifica cuando hay solapamiento
- 🚫 **Bloquear**: Solo cuando hay conflicto real (mismo producto en etapa avanzada)

## Escenarios de Validación

### Escenario A: PERMITIR SIN ADVERTENCIA
**Situación**: Prospecto anterior está Cerrado o Perdido
**Acción**: Crear sin restricciones ni notificaciones
**Razón**: El ciclo anterior terminó, no hay conflicto

### Escenario B: ADVERTIR PERO PERMITIR
**Situación**: Prospecto activo con diferentes productos O mismo producto en estado inicial
**Acción**:
- Mostrar modal de advertencia al crear
- Permitir continuar si confirma
- Notificar a asesores existentes
**Razón**: Puede ser legítimo (cliente quiere otro producto o está comparando asesores)

### Escenario C: BLOQUEAR
**Situación**: Prospecto en Cotizado/Negociación con el MISMO producto
**Acción**: Rechazar creación, mostrar mensaje específico
**Razón**: Conflicto directo - no tiene sentido dos asesores cotizando el mismo producto al mismo cliente

### Escenario D: PERMITIR (Especial)
**Situación**: Mismo asesor re-registrando su prospecto cerrado/perdido
**Acción**: Crear sin advertencias
**Razón**: Es el mismo asesor reactivando su propio contacto

## Flujo de Validación

```
┌─────────────────────────────────────┐
│  Asesor intenta registrar prospecto │
└────────────┬────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│  Sistema valida duplicados por teléfono │
└────────────┬───────────────────────────┘
             │
             ├─► ¿Hay duplicados? NO ──► ✅ Crear normalmente
             │
             ▼ SÍ
┌────────────────────────────────────┐
│  ¿Estado anterior Cerrado/Perdido? │
└────────────┬───────────────────────┘
             │
             ├─► SÍ ──► ✅ Escenario A: Crear sin advertencia
             │
             ▼ NO (Activo)
┌────────────────────────────────────┐
│  ¿Tiene productos registrados?     │
└────────────┬───────────────────────┘
             │
             ├─► NO ──► ⚠️ Escenario B: Modal + Notificar
             │
             ▼ SÍ
┌─────────────────────────────────────┐
│  ¿Mismo producto en Cotiz/Negoc?   │
└────────────┬────────────────────────┘
             │
             ├─► SÍ ──► 🚫 Escenario C: BLOQUEAR
             │
             ▼ NO
         ⚠️ Escenario B: Modal + Notificar
```

## Sistema de Notificaciones

### Cuándo se notifica
- Asesor B registra prospecto que Asesor A ya tiene activo
- Solo si Asesor A tiene el prospecto en estado Prospecto/Cotizado/Negociación

### Contenido de la notificación
```
Tipo: PROSPECTO_COMPARTIDO
Título: Prospecto Compartido
Mensaje: "El asesor [Nombre B] está llevando un prospecto que tú registraste:
         [Cliente] - [Teléfono]"
Prioridad: MEDIA
Enlace: /prospectos/{id_original}
```

### Cuándo NO se notifica
- Prospecto Cerrado o Perdido (no hay conflicto)
- Es el mismo asesor

## API Endpoints

### 1. Validación Avanzada (Pre-registro)
```
GET /api/prospectos/validar-duplicado-avanzado/:telefono
Query: productos_interes (JSON array)

Response:
{
  "success": true,
  "validacion": {
    "permitir": true,
    "escenario": "B_ADVERTIR_PRODUCTOS_DIFERENTES",
    "mensaje": "Prospecto activo con productos diferentes",
    "requires_confirmation": true,
    "asesores_activos": [...]
  }
}
```

### 2. Crear Prospecto con Confirmación
```
POST /api/prospectos
Body: {
  ...datos_prospecto,
  "confirmacion_duplicado": true  // ← Agregar si es duplicado confirmado
}

Response (requires_confirmation):
{
  "success": true,
  "requires_confirmation": true,
  "mensaje": "...",
  "asesores_activos": [...],
  "action": "CONFIRMAR_CREACION"
}
```

### 3. Obtener Notificaciones de Compartidos
```
GET /api/prospectos/notificaciones-compartidos
Query: ?limit=50&solo_no_leidas=true

Response:
{
  "success": true,
  "notificaciones": [...],
  "estadisticas": {
    "total_notificaciones": 10,
    "no_leidas": 3,
    "prospectos_unicos": 8,
    "asesores_compartiendo": 4
  }
}
```

### 4. Marcar Notificación como Leída
```
PUT /api/prospectos/notificaciones-compartidos/:id/marcar-leida

Response:
{
  "success": true,
  "message": "Notificación marcada como leída"
}
```

## Implementación Frontend

### Modal de Confirmación
```jsx
// Cuando API retorna requires_confirmation: true

<Modal>
  <WarningIcon />
  <h2>⚠️ Este prospecto ya está siendo atendido</h2>

  <AsesoresList>
    {asesoresActivos.map(asesor => (
      <AsesorItem>
        • {asesor.asesor_nombre}
        - Registrado el {formatDate(asesor.fecha_registro)}
        - Estado: {asesor.estado}
      </AsesorItem>
    ))}
  </AsesoresList>

  <p>¿Deseas continuar con el registro?</p>

  <ButtonGroup>
    <Button onClick={cancelar}>Cancelar</Button>
    <Button onClick={() => crearConConfirmacion()} primary>
      Sí, registrar de todas formas
    </Button>
  </ButtonGroup>
</Modal>
```

### Crear con Confirmación
```javascript
const crearProspecto = async (datos, confirmado = false) => {
  const response = await api.post('/api/prospectos', {
    ...datos,
    confirmacion_duplicado: confirmado
  });

  if (response.data.requires_confirmation && !confirmado) {
    // Mostrar modal
    mostrarModalConfirmacion(response.data);
    return;
  }

  // Prospecto creado exitosamente
  mostrarExito();
};
```

## Configuración de Índices (BD)

### Índices creados por la migración:
1. `idx_prospectos_telefono_estado_validacion` - Búsquedas rápidas por teléfono+estado
2. `idx_prospecto_productos_lookup` - Comparación de productos
3. `idx_notificaciones_prospecto_tipo` - Notificaciones de compartidos
4. `idx_prospectos_asesor_original` - Tracking de asesores originales

## Casos de Uso Reales

### Caso 1: Cliente llama a varios asesores
```
Situación: Cliente interesado llama a Asesor A y Asesor B

Flujo:
1. Asesor A registra → ✅ OK
2. Asesor B registra mismo teléfono → ⚠️ Modal
3. Asesor B confirma → ✅ Creado
4. Asesor A recibe notificación: "Asesor B está trabajando tu prospecto"
5. Ambos trabajan al cliente
6. El que cierre primero, gana la venta
```

### Caso 2: Cliente antiguo vuelve
```
Situación: Cliente que compró hace meses vuelve a llamar

Flujo:
1. Asesor A busca → Cliente existe, estado Cerrado
2. Asesor A registra nuevo prospecto → ✅ Escenario A
3. Sistema permite sin restricciones
4. No notifica a nadie (venta anterior cerrada)
```

### Caso 3: Producto en negociación
```
Situación: Asesor A cotizando "Laptop Dell" al cliente

Flujo:
1. Asesor B intenta registrar mismo cliente + "Laptop Dell"
2. Sistema detecta: Mismo producto en Cotizado
3. 🚫 BLOQUEAR: "Asesor A ya está cotizando este producto"
4. Asesor B ve alternativa: registrar con otro producto
```

## Métricas y Reportes

### Campos agregados en respuesta:
```javascript
{
  "success": true,
  "data": {...},
  "escenario_duplicado": "B_ADVERTIR_PRODUCTOS_DIFERENTES",
  "prospectos_compartidos": 2  // Cuántos asesores más tienen este teléfono
}
```

### Estadísticas de notificaciones:
- Total notificaciones de compartidos
- Notificaciones no leídas
- Prospectos únicos compartidos
- Asesores que están compartiendo

## Ventajas del Sistema

1. **Flexibilidad**: Permite retrabajar clientes antiguos
2. **Competencia sana**: Fomenta que el mejor asesor gane
3. **Realismo**: Reconoce que clientes contactan varios asesores
4. **Protección**: Evita conflictos reales (mismo producto avanzado)
5. **Transparencia**: Todos saben quién más está trabajando el prospecto

## Notas Importantes

- **Sin límites de duplicación**: No hay máximo de asesores por prospecto
- **Comisión**: Solo quien registre la venta cobra comisión
- **Tracking**: `asesor_original_id` mantiene histórico del primer contacto
- **Performance**: Índices optimizados para búsquedas <50ms

## Archivos Modificados

### Backend
- `prospectosController.js:495-532` - Validación multinivel
- `prospectosController.js:687-703` - Sistema de notificaciones
- `prospectosController.js:1859-1963` - Nuevos endpoints
- `prospectosRoutes.js:547-561` - Nuevas rutas

### Utilities
- `validacionDuplicados.js` - Lógica de validación
- `notificacionesProspectos.js` - Sistema de notificaciones

### Base de Datos
- `008_prospectos_duplicados_compartidos.sql` - Migración de índices

## Soporte

Para modificaciones o dudas sobre el sistema, revisar:
1. Lógica de validación: `validacionDuplicados.js`
2. Escenarios de prueba: Ejecutar casos en la sección "Casos de Uso"
3. Logs: Buscar `[ValidacionDuplicados]` en logs del servidor
