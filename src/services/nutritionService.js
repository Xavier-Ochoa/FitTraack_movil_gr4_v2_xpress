import { fetchConTimeout } from '../utils/fetchConTimeout.js'

/**
 * Envía un texto en lenguaje natural (ej. "2 huevos y una tostada") a
 * Nutritionix (Natural Language for Nutrients) y devuelve los macros
 * totales sumando todos los alimentos que Nutritionix identificó en el
 * texto.
 *
 * @param {string} queryText
 * @returns {Promise<{ calories:number, proteinG:number, carbsG:number, fatG:number, foods: object[] }>}
 * @throws si las credenciales no están configuradas o la petición falla
 */
export const analizarTextoNutricional = async (queryText) => {
    const appId = process.env.NUTRITIONIX_APP_ID
    const appKey = process.env.NUTRITIONIX_APP_KEY

    if (!appId || !appKey) {
        throw new Error('NUTRITIONIX_APP_ID/NUTRITIONIX_APP_KEY no están configuradas en el .env')
    }

    const response = await fetchConTimeout(
        'https://trackapi.nutritionix.com/v2/natural/nutrients',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-app-id': appId,
                'x-app-key': appKey,
            },
            body: JSON.stringify({ query: queryText }),
        },
        8000
    )

    if (!response.ok) {
        const detalle = await response.text().catch(() => '')
        throw new Error(`Nutritionix respondió con status ${response.status}: ${detalle}`)
    }

    const data = await response.json()
    const alimentos = data.foods || []

    if (alimentos.length === 0) {
        throw new Error('Nutritionix no pudo identificar ningún alimento en el texto enviado')
    }

    // Se suman los macros de TODOS los alimentos detectados en el texto
    // (ej. "2 huevos y una tostada" → 2 entradas en `foods`).
    const totales = alimentos.reduce(
        (acumulado, alimento) => ({
            calories: acumulado.calories + (alimento.nf_calories || 0),
            proteinG: acumulado.proteinG + (alimento.nf_protein || 0),
            carbsG: acumulado.carbsG + (alimento.nf_total_carbohydrate || 0),
            fatG: acumulado.fatG + (alimento.nf_total_fat || 0),
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    )

    return {
        calories: Math.round(totales.calories),
        proteinG: Number(totales.proteinG.toFixed(1)),
        carbsG: Number(totales.carbsG.toFixed(1)),
        fatG: Number(totales.fatG.toFixed(1)),
        foods: alimentos.map((a) => ({
            name: a.food_name,
            calories: Math.round(a.nf_calories || 0),
        })),
    }
}
