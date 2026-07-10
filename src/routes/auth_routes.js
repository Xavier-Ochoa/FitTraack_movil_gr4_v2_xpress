import { Router } from 'express'
import {
    register,
    login,
    forgotPassword,
    resetPassword,
    me,
} from '../controllers/auth_controller.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

// ── Rutas públicas ──────────────────────────────────────────────────────────
router.post('/register', register)
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

// ── Ruta protegida de prueba (para validar requireAuth en Postman, B2) ─────
router.get('/me', requireAuth, me)

export default router
