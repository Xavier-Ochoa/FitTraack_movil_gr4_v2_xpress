import express from 'express'
import cors from 'cors'

import authRoutes from './routes/auth_routes.js'
import userRoutes from './routes/user_routes.js'
import activityRoutes from './routes/activity_routes.js'
import weatherRoutes from './routes/weather_routes.js'
import statsRoutes from './routes/stats_routes.js'
import quotesRoutes from './routes/quotes_routes.js'
import nutritionRoutes from './routes/nutrition_routes.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'

const app = express()

// ── Body parsers ─────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── CORS — acepta requests de Flutter (móvil) ───────────────────────────
app.use(
    cors({
        origin: '*', // Flutter mobile no tiene origen fijo; ajustar en prod si se quiere restringir
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
    })
)

// ── Health check (B0) ───────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' })
})

app.get('/', (req, res) => {
    res.json({ msg: 'API FitTrack Pro' })
})

// ── Rutas ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/activities', activityRoutes)
app.use('/api/weather', weatherRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/quotes', quotesRoutes)
app.use('/api/nutrition', nutritionRoutes)

// ── 404 y error global ───────────────────────────────────────────────────
app.use(notFoundHandler)
app.use(errorHandler)

export default app
