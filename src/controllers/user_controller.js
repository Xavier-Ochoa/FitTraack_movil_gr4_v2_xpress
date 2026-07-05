import User from '../models/User.js'

// Quita campos sensibles antes de responder al cliente
const toPublicUser = (userDoc) => {
    const user = userDoc.toObject ? userDoc.toObject() : userDoc
    delete user.passwordHash
    delete user.resetPasswordTokenHash
    delete user.resetPasswordExpires
    delete user.__v
    return user
}

// Campos que PATCH /api/users/me tiene permitido modificar.
// Todo lo demás (email, passwordHash, tokens de reset) queda fuera
// a propósito: cambiar el email o la contraseña van por otros flujos.
const CAMPOS_EDITABLES = ['name', 'photoUrl', 'age', 'weightKg', 'heightCm', 'gender', 'activityLevel']

const GENEROS_VALIDOS = ['male', 'female', 'other']
const NIVELES_ACTIVIDAD_VALIDOS = ['sedentary', 'light', 'moderate', 'active', 'very_active']

// ── GET /api/users/me ────────────────────────────────────────────────────
export const getMe = async (req, res, next) => {
    try {
        const usuario = await User.findById(req.userId)

        if (!usuario) {
            return res.status(404).json({ msg: 'Usuario no encontrado' })
        }

        res.status(200).json({ user: toPublicUser(usuario) })
    } catch (error) {
        next(error)
    }
}

// ── PATCH /api/users/me ──────────────────────────────────────────────────
export const updateMe = async (req, res, next) => {
    try {
        const updates = {}

        // Solo se toman los campos permitidos que realmente vinieron en el body,
        // así los campos no enviados no se tocan (actualización parcial real).
        for (const campo of CAMPOS_EDITABLES) {
            if (req.body[campo] !== undefined) {
                updates[campo] = req.body[campo]
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ msg: 'No se envió ningún campo válido para actualizar' })
        }

        // Validaciones explícitas de enums (además de las del schema) para
        // devolver un mensaje claro y controlado en vez de un error genérico.
        if (updates.gender !== undefined && !GENEROS_VALIDOS.includes(updates.gender)) {
            return res.status(400).json({
                msg: `Género inválido. Valores permitidos: ${GENEROS_VALIDOS.join(', ')}`,
            })
        }

        if (
            updates.activityLevel !== undefined &&
            !NIVELES_ACTIVIDAD_VALIDOS.includes(updates.activityLevel)
        ) {
            return res.status(400).json({
                msg: `Nivel de actividad inválido. Valores permitidos: ${NIVELES_ACTIVIDAD_VALIDOS.join(', ')}`,
            })
        }

        for (const campoNumerico of ['age', 'weightKg', 'heightCm']) {
            if (updates[campoNumerico] !== undefined && typeof updates[campoNumerico] !== 'number') {
                return res.status(400).json({ msg: `El campo "${campoNumerico}" debe ser numérico` })
            }
        }

        const usuario = await User.findByIdAndUpdate(
            req.userId,
            { $set: updates },
            { new: true, runValidators: true, context: 'query' }
        )

        if (!usuario) {
            return res.status(404).json({ msg: 'Usuario no encontrado' })
        }

        res.status(200).json({ user: toPublicUser(usuario) })
    } catch (error) {
        next(error)
    }
}
