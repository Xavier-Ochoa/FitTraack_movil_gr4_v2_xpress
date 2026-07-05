import { fetchConTimeout } from '../utils/fetchConTimeout.js'

// ── Nutrición (Sprint B7) — Edamam Nutrition Analysis API ──────────────
// Reemplaza a Nutritionix: Nutritionix eliminó por completo su capa
// gratuita para estudiantes/hobbyistas (solo ofrece planes comerciales
// desde USD 1,850/mes). Edamam sí mantiene un plan gratuito (400
// requests/mes, 20/min) para su Nutrition Analysis API, con el mismo
// enfoque de lenguaje natural.
//
// Documentación: https://developer.edamam.com/edamam-docs-nutrition-api
// Cuenta gratuita: https://developer.edamam.com (Nutrition Analysis API)

const ENDPOINT = 'https://api.edamam.com/api/nutrition-details'

/**
 * Edamam analiza mejor un ingrediente por línea que una frase con varios
 * alimentos juntos (ej. "2 huevos y una tostada"). Partimos el texto en
 * líneas heurísticamente por conectores comunes en español/inglés y
 * signos de puntuación, para darle a la API la mejor oportunidad de
 * reconocer cada alimento por separado.
 */
const dividirEnLineasDeIngredientes = (queryText) => {
    const lineas = queryText
        .split(/,| y | con | and |\+|\n/gi)
        .map((linea) => linea.trim())
        .filter(Boolean)

    return lineas.length > 0 ? lineas : [queryText.trim()]
}

/**
 * Envía un texto en lenguaje natural (ej. "2 huevos y una tostada") a
 * Edamam (Nutrition Analysis API — `/api/nutrition-details`) y devuelve
 * los macros totales de todos los alimentos identificados en el texto.
 *
 * @param {string} queryText
 * @returns {Promise<{ calories:number, proteinG:number, carbsG:number, fatG:number, foods: object[] }>}
 * @throws si las credenciales no están configuradas o la petición falla
 */
export const analizarTextoNutricional = async (queryText) => {
    const appId = process.env.EDAMAM_APP_ID
    const appKey = process.env.EDAMAM_APP_KEY

    if (!appId || !appKey) {
        throw new Error('EDAMAM_APP_ID/EDAMAM_APP_KEY no están configuradas en el .env')
    }

    const ingredientes = dividirEnLineasDeIngredientes(queryText)

    const url = `${ENDPOINT}?app_id=${appId}&app_key=${appKey}`

    const response = await fetchConTimeout(
        url,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Registro de comida — FitTrack Pro',
                ingr: ingredientes,
            }),
        },
        8000
    )

    if (response.status === 555) {
        // Edamam no pudo reconocer uno o más alimentos del texto
        throw new Error(
            'No se pudo reconocer alguno de los alimentos del texto. Intenta ser más específico (ej. "2 huevos y una tostada")'
        )
    }

    if (response.status === 401 || response.status === 403) {
        throw new Error('Credenciales de Edamam inválidas (revisa EDAMAM_APP_ID/EDAMAM_APP_KEY)')
    }

    if (response.status === 402 || response.status === 429) {
        throw new Error('Se alcanzó el límite gratuito de Edamam (400 requests/mes o 20/min)')
    }

    if (!response.ok) {
        const detalle = await response.text().catch(() => '')
        throw new Error(`Edamam respondió con status ${response.status}: ${detalle}`)
    }

    const data = await response.json()
    const nutrientes = data.totalNutrients || {}

    return {
        calories: Math.round(data.calories || 0),
        proteinG: Number((nutrientes.PROCNT?.quantity || 0).toFixed(1)),
        carbsG: Number((nutrientes.CHOCDF?.quantity || 0).toFixed(1)),
        fatG: Number((nutrientes.FAT?.quantity || 0).toFixed(1)),
        // Edamam no desglosa calorías por línea en este endpoint, así que
        // reportamos las líneas de ingrediente interpretadas (útil para
        // que el cliente confirme qué entendió la API del texto enviado).
        foods: ingredientes.map((linea) => ({ name: linea })),
    }
}
