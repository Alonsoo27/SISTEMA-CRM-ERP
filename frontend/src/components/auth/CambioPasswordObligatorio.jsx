import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_CONFIG } from '../../config/apiConfig';

const CambioPasswordObligatorio = ({ onSuccess }) => {
    const [formData, setFormData] = useState({
        password_nuevo: '',
        password_confirmacion: ''
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState({});

    const validatePassword = (password) => {
        const errors = {};

        if (password.length < 8) {
            errors.length = 'Mínimo 8 caracteres';
        }
        if (!/[A-Z]/.test(password)) {
            errors.uppercase = 'Una letra mayúscula';
        }
        if (!/[a-z]/.test(password)) {
            errors.lowercase = 'Una letra minúscula';
        }
        if (!/[0-9]/.test(password)) {
            errors.number = 'Un número';
        }

        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validaciones
        if (formData.password_nuevo !== formData.password_confirmacion) {
            toast.error('Las contraseñas no coinciden');
            return;
        }

        const validationErrors = validatePassword(formData.password_nuevo);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            toast.error('La contraseña no cumple los requisitos');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user') || '{}');

            const response = await axios.put(
                `${API_CONFIG.BASE_URL}/api/usuarios/${user.id}/password`,
                { password_nuevo: formData.password_nuevo },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                // Actualizar el usuario en localStorage para indicar que ya no debe cambiar password
                const updatedUser = { ...user, debe_cambiar_password: false };
                localStorage.setItem('user', JSON.stringify(updatedUser));

                toast.success('Contraseña actualizada exitosamente');
                onSuccess();
            }
        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            toast.error(error.response?.data?.message || 'Error al cambiar contraseña');
        } finally {
            setLoading(false);
        }
    };

    const passwordErrors = validatePassword(formData.password_nuevo);
    const passwordMatch = formData.password_nuevo && formData.password_nuevo === formData.password_confirmacion;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Lock className="w-8 h-8 text-yellow-600" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-center mb-2">Cambio de Contraseña Obligatorio</h2>
                <p className="text-gray-600 text-center mb-6">
                    Por seguridad, debes cambiar tu contraseña antes de continuar.
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-medium mb-2">Tu contraseña debe contener:</p>
                            <ul className="space-y-1">
                                <li className={`flex items-center gap-2 ${!passwordErrors.length ? 'text-green-600' : ''}`}>
                                    <span className={`w-1 h-1 rounded-full ${!passwordErrors.length ? 'bg-green-600' : 'bg-blue-600'}`}></span>
                                    Mínimo 8 caracteres
                                </li>
                                <li className={`flex items-center gap-2 ${!passwordErrors.uppercase ? 'text-green-600' : ''}`}>
                                    <span className={`w-1 h-1 rounded-full ${!passwordErrors.uppercase ? 'bg-green-600' : 'bg-blue-600'}`}></span>
                                    Al menos una letra mayúscula
                                </li>
                                <li className={`flex items-center gap-2 ${!passwordErrors.lowercase ? 'text-green-600' : ''}`}>
                                    <span className={`w-1 h-1 rounded-full ${!passwordErrors.lowercase ? 'bg-green-600' : 'bg-blue-600'}`}></span>
                                    Al menos una letra minúscula
                                </li>
                                <li className={`flex items-center gap-2 ${!passwordErrors.number ? 'text-green-600' : ''}`}>
                                    <span className={`w-1 h-1 rounded-full ${!passwordErrors.number ? 'bg-green-600' : 'bg-blue-600'}`}></span>
                                    Al menos un número
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Nueva Contraseña</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={formData.password_nuevo}
                                onChange={(e) => setFormData({ ...formData, password_nuevo: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg pr-10"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Confirmar Contraseña</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={formData.password_confirmacion}
                                onChange={(e) => setFormData({ ...formData, password_confirmacion: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg pr-10"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {formData.password_confirmacion && (
                            <p className={`text-sm mt-1 ${passwordMatch ? 'text-green-600' : 'text-red-600'}`}>
                                {passwordMatch ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || Object.keys(passwordErrors).length > 0 || !passwordMatch}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
                    </button>
                </form>

                <p className="text-xs text-gray-500 text-center mt-4">
                    No podrás acceder al sistema hasta que cambies tu contraseña.
                </p>
            </div>
        </div>
    );
};

export default CambioPasswordObligatorio;
