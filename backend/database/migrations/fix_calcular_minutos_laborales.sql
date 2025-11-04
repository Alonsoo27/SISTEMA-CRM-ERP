-- ============================================
-- FUNCIÓN: Calcular minutos laborales entre dos fechas
-- Considera: Horario 8 AM - 6 PM, Almuerzo 1-2 PM, Excluye fines de semana
-- ============================================

CREATE OR REPLACE FUNCTION calcular_minutos_laborales(
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP
) RETURNS INTEGER AS $BODY$
DECLARE
    minutos_totales INTEGER := 0;
    fecha_actual TIMESTAMP;
    hora_inicio TIME;
    hora_fin TIME;
    dia_semana INTEGER;
    fecha_inicio_peru TIMESTAMP;
    fecha_fin_peru TIMESTAMP;
BEGIN
    -- Convertir de UTC a hora Perú (UTC-5)
    fecha_inicio_peru := fecha_inicio - INTERVAL '5 hours';
    fecha_fin_peru := fecha_fin - INTERVAL '5 hours';

    -- Si las fechas son iguales o fecha_fin es antes de fecha_inicio, retornar 0
    IF fecha_fin_peru <= fecha_inicio_peru THEN
        RETURN 0;
    END IF;

    -- Inicializar con la fecha de inicio en hora Perú
    fecha_actual := DATE_TRUNC('day', fecha_inicio_peru);

    -- Iterar día por día
    WHILE fecha_actual <= DATE_TRUNC('day', fecha_fin_peru) LOOP
        -- Obtener día de la semana (0 = domingo, 6 = sábado)
        dia_semana := EXTRACT(DOW FROM fecha_actual);

        -- Solo procesar días laborales (lunes a viernes)
        IF dia_semana >= 1 AND dia_semana <= 5 THEN
            -- Determinar hora de inicio para este día
            IF DATE_TRUNC('day', fecha_actual) = DATE_TRUNC('day', fecha_inicio_peru) THEN
                -- Primer día: usar hora real, pero no antes de 8 AM
                hora_inicio := GREATEST(
                    CAST(EXTRACT(HOUR FROM fecha_inicio_peru) || ':' || EXTRACT(MINUTE FROM fecha_inicio_peru) AS TIME),
                    '08:00:00'::TIME
                );
            ELSE
                -- Días posteriores: empezar a las 8 AM
                hora_inicio := '08:00:00'::TIME;
            END IF;

            -- Determinar hora de fin para este día
            IF DATE_TRUNC('day', fecha_actual) = DATE_TRUNC('day', fecha_fin_peru) THEN
                -- Último día: usar hora real, pero no después de 6 PM
                hora_fin := LEAST(
                    CAST(EXTRACT(HOUR FROM fecha_fin_peru) || ':' || EXTRACT(MINUTE FROM fecha_fin_peru) AS TIME),
                    '18:00:00'::TIME
                );
            ELSE
                -- Días anteriores: terminar a las 6 PM
                hora_fin := '18:00:00'::TIME;
            END IF;

            -- Solo procesar si el rango está dentro del horario laboral
            IF hora_inicio < '18:00:00'::TIME AND hora_fin > '08:00:00'::TIME THEN
                -- Asegurar que está dentro de horario laboral
                hora_inicio := GREATEST(hora_inicio, '08:00:00'::TIME);
                hora_fin := LEAST(hora_fin, '18:00:00'::TIME);

                -- Calcular minutos antes del almuerzo (8 AM - 1 PM)
                IF hora_inicio < '13:00:00'::TIME THEN
                    minutos_totales := minutos_totales + EXTRACT(EPOCH FROM (
                        LEAST(hora_fin, '13:00:00'::TIME) - hora_inicio
                    ))::INTEGER / 60;
                END IF;

                -- Calcular minutos después del almuerzo (2 PM - 6 PM)
                IF hora_fin > '14:00:00'::TIME THEN
                    minutos_totales := minutos_totales + EXTRACT(EPOCH FROM (
                        hora_fin - GREATEST(hora_inicio, '14:00:00'::TIME)
                    ))::INTEGER / 60;
                END IF;
            END IF;
        END IF;

        -- Avanzar al siguiente día
        fecha_actual := fecha_actual + INTERVAL '1 day';
    END LOOP;

    RETURN minutos_totales;
END;
$BODY$ LANGUAGE plpgsql STABLE;

-- Test de la función con timestamps en UTC
-- Los timestamps se convierten automáticamente a hora Perú (UTC-5)
-- UTC: 22:56 -> Perú: 17:56 (5:56 PM)
-- UTC: 14:28 -> Perú: 09:28 (9:28 AM)
-- Debería retornar ~92 minutos para el caso de Aldo
SELECT calcular_minutos_laborales(
    '2025-11-03 22:56:00'::TIMESTAMP,
    '2025-11-04 14:28:00'::TIMESTAMP
) as minutos_laborales;

COMMENT ON FUNCTION calcular_minutos_laborales IS
'Calcula los minutos laborales entre dos timestamps UTC, considerando:
- Conversión automática a hora Perú (UTC-5)
- Horario: 8 AM - 6 PM (lunes a viernes)
- Almuerzo: 1 PM - 2 PM (no cuenta)
- Fines de semana: no cuentan';
