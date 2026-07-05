import crypto from 'crypto'

import User from '../models/User.js'
import { hashPassword, comparePassword } from '../utils/password.js'
import { generarJWT } from '../utils/jwt.js'
import { RESET_TOKEN_EXPIRES_MINUTES } from '../config/constants.js'
import { sendMailRecuperarPassword, sendMailPasswordCambiada } from '../services/emailService.js'

// Quita campos sensibles antes de responder al cliente
const toPublicUser = (userDoc) => {
    const user = userDoc.toObject ? userDoc.toObject() : userDoc
    delete user.passwordHash
    delete user.resetPasswordTokenHash
    delete user.resetPasswordExpires
    delete user.__v
    return user
}

// ── POST /api/auth/register ────────────────────────────────────────────────
export const register = async (req, res, next) => {
    try {
        const { email, password, name } = req.body

        if (!email || !password || !name) {
            return res.status(400).json({ msg: 'Debes proporcionar email, password y name' })
        }

        if (password.length < 6) {
            return res.status(400).json({ msg: 'La contraseña debe tener al menos 6 caracteres' })
        }

        const emailNormalizado = email.toLowerCase().trim()

        const existente = await User.findOne({ email: emailNormalizado })
        if (existente) {
            return res.status(409).json({ msg: 'Ya existe una cuenta registrada con ese email' })
        }

        const passwordHash = await hashPassword(password)

        const nuevoUsuario = await User.create({
            email: emailNormalizado,
            passwordHash,
            name: name.trim(),
        })

        const token = generarJWT(nuevoUsuario._id)

        res.status(201).json({
            token,
            user: toPublicUser(nuevoUsuario),
        })
    } catch (error) {
        next(error)
    }
}

// ── POST /api/auth/login ────────────────────────────────────────────────────
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ msg: 'Debes proporcionar email y password' })
        }

        const emailNormalizado = email.toLowerCase().trim()

        const usuario = await User.findOne({ email: emailNormalizado }).select('+passwordHash')

        // Mensaje genérico: no revelar si el email existe o no
        if (!usuario) {
            return res.status(401).json({ msg: 'Email o contraseña incorrectos' })
        }

        const passwordValido = await comparePassword(password, usuario.passwordHash)
        if (!passwordValido) {
            return res.status(401).json({ msg: 'Email o contraseña incorrectos' })
        }

        const token = generarJWT(usuario._id)

        res.status(200).json({
            token,
            user: toPublicUser(usuario),
        })
    } catch (error) {
        next(error)
    }
}

// ── POST /api/auth/forgot-password ─────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body

        if (!email) {
            return res.status(400).json({ msg: 'Debes proporcionar un email' })
        }

        const emailNormalizado = email.toLowerCase().trim()
        const usuario = await User.findOne({ email: emailNormalizado })

        // Mensaje genérico SIEMPRE, exista o no el email, para no filtrar
        // qué correos están registrados.
        const respuestaGenerica = {
            msg: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña.',
        }

        if (!usuario) {
            return res.status(200).json(respuestaGenerica)
        }

        // Token plano (se envía por email) — solo el HASH se guarda en Mongo
        const resetToken = crypto.randomBytes(32).toString('hex')
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')

        usuario.resetPasswordTokenHash = resetTokenHash
        usuario.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000)
        await usuario.save()

        await sendMailRecuperarPassword(usuario.email, resetToken)

        res.status(200).json(respuestaGenerica)
    } catch (error) {
        next(error)
    }
}

// ── POST /api/auth/reset-password ──────────────────────────────────────────
export const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body

        if (!token || !newPassword) {
            return res.status(400).json({ msg: 'Debes proporcionar token y newPassword' })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ msg: 'La contraseña debe tener al menos 6 caracteres' })
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

        const usuario = await User.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordExpires: { $gt: new Date() },
        }).select('+resetPasswordTokenHash +resetPasswordExpires')

        if (!usuario) {
            return res.status(400).json({ msg: 'El token es inválido o ha expirado' })
        }

        usuario.passwordHash = await hashPassword(newPassword)
        usuario.resetPasswordTokenHash = null
        usuario.resetPasswordExpires = null
        await usuario.save()

        // No bloquea la respuesta si el correo de notificación falla
        try {
            await sendMailPasswordCambiada(usuario.email, usuario.name)
        } catch (e) {
            console.error('⚠️ No se pudo enviar el correo de notificación:', e.message)
        }

        res.status(200).json({ msg: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' })
    } catch (error) {
        next(error)
    }
}

// ── GET /api/auth/me (endpoint de prueba para requireAuth, B2) ─────────────
export const me = async (req, res, next) => {
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
