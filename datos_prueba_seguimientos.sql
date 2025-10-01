-- Insertar datos de prueba para la balanza de seguimientos

-- 1. Seguimientos PENDIENTES (3 seguimientos)
INSERT INTO seguimientos (
    prospecto_id, asesor_id, tipo, fecha_programada, fecha_limite,
    descripcion, completado, vencido, visible_para_asesor
) VALUES
-- Seguimiento para hoy (pendiente normal)
(1, 1, 'llamada', '2025-09-23T16:00:00Z', '2025-09-23T18:00:00Z',
 'Llamada de seguimiento comercial', false, false, true),

-- Seguimiento para mañana (pendiente)
(2, 1, 'email', '2025-09-24T10:00:00Z', '2025-09-24T12:00:00Z',
 'Envío de propuesta comercial', false, false, true),

-- Seguimiento VENCIDO (ayer)
(3, 1, 'whatsapp', '2025-09-22T14:00:00Z', '2025-09-22T16:00:00Z',
 'WhatsApp de seguimiento - VENCIDO', false, true, true);

-- 2. Seguimientos REALIZADOS (4 seguimientos del último mes)
INSERT INTO seguimientos (
    prospecto_id, asesor_id, tipo, fecha_programada, fecha_limite,
    descripcion, completado, vencido, visible_para_asesor,
    completado_por, fecha_completado, resultado_seguimiento
) VALUES
-- Completado hoy
(4, 1, 'llamada', '2025-09-23T09:00:00Z', '2025-09-23T11:00:00Z',
 'Llamada exitosa - Interesado', true, false, true,
 1, '2025-09-23T09:30:00Z', 'Cliente muy interesado, solicita segunda reunión'),

-- Completado ayer
(5, 1, 'reunion', '2025-09-22T15:00:00Z', '2025-09-22T17:00:00Z',
 'Reunión presencial cerrada', true, false, true,
 1, '2025-09-22T16:00:00Z', 'Reunión exitosa, enviar cotización'),

-- Completado hace 3 días
(6, 1, 'email', '2025-09-20T11:00:00Z', '2025-09-20T13:00:00Z',
 'Email enviado con información', true, false, true,
 1, '2025-09-20T11:15:00Z', 'Email enviado, cliente respondió positivamente'),

-- Completado hace una semana
(7, 1, 'whatsapp', '2025-09-16T14:00:00Z', '2025-09-16T16:00:00Z',
 'WhatsApp con documentos', true, false, true,
 1, '2025-09-16T14:20:00Z', 'Documentos enviados, cliente revisando');

-- 3. Actualizar algunos prospectos para que tengan datos coherentes
UPDATE prospectos
SET
    estado_seguimiento = 'pendiente',
    fecha_ultimo_seguimiento = '2025-09-23T16:00:00Z'
WHERE id IN (1, 2, 3);

UPDATE prospectos
SET
    estado_seguimiento = 'realizado',
    fecha_ultimo_seguimiento = '2025-09-23T09:30:00Z'
WHERE id IN (4, 5, 6, 7);

-- 4. Verificar que existan prospectos básicos
INSERT INTO prospectos (
    codigo, nombre_cliente, telefono, email, estado,
    asesor_id, asesor_nombre, activo, valor_estimado
) VALUES
('PROS-TEST01', 'Cliente Prueba 1', '+51987654321', 'test1@test.com', 'Prospecto', 1, 'Admin User', true, 5000),
('PROS-TEST02', 'Cliente Prueba 2', '+51987654322', 'test2@test.com', 'Contactado', 1, 'Admin User', true, 3000),
('PROS-TEST03', 'Cliente Prueba 3', '+51987654323', 'test3@test.com', 'Negociación', 1, 'Admin User', true, 8000),
('PROS-TEST04', 'Cliente Prueba 4', '+51987654324', 'test4@test.com', 'Prospecto', 1, 'Admin User', true, 2500),
('PROS-TEST05', 'Cliente Prueba 5', '+51987654325', 'test5@test.com', 'Contactado', 1, 'Admin User', true, 6000),
('PROS-TEST06', 'Cliente Prueba 6', '+51987654326', 'test6@test.com', 'Prospecto', 1, 'Admin User', true, 4000),
('PROS-TEST07', 'Cliente Prueba 7', '+51987654327', 'test7@test.com', 'Negociación', 1, 'Admin User', true, 7500)
ON CONFLICT (codigo) DO NOTHING;