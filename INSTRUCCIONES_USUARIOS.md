# 🎯 Sistema de Usuarios - Guía de Implementación

## ✅ Cambios Implementados

He creado un **sistema completo de gestión de usuarios** para tu CRM/ERP:

### Backend:
1. ✅ **Tabla de usuarios en BD** con roles, áreas y permisos
2. ✅ **Login dinámico** usando bcrypt (ya no hardcodeado)
3. ✅ **API REST completa** para CRUD de usuarios
4. ✅ **Middleware de autenticación** actualizado

### Frontend:
1. ✅ **Panel de administración** con lista, crear, editar, eliminar usuarios
2. ✅ **Cambio de contraseñas** desde el panel
3. ✅ **Filtros y búsqueda** de usuarios
4. ✅ **Acceso desde el menú** (icono 👥 Usuarios)

---

## 📋 PASOS PARA ACTIVAR EL SISTEMA

### 1️⃣ Ejecutar Migración SQL en Supabase

1. Ve a **Supabase Dashboard** → tu proyecto
2. Click en **SQL Editor** (lateral izquierdo)
3. Click en **"+ New Query"**
4. Abre el archivo:
   ```
   database/migrations/create_users_system.sql
   ```
5. **Copia TODO el contenido** del archivo
6. **Pégalo en el SQL Editor** de Supabase
7. Click en **"Run"** (botón inferior derecho)
8. Deberías ver: ✅ Success

**Esto creará:**
- Tabla `usuarios` con todos los campos
- Tabla `roles` con 8 roles predefinidos
- Tabla `areas` con 6 áreas predefinidas
- **Usuario inicial**: `eliashuaraca2012@gmail.com` / `admin123`

---

### 2️⃣ Iniciar el Backend

```bash
cd backend
npm start
```

**Verificar que cargue el módulo:**
```
✅ usuarios cargado correctamente
✅ Rutas de usuarios registradas en /api/usuarios
```

---

### 3️⃣ Iniciar el Frontend

```bash
cd frontend
npm run dev
```

---

### 4️⃣ Probar el Sistema

1. **Login con el usuario inicial:**
   - Email: `eliashuaraca2012@gmail.com`
   - Password: `admin123`

2. **Ir al panel de usuarios:**
   - Click en el menú lateral → 👥 **Usuarios**
   - Verás tu usuario creado

3. **Crear nuevos usuarios:**
   - Click en **"Nuevo Usuario"**
   - Llena el formulario:
     - Nombre, apellido, email
     - Contraseña (temporal)
     - Rol (Admin, Vendedor, etc.)
     - Área (Ventas, Sistemas, etc.)
   - Click en **"Crear"**

4. **Gestionar usuarios:**
   - ✏️ Editar: Cambiar datos del usuario
   - 🔑 Cambiar contraseña: Nueva password
   - 🗑️ Eliminar: Desactivar usuario (soft delete)

---

## 🔐 Roles Disponibles

| Rol | Nivel | Permisos |
|-----|-------|----------|
| **SUPER_ADMIN** | ADMIN | Todos los permisos |
| **ADMIN** | ADMIN | Administración general |
| **GERENTE** | EJECUTIVO | Lectura, escritura, eliminación |
| **JEFE** | EJECUTIVO | Lectura, escritura |
| **VENDEDOR** | OPERATIVO | Lectura, escritura |
| **ALMACEN** | OPERATIVO | Lectura, escritura |
| **SOPORTE** | OPERATIVO | Lectura, escritura |
| **USUARIO** | OPERATIVO | Solo lectura |

---

## 📊 Áreas Disponibles

- 🖥️ **SISTEMAS** - Tecnología
- 💰 **VENTAS** - Comercial
- 📦 **ALMACÉN** - Operaciones
- 🛠️ **SOPORTE** - Servicios
- 📋 **ADMINISTRACIÓN**
- 👥 **RECURSOS HUMANOS**

---

## 🔄 Próximos Pasos Recomendados

1. **Cambiar la contraseña del admin inicial:**
   - Login → Panel de usuarios
   - Click en 🔑 del usuario admin
   - Cambiar de `admin123` a algo más seguro

2. **Crear usuarios para tu equipo:**
   - Un usuario por cada persona
   - Asignar el rol correcto
   - Asignar área correspondiente

3. **Probar el login con diferentes usuarios:**
   - Logout
   - Login con el nuevo usuario
   - Verificar que funciona

4. **Opcional: Implementar roles y permisos en el frontend:**
   - Ocultar/mostrar opciones según el rol
   - Proteger rutas según permisos
   - Validar acciones en el backend

---

## ⚠️ Importante

- ✅ El login ahora **consulta la base de datos**
- ✅ Las contraseñas se guardan **hasheadas con bcrypt**
- ✅ El sistema soporta **JWT real en producción**
- ✅ Los usuarios eliminados son **soft delete** (no se borran físicamente)

---

## 🆘 Troubleshooting

### Error: "Cannot find module usuarios"
→ Reinicia el backend (`npm start`)

### Error: "Table usuarios does not exist"
→ Ejecuta la migración SQL en Supabase

### No puedo hacer login
→ Verifica que la migración SQL se ejecutó correctamente
→ Revisa en Supabase que exista el usuario en la tabla `usuarios`

### El panel de usuarios no carga
→ Verifica que el backend esté corriendo
→ Revisa la consola del navegador (F12) para errores

---

## 📝 Estructura de Archivos Creados

```
backend/
├── src/modules/usuarios/
│   ├── controllers/usuariosController.js   # CRUD completo
│   └── routes/usuariosRoutes.js            # Rutas API
├── src/modules/auth/routes/authRoutes.js   # Login actualizado
└── server.js                                # Módulo registrado

database/
└── migrations/
    └── create_users_system.sql              # Script SQL

frontend/
├── src/pages/AdministracionUsuariosPage.jsx  # Panel admin
└── src/App.jsx                                # Ruta agregada
```

---

¡Listo! Tu sistema ahora tiene **gestión de usuarios completamente funcional** 🎉
