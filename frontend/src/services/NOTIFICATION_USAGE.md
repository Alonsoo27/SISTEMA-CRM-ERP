# 🔔 Sistema de Notificaciones de Escritorio

Documentación completa del servicio de notificaciones nativas del sistema operativo.

---

## 📋 Índice
- [Características](#características)
- [Instalación](#instalación)
- [Uso Básico](#uso-básico)
- [Casos de Uso Implementados](#casos-de-uso-implementados)
- [Integración con Otros Módulos](#integración-con-otros-módulos)
- [Componente de Configuración](#componente-de-configuración)
- [Mejores Prácticas](#mejores-prácticas)
- [Troubleshooting](#troubleshooting)

---

## ✨ Características

- ✅ **Notificaciones nativas** del sistema operativo (Windows, macOS, Linux)
- ✅ **Auto-gestión de permisos** con solicitud amigable
- ✅ **Tipos predefinidos** para casos críticos (vencimientos, urgencias)
- ✅ **Callbacks personalizables** (onClick, onError)
- ✅ **Auto-cierre** configurable
- ✅ **Vibración** en dispositivos compatibles
- ✅ **Tags únicos** para evitar duplicados
- ✅ **Singleton pattern** - una sola instancia global

---

## 🚀 Instalación

El servicio ya está creado en `/src/services/notificationService.js`. Solo necesitas importarlo:

```javascript
import notificationService from '../services/notificationService';
```

---

## 📖 Uso Básico

### 1. Solicitar Permisos

```javascript
// Al cargar la aplicación o login
useEffect(() => {
    notificationService.ensurePermission().then(granted => {
        if (granted) {
            console.log('✅ Notificaciones habilitadas');
        }
    });
}, []);
```

### 2. Mostrar Notificación Simple

```javascript
notificationService.notificar(
    'Título de la notificación',
    'Mensaje que aparecerá en el escritorio'
);
```

### 3. Notificación con Opciones

```javascript
notificationService.showNotification('Título', {
    body: 'Mensaje descriptivo',
    icon: '/favicon.ico',
    tag: 'mi-notificacion-unica',
    requireInteraction: true, // No se cierra automáticamente
    urgency: 'high', // 'low', 'normal', 'high'
    onClick: () => {
        // Ejecutar acción al hacer clic
        window.location.href = '/marketing';
    }
});
```

---

## 🎯 Casos de Uso Implementados

### 1. Actividades Vencidas (Marketing)

**Uso actual:**
```javascript
// MarketingPage.jsx línea ~195
notificationService.notificarActividadVencida(actividad);
```

**Cuándo se dispara:**
- Polling cada 30 segundos detecta actividades vencidas
- Solo notifica al usuario propietario
- Muestra modal Y notificación de escritorio

**Qué hace:**
- Muestra título: "⚠️ Actividad Vencida"
- Muestra descripción de la actividad
- Al hacer clic: trae la ventana al frente
- Requiere interacción (no se cierra automáticamente)

### 2. Múltiples Actividades Vencidas

```javascript
notificationService.notificarActividadesVencidas(3);
// "Tienes 3 actividades vencidas pendientes de gestionar"
```

### 3. Actividad Próxima a Vencer (30 min antes)

```javascript
notificationService.notificarActividadProximaVencer(actividad, 30);
// "⏰ Actividad Próxima a Vencer - vence en 30 minutos"
```

---

## 🔗 Integración con Otros Módulos

### Módulo de Soporte - Tickets Urgentes

```javascript
// SoportePage.jsx
import notificationService from '../services/notificationService';

useEffect(() => {
    const verificarTicketsUrgentes = async () => {
        const urgentes = await soporteService.obtenerTicketsUrgentes();

        if (urgentes.length > 0) {
            urgentes.forEach(ticket => {
                notificationService.notificarTicketUrgente(ticket);
            });
        }
    };

    // Verificar cada minuto
    const interval = setInterval(verificarTicketsUrgentes, 60000);
    return () => clearInterval(interval);
}, []);
```

### Módulo de Ventas - Seguimientos Críticos

```javascript
// ProspectosPage.jsx
import notificationService from '../services/notificationService';

const verificarSeguimientosVencidos = async () => {
    const vencidos = await prospectosService.obtenerSeguimientosVencidos();

    vencidos.forEach(seguimiento => {
        notificationService.notificarSeguimientoCritico(seguimiento);
    });
};
```

### Módulo de Ventas - Metas

```javascript
// DashboardVentas.jsx
const verificarProgreso = (metaActual) => {
    const porcentaje = (metaActual.actual / metaActual.objetivo) * 100;

    // Notificar al llegar al 90%
    if (porcentaje >= 90 && porcentaje < 100) {
        notificationService.notificarMetaProximaCumplirse(metaActual, porcentaje.toFixed(0));
    }
};
```

---

## ⚙️ Componente de Configuración

### Dónde Agregar

Puedes agregar el componente `NotificationSettings` en:

1. **Perfil del Usuario:**
```javascript
// UserProfile.jsx
import NotificationSettings from '../components/common/NotificationSettings';

return (
    <div>
        <h2>Mi Perfil</h2>
        {/* ... otros campos ... */}

        <NotificationSettings />
    </div>
);
```

2. **Sección de Ajustes:**
```javascript
// SettingsPage.jsx
import NotificationSettings from '../components/common/NotificationSettings';

return (
    <div>
        <h1>Configuración</h1>
        <NotificationSettings />
    </div>
);
```

---

## 🎨 Mejores Prácticas

### ✅ Hacer:

1. **Solo notificar eventos críticos**
   - Actividades vencidas
   - Tickets urgentes
   - Seguimientos críticos
   - **NO notificar** cada mensaje, cada cambio, etc.

2. **Usar tags únicos**
   ```javascript
   tag: `actividad-vencida-${actividad.id}` // ✅ Bueno
   tag: 'notificacion' // ❌ Malo (duplicados)
   ```

3. **Proporcionar acciones claras**
   ```javascript
   onClick: () => {
       window.location.href = '/marketing'; // ✅ Redirige al lugar relevante
   }
   ```

4. **Respetar la configuración del usuario**
   ```javascript
   if (notificationService.permissionGranted) {
       // Solo notificar si tiene permisos
   }
   ```

### ❌ Evitar:

1. **Spam de notificaciones**
   - NO notificar cada 5 segundos
   - Agrupar notificaciones similares

2. **Notificaciones sin contexto**
   ```javascript
   // ❌ Malo
   notificationService.notificar('Error', 'Algo salió mal');

   // ✅ Bueno
   notificationService.notificar('Error en Ticket #123', 'No se pudo actualizar el estado');
   ```

3. **Notificaciones para eventos triviales**
   - NO notificar "Login exitoso"
   - NO notificar "Datos guardados"
   - SÍ notificar "Actividad vencida hace 2 horas"

---

## 🐛 Troubleshooting

### Problema: "Notificaciones no aparecen"

**Solución:**
```javascript
console.log('Soporte:', notificationService.isSupported()); // true/false
console.log('Permisos:', notificationService.getPermissionStatus()); // 'granted'/'denied'/'default'
```

### Problema: "Usuario bloqueó las notificaciones"

**Solución:**
- Mostrar instrucciones para desbloquear:
  1. Click en el candado 🔒 en la barra de direcciones
  2. Cambiar "Notificaciones" a "Permitir"
  3. Recargar página

### Problema: "Notificaciones duplicadas"

**Solución:**
- Usa tags únicos:
```javascript
tag: `tipo-${id}-${timestamp}` // Único por entidad
```

### Problema: "Navegador no compatible"

**Navegadores soportados:**
- ✅ Chrome 22+
- ✅ Firefox 22+
- ✅ Edge 14+
- ✅ Safari 7+
- ✅ Opera 25+

---

## 📚 API Completa

### Métodos Principales

| Método | Descripción | Retorno |
|--------|-------------|---------|
| `isSupported()` | Verifica si el navegador soporta notificaciones | `boolean` |
| `getPermissionStatus()` | Obtiene estado actual de permisos | `'granted'/'denied'/'default'/'not-supported'` |
| `requestPermission()` | Solicita permisos al usuario | `Promise<boolean>` |
| `ensurePermission()` | Solicita solo si no están otorgados | `Promise<boolean>` |
| `showNotification(title, opts)` | Muestra notificación genérica | `Notification \| null` |
| `notificar(titulo, mensaje, opts)` | Alias simplificado | `Notification \| null` |

### Métodos Especializados

| Método | Caso de Uso |
|--------|-------------|
| `notificarActividadVencida(actividad)` | Actividad vencida individual |
| `notificarActividadesVencidas(cantidad)` | Múltiples actividades vencidas |
| `notificarActividadProximaVencer(actividad, minutos)` | Alerta 30 min antes |
| `notificarTicketUrgente(ticket)` | Ticket de soporte crítico |
| `notificarSeguimientoCritico(seguimiento)` | Seguimiento de ventas vencido |
| `notificarMetaProximaCumplirse(meta, porcentaje)` | Meta cerca del 100% |

---

## 🔐 Privacidad y Seguridad

- ✅ **Local only:** Las notificaciones son 100% locales, no se envían a servidores
- ✅ **Control del usuario:** El usuario puede bloquear en cualquier momento
- ✅ **Sin tracking:** No se rastrean las notificaciones mostradas
- ✅ **Datos sensibles:** NO incluir información confidencial en notificaciones

---

## 📝 Licencia

Este servicio es parte del Sistema CRM/ERP y sigue la misma licencia del proyecto principal.

---

**Desarrollado con ❤️ por el equipo de desarrollo**
