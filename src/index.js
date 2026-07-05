import dotenv from 'dotenv'
dotenv.config()

import { conectarDB } from './config/database.js'
import app from './server.js'

const PORT = process.env.PORT || 4000

conectarDB()

app.listen(PORT, () => {
    console.log(`✅ Servidor FitTrack Pro corriendo en el puerto ${PORT}`)
})
