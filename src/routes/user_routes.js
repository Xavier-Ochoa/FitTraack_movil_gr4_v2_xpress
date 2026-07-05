import { Router } from 'express'
import { getMe, updateMe } from '../controllers/user_controller.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

// Ambas rutas protegidas: requieren JWT válido
router.get('/me', requireAuth, getMe)
router.patch('/me', requireAuth, updateMe)

export default router
