import { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, Key, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';

const AdministracionUsuariosPage = () => {
    const [usuarios, setUsuarios] = useState([]);
    const [roles, setRoles] = useState([]);
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'password'
    const [selectedUsuario, setSelectedUsuario] = useState(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        nombre: '',
        apellido: '',
        rol_id: '',
        area_id: '',
        jefe_id: '',
        telefono: '',
        es_jefe: false,
        vende: false,
        estado: 'ACTIVO'
    });

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [usuariosRes, rolesRes, areasRes] = await Promise.all([
                axios.get(`${API_CONFIG.BASE_URL}/api/usuarios`, { headers }),
                axios.get(`${API_CONFIG.BASE_URL}/api/usuarios/roles`, { headers }),
                axios.get(`${API_CONFIG.BASE_URL}/api/usuarios/areas`, { headers })
            ]);

            setUsuarios(usuariosRes.data.data || []);
            setRoles(rolesRes.data.data || []);
            setAreas(areasRes.data.data || []);
        } catch (error) {
            console.error('Error cargando datos:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            if (modalMode === 'create') {
                await axios.post(`${API_CONFIG.BASE_URL}/api/usuarios`, formData, { headers });
                toast.success('Usuario creado exitosamente');
            } else if (modalMode === 'edit') {
                const { password, ...updateData } = formData;
                await axios.put(`${API_CONFIG.BASE_URL}/api/usuarios/${selectedUsuario.id}`, updateData, { headers });
                toast.success('Usuario actualizado exitosamente');
            } else if (modalMode === 'password') {
                await axios.put(
                    `${API_CONFIG.BASE_URL}/api/usuarios/${selectedUsuario.id}/password`,
                    { password_nuevo: formData.password },
                    { headers }
                );
                toast.success('Contraseña actualizada exitosamente');
            }

            setShowModal(false);
            resetForm();
            cargarDatos();
        } catch (error) {
            console.error('Error:', error);
            toast.error(error.response?.data?.message || 'Error al guardar');
        }
    };

    const handleEliminar = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_CONFIG.BASE_URL}/api/usuarios/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Usuario eliminado');
            cargarDatos();
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al eliminar usuario');
        }
    };

    const abrirModal = (mode, usuario = null) => {
        setModalMode(mode);
        setSelectedUsuario(usuario);

        if (mode === 'create') {
            resetForm();
        } else if (mode === 'edit' && usuario) {
            setFormData({
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                rol_id: usuario.rol_id,
                area_id: usuario.area_id || '',
                jefe_id: usuario.jefe_id || '',
                telefono: usuario.telefono || '',
                es_jefe: usuario.es_jefe,
                vende: usuario.vende,
                estado: usuario.estado
            });
        } else if (mode === 'password') {
            setFormData({ ...formData, password: '' });
        }

        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({
            email: '',
            password: '',
            nombre: '',
            apellido: '',
            rol_id: '',
            area_id: '',
            jefe_id: '',
            telefono: '',
            es_jefe: false,
            vende: false,
            estado: 'ACTIVO'
        });
    };

    const usuariosFiltrados = usuarios.filter(u =>
        u.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.rol_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-xl">Cargando...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Users className="h-8 w-8" />
                        Administración de Usuarios
                    </h1>
                    <p className="text-gray-600 mt-1">Gestiona los usuarios del sistema</p>
                </div>
                <button
                    onClick={() => abrirModal('create')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
                >
                    <Plus className="h-5 w-5" />
                    Nuevo Usuario
                </button>
            </div>

            {/* Búsqueda */}
            <div className="mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email o rol..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Tabla de Usuarios */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Área</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {usuariosFiltrados.map((usuario) => (
                            <tr key={usuario.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="font-medium">{usuario.nombre_completo}</div>
                                        {usuario.es_jefe && (
                                            <span className="text-xs text-blue-600">Jefe de equipo</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{usuario.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        usuario.rol_nivel === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                                        usuario.rol_nivel === 'EJECUTIVO' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {usuario.rol_nombre}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{usuario.area_nombre || '-'}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        usuario.estado === 'ACTIVO' ? 'bg-green-100 text-green-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {usuario.estado}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => abrirModal('edit', usuario)}
                                            className="text-blue-600 hover:text-blue-800"
                                            title="Editar"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => abrirModal('password', usuario)}
                                            className="text-yellow-600 hover:text-yellow-800"
                                            title="Cambiar contraseña"
                                        >
                                            <Key className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleEliminar(usuario.id)}
                                            className="text-red-600 hover:text-red-800"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold mb-4">
                                {modalMode === 'create' && 'Nuevo Usuario'}
                                {modalMode === 'edit' && 'Editar Usuario'}
                                {modalMode === 'password' && 'Cambiar Contraseña'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {modalMode === 'password' ? (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Nueva Contraseña</label>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg"
                                            required
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Nombre *</label>
                                                <input
                                                    type="text"
                                                    value={formData.nombre}
                                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                                    className="w-full px-3 py-2 border rounded-lg"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Apellido *</label>
                                                <input
                                                    type="text"
                                                    value={formData.apellido}
                                                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                                                    className="w-full px-3 py-2 border rounded-lg"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Email *</label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg"
                                                required
                                            />
                                        </div>

                                        {modalMode === 'create' && (
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Contraseña *</label>
                                                <input
                                                    type="password"
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                    className="w-full px-3 py-2 border rounded-lg"
                                                    required
                                                />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Rol *</label>
                                                <select
                                                    value={formData.rol_id}
                                                    onChange={(e) => setFormData({ ...formData, rol_id: e.target.value })}
                                                    className="w-full px-3 py-2 border rounded-lg"
                                                    required
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {roles.map(rol => (
                                                        <option key={rol.id} value={rol.id}>{rol.nombre}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Área</label>
                                                <select
                                                    value={formData.area_id}
                                                    onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}
                                                    className="w-full px-3 py-2 border rounded-lg"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {areas.map(area => (
                                                        <option key={area.id} value={area.id}>{area.nombre}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Teléfono</label>
                                                <input
                                                    type="text"
                                                    value={formData.telefono}
                                                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                                    className="w-full px-3 py-2 border rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Estado</label>
                                                <select
                                                    value={formData.estado}
                                                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                                                    className="w-full px-3 py-2 border rounded-lg"
                                                >
                                                    <option value="ACTIVO">ACTIVO</option>
                                                    <option value="INACTIVO">INACTIVO</option>
                                                    <option value="SUSPENDIDO">SUSPENDIDO</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.es_jefe}
                                                    onChange={(e) => setFormData({ ...formData, es_jefe: e.target.checked })}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">Es jefe de equipo</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.vende}
                                                    onChange={(e) => setFormData({ ...formData, vende: e.target.checked })}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">Puede vender</span>
                                            </label>
                                        </div>
                                    </>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                                    >
                                        {modalMode === 'create' ? 'Crear' : 'Guardar'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdministracionUsuariosPage;
