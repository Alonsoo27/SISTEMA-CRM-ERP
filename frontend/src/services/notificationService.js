// ============================================
// SERVICIO DE NOTIFICACIONES DE ESCRITORIO
// Web Notifications API
// ============================================

class NotificationService {
    constructor() {
        this.permissionGranted = false;
        this.initializePermission();
    }

    /**
     * Verificar si el navegador soporta notificaciones
     */
    isSupported() {
        return 'Notification' in window;
    }

    /**
     * Obtener estado actual de permisos
     */
    getPermissionStatus() {
        if (!this.isSupported()) {
            return 'not-supported';
        }
        return Notification.permission; // 'granted', 'denied', 'default'
    }

    /**
     * Inicializar y verificar permisos al crear instancia
     */
    initializePermission() {
        if (!this.isSupported()) {
            console.warn('⚠️ Este navegador no soporta notificaciones de escritorio');
            return;
        }

        this.permissionGranted = Notification.permission === 'granted';
        console.log('🔔 Notificaciones de escritorio:', this.permissionGranted ? 'Habilitadas' : 'Deshabilitadas');
    }

    /**
     * Solicitar permiso al usuario
     * @returns {Promise<boolean>} true si se otorgó permiso
     */
    async requestPermission() {
        if (!this.isSupported()) {
            console.warn('⚠️ Notificaciones no soportadas');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.permissionGranted = true;
            return true;
        }

        if (Notification.permission === 'denied') {
            console.warn('⚠️ El usuario ha bloqueado las notificaciones');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permissionGranted = permission === 'granted';

            if (this.permissionGranted) {
                console.log('✅ Permisos de notificación otorgados');
                // Mostrar notificación de bienvenida
                this.showNotification('Notificaciones activadas', {
                    body: 'Recibirás alertas de actividades urgentes',
                    icon: '/favicon.ico',
                    tag: 'welcome',
                    requireInteraction: false
                });
            } else {
                console.log('❌ Permisos de notificación denegados');
            }

            return this.permissionGranted;
        } catch (error) {
            console.error('Error solicitando permisos de notificación:', error);
            return false;
        }
    }

    /**
     * Mostrar notificación de escritorio
     * @param {string} title - Título de la notificación
     * @param {object} options - Opciones de la notificación
     * @returns {Notification|null}
     */
    showNotification(title, options = {}) {
        if (!this.permissionGranted) {
            console.log('⚠️ No hay permisos para mostrar notificaciones');
            return null;
        }

        const defaultOptions = {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            silent: false,
            ...options
        };

        try {
            const notification = new Notification(title, defaultOptions);

            // Auto-cerrar después de 10 segundos si no requiere interacción
            if (!options.requireInteraction) {
                setTimeout(() => notification.close(), 10000);
            }

            // Eventos de la notificación
            notification.onclick = (event) => {
                event.preventDefault();
                window.focus(); // Traer ventana al frente
                notification.close();

                // Ejecutar callback si existe
                if (options.onClick) {
                    options.onClick(event);
                }
            };

            notification.onerror = (error) => {
                console.error('Error mostrando notificación:', error);
            };

            return notification;
        } catch (error) {
            console.error('Error creando notificación:', error);
            return null;
        }
    }

    /**
     * NOTIFICACIÓN: Actividad vencida
     */
    notificarActividadVencida(actividad) {
        return this.showNotification('⚠️ Actividad Vencida', {
            body: `"${actividad.descripcion || actividad.codigo}" requiere tu atención`,
            icon: '/favicon.ico',
            tag: `actividad-vencida-${actividad.id}`,
            requireInteraction: true,
            urgency: 'high',
            onClick: () => {
                // Redirigir al módulo de marketing si no está ahí
                if (!window.location.pathname.includes('/marketing')) {
                    window.location.href = '/marketing';
                }
            }
        });
    }

    /**
     * NOTIFICACIÓN: Actividades vencidas detectadas (múltiples)
     */
    notificarActividadesVencidas(cantidad) {
        return this.showNotification('⚠️ Actividades Vencidas', {
            body: `Tienes ${cantidad} actividad${cantidad > 1 ? 'es' : ''} vencida${cantidad > 1 ? 's' : ''} pendiente${cantidad > 1 ? 's' : ''} de gestionar`,
            icon: '/favicon.ico',
            tag: 'actividades-vencidas-multiples',
            requireInteraction: true,
            urgency: 'high',
            onClick: () => {
                if (!window.location.pathname.includes('/marketing')) {
                    window.location.href = '/marketing';
                }
            }
        });
    }

    /**
     * NOTIFICACIÓN: Actividad próxima a vencer
     */
    notificarActividadProximaVencer(actividad, minutosRestantes) {
        return this.showNotification('⏰ Actividad Próxima a Vencer', {
            body: `"${actividad.descripcion || actividad.codigo}" vence en ${minutosRestantes} minutos`,
            icon: '/favicon.ico',
            tag: `actividad-proxima-${actividad.id}`,
            requireInteraction: false,
            urgency: 'normal'
        });
    }

    /**
     * NOTIFICACIÓN: Ticket urgente de soporte
     */
    notificarTicketUrgente(ticket) {
        return this.showNotification('🚨 Ticket Urgente', {
            body: `Ticket #${ticket.id}: ${ticket.asunto}`,
            icon: '/favicon.ico',
            tag: `ticket-urgente-${ticket.id}`,
            requireInteraction: true,
            urgency: 'high',
            onClick: () => {
                if (!window.location.pathname.includes('/soporte')) {
                    window.location.href = `/soporte/tickets/${ticket.id}`;
                }
            }
        });
    }

    /**
     * NOTIFICACIÓN: Seguimiento crítico de ventas
     */
    notificarSeguimientoCritico(seguimiento) {
        return this.showNotification('📞 Seguimiento Crítico', {
            body: `Seguimiento de "${seguimiento.prospecto_nombre}" está vencido`,
            icon: '/favicon.ico',
            tag: `seguimiento-critico-${seguimiento.id}`,
            requireInteraction: true,
            urgency: 'high',
            onClick: () => {
                if (!window.location.pathname.includes('/prospectos')) {
                    window.location.href = '/prospectos';
                }
            }
        });
    }

    /**
     * NOTIFICACIÓN: Meta próxima a cumplirse
     */
    notificarMetaProximaCumplirse(meta, porcentaje) {
        return this.showNotification('🎯 Meta Próxima a Cumplirse', {
            body: `¡Ya completaste el ${porcentaje}% de tu meta!`,
            icon: '/favicon.ico',
            tag: 'meta-progreso',
            requireInteraction: false,
            urgency: 'low'
        });
    }

    /**
     * NOTIFICACIÓN: Genérica personalizada
     */
    notificar(titulo, mensaje, opciones = {}) {
        return this.showNotification(titulo, {
            body: mensaje,
            icon: '/favicon.ico',
            ...opciones
        });
    }

    /**
     * Verificar y solicitar permisos si no están otorgados
     * Útil para llamar al login o al iniciar sesión
     */
    async ensurePermission() {
        if (!this.permissionGranted && this.getPermissionStatus() === 'default') {
            return await this.requestPermission();
        }
        return this.permissionGranted;
    }
}

// Exportar instancia singleton
const notificationService = new NotificationService();
export default notificationService;
