-- ============================================
-- ACTUALIZAR PASSWORDS DE USUARIOS DE PRUEBA
-- Los usuarios 3-7 tienen hashes inválidos
-- ============================================

-- Password para todos: Test123!
-- Hash bcrypt generado: $2b$12$mz1t5BqQRFMt8RFDlvQrhe4mFVeymRVVWGXhu47IGRS.Q.2z7Z6yG

UPDATE usuarios
SET password_hash = '$2b$12$mz1t5BqQRFMt8RFDlvQrhe4mFVeymRVVWGXhu47IGRS.Q.2z7Z6yG',
    debe_cambiar_password = true,
    password_cambiado_en = CURRENT_TIMESTAMP
WHERE id IN (3, 4, 5, 6, 7);

-- Verificar actualización
SELECT
    id,
    email,
    nombre,
    apellido,
    'Test123!' as nueva_password,
    debe_cambiar_password
FROM usuarios
WHERE id IN (3, 4, 5, 6, 7);

-- ============================================
-- RESUMEN DE CREDENCIALES ACTUALIZADAS:
-- ============================================
-- ana.ruiz@empresa.com         → Test123!
-- carlos.perez@empresa.com     → Test123!
-- maria.garcia@empresa.com     → Test123!
-- luis.torres@empresa.com      → Test123!
-- sofia.mendoza@empresa.com    → Test123!
-- ============================================
