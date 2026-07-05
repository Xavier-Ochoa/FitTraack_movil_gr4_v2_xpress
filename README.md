# FitTrack Pro — Backend

Backend de FitTrack Pro (Node + Express + MongoDB Atlas + JWT propio).

Este entregable cubre los micro-sprints:
- **B0** — Setup del entorno (`/health`, conexión a Mongo)
- **B1** — Los 6 modelos Mongoose (`User`, `Activity`, `TrackPoint`, `Stats`, `ActivityStats`, `NutritionLog`)
- **B2** — Registro y login con JWT propio + middleware `requireAuth`
- **B3** — Recuperación de contraseña de punta a punta (email con token SHA-256)
- **B4** — Perfil de usuario (`GET`/`PATCH /api/users/me`)
- **B5** — Actividades: crear/listar/detalle/eliminar + track points en batch
- **B6** — Enriquecimiento: clima (OpenWeatherMap), elevación (Open-Elevation) y geocodificación inversa (Nominatim)
- **B7** — Estadísticas agregadas, frase motivacional (con caché) y nutrición (Edamam)

## 1. Instalación

```bash
npm install
cp .env.example .env
```

Completa `.env` con tus credenciales reales:

- `MONGODB_URI`: connection string de tu cluster de MongoDB Atlas.
- `JWT_SECRET`: genera uno con `openssl rand -hex 32`.
- `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS`: credenciales SMTP
  (con Gmail, `EMAIL_USER` es tu correo y `EMAIL_PASS` es un **App Password**,
  no tu contraseña normal).
- `APP_RESET_PASSWORD_URL`: URL donde el frontend mostrará el formulario de
  reset (el email arma el link como `URL?token=...`).
- `OPENWEATHER_API_KEY`: API key gratuita de OpenWeatherMap (para B6/clima).
- `EDAMAM_APP_ID` / `EDAMAM_APP_KEY`: credenciales gratuitas de
  [developer.edamam.com](https://developer.edamam.com) — Nutrition Analysis API
  (para B7/nutrición; Nutritionix ya no ofrece capa gratuita).

## 2. Correr en local

```bash
npm run dev
```

Deberías ver:

```
✅ Conexión a MongoDB Atlas establecida
✅ Servidor FitTrack Pro corriendo en el puerto 4000
```

Prueba rápida:

```bash
curl http://localhost:4000/health
# { "status": "ok" }
```

## 3. Endpoints implementados (B2 + B3)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET  | `/health` | Pública | Verifica que el servidor está arriba |
| POST | `/api/auth/register` | Pública | Crea usuario, devuelve `{ token, user }` |
| POST | `/api/auth/login` | Pública | Verifica credenciales, devuelve `{ token, user }` |
| POST | `/api/auth/forgot-password` | Pública | Genera token de reset y envía email |
| POST | `/api/auth/reset-password` | Pública (token válido) | Actualiza la contraseña con el token recibido |
| GET  | `/api/auth/me` | JWT (`Authorization: Bearer <token>`) | Endpoint protegido de prueba para validar el middleware |
| GET  | `/api/users/me` | JWT | Perfil completo del usuario autenticado |
| PATCH | `/api/users/me` | JWT | Actualiza campos parciales del perfil (`name`, `photoUrl`, `age`, `weightKg`, `heightCm`, `gender`, `activityLevel`) |
| POST | `/api/activities` | JWT | Crea una actividad + sus `trackPoints` en batch, calcula `duration`/`avgPace`/`avgSpeed`/`caloriesBurned` |
| GET | `/api/activities` | JWT | Lista las actividades del usuario (resumen, sin track points), más reciente primero |
| GET | `/api/activities/:id` | JWT | Detalle completo: actividad + track points + activity_stats (si existe) |
| DELETE | `/api/activities/:id` | JWT | Elimina la actividad y en cascada sus track points / activity_stats |
| GET | `/api/weather?lat=..&lng=..` | JWT | Proxy hacia OpenWeatherMap (oculta la API key) |
| GET | `/api/stats/me` | JWT | Estadísticas agregadas: totales, comparación OMS (última semana), balance calórico de hoy, IMC |
| GET | `/api/quotes/random` | JWT | Proxy hacia ZenQuotes con caché en memoria de 30 min |
| POST | `/api/nutrition/log` | JWT | Analiza `queryText` en lenguaje natural con Edamam y guarda el registro |
| GET | `/api/nutrition/logs` | JWT | Historial de comidas del usuario (filtro opcional `?date=YYYY-MM-DD`) |
| DELETE | `/api/nutrition/logs/:id` | JWT | Elimina un registro de nutrición (verifica propiedad) |

## 4. Pruebas manuales sugeridas (Postman / Thunder Client)

### Registro
```
POST /api/auth/register
{
  "email": "ana@example.com",
  "password": "secreta123",
  "name": "Ana Pérez"
}
```
- Repetir con el mismo email → debe responder `409`.

### Login
```
POST /api/auth/login
{ "email": "ana@example.com", "password": "secreta123" }
```
- Con password incorrecta → `401`.

### Endpoint protegido
```
GET /api/auth/me
Authorization: Bearer <token del login>
```
- Sin token o con token inválido → `401`.

### Recuperar contraseña
```
POST /api/auth/forgot-password
{ "email": "ana@example.com" }
```
- Revisa la bandeja de `ana@example.com` (o usa Mailtrap/Ethereal en dev):
  llega un email con un botón/link `?token=...`.
- Con un email que no existe → responde igual (mensaje genérico), sin
  revelar si existe o no.

```
POST /api/auth/reset-password
{ "token": "<token del email>", "newPassword": "nuevaClave456" }
```
- Reusar el mismo token después de usado → falla (ya fue invalidado).
- Loguearse con la nueva contraseña → funciona.

### Perfil de usuario (B4)
```
GET /api/users/me
Authorization: Bearer <token>
```
- Devuelve el perfil completo (sin `passwordHash` ni campos de reset).

```
PATCH /api/users/me
Authorization: Bearer <token>
{ "weightKg": 70, "heightCm": 175 }
```
- Solo actualiza los campos enviados; el resto queda igual (actualización
  parcial real).
- `{ "gender": "invalido" }` → `400` con mensaje claro.
- `{ "weightKg": "ochenta" }` (string en vez de número) → `400`.
- Body vacío `{}` → `400` ("No se envió ningún campo válido para actualizar").
- Intentar mandar `email` o `passwordHash` en el body → se ignoran
  silenciosamente (no son campos editables por este endpoint a propósito).

### Actividades (B5)
```
POST /api/activities
Authorization: Bearer <token>
{
  "type": "running",
  "title": "Trote matutino",
  "startedAt": "2026-07-05T08:00:00Z",
  "endedAt": "2026-07-05T08:30:00Z",
  "distance": 5,
  "trackPoints": [
    { "lat": -0.0378, "lng": -78.3491, "timestamp": "2026-07-05T08:00:00Z" },
    { "lat": -0.0380, "lng": -78.3489, "timestamp": "2026-07-05T08:05:00Z" },
    { "lat": -0.0385, "lng": -78.3480, "timestamp": "2026-07-05T08:10:00Z" }
  ]
}
```
- Responde `201` con `avgPace`, `avgSpeed` y `caloriesBurned` ya calculados
  (usa el `weightKg` del perfil; si no lo tienes configurado, usa un peso
  por defecto de 70kg y marca `caloriesBurnedEstimated: true`).
- Desde B6, también dispara el enriquecimiento: intenta resolver
  `locationName` (Nominatim), completa `activity.weather` si no lo
  mandaste tú mismo en el body, y crea el documento `activityStats`
  (`elevationGain`, `elevationLoss`, `maxSpeed`, `minPace`,
  `samplingFrequency`). Si alguna de estas integraciones externas falla,
  la actividad se guarda igual — solo faltará ese dato puntual.
- Puedes mandar tú mismo el snapshot de clima capturado al iniciar el
  recorrido: agrega `"weather": { ... }` en el body de `POST /api/activities`
  (lo que la app haya recibido de `GET /api/weather` al arrancar). Si no lo
  mandas, el backend intenta resolverlo como respaldo con el primer
  `trackPoint`.
- `type` faltante o inválido, `endedAt <= startedAt`, `distance` negativa, o
  un `trackPoint` sin `lat`/`lng`/`timestamp` → `400` con mensaje claro.

```
GET /api/activities
Authorization: Bearer <token>
```
- Devuelve solo las actividades del usuario autenticado, sin track points,
  ordenadas de la más reciente a la más antigua.

```
GET /api/activities/:id
Authorization: Bearer <token>
```
- Devuelve la actividad + todos sus `trackPoints` + `activityStats` (`null`
  hasta que exista B6).
- Con el `:id` de una actividad de **otro usuario** → `403`.
- Con un `:id` que no existe → `404`.
- Con un `:id` mal formado (no es un ObjectId) → `400`.

```
DELETE /api/activities/:id
Authorization: Bearer <token>
```
- Borra la actividad, sus `trackPoints` y su `activityStats` si existiera.
- Mismas reglas de propiedad que el detalle (`403`/`404`).

### Clima, elevación y geocodificación (B6)

Necesitas `OPENWEATHER_API_KEY` en tu `.env` para el clima; elevación
(Open-Elevation) y geocodificación (Nominatim) no requieren API key.

```
GET /api/weather?lat=-0.037&lng=-78.349
Authorization: Bearer <token>
```
- Responde `200` con un snapshot simplificado del clima (temperatura,
  humedad, viento, condición). La API key nunca aparece en la respuesta.
- Si falta `lat`/`lng` → `400`. Si `OPENWEATHER_API_KEY` no está
  configurada o OpenWeatherMap falla → `502` controlado (no rompe el server).

**Prueba de la actividad enriquecida:** crea una actividad (`POST
/api/activities`) con coordenadas reales de tu ciudad en los
`trackPoints` y revisa la respuesta:
- `activity.locationName` debe traer un barrio/ciudad resuelto por Nominatim.
- `activityStats.elevationGain` / `elevationStats.elevationLoss` deben
  venir calculados (usan Open-Elevation; si esa API no responde, el
  backend usa automáticamente la `altitude` de tus `trackPoints` como
  respaldo — puedes forzar este caso probando sin conexión a internet un
  momento, o mandando puntos con `altitude` y ninguna key de clima).
- `activityStats.maxSpeed` / `minPace` / `samplingFrequency` deben venir
  calculados a partir de tus `trackPoints` (usa el `speed` del GPS si lo
  mandas, o lo estima con la distancia/tiempo entre puntos).
- Repetir la creación de varias actividades seguidas no debe disparar
  errores de rate-limit de Nominatim: las llamadas se encolan
  automáticamente a ~1 por segundo.

## 5. Estadísticas, frase motivacional y nutrición (B7)

```
GET /api/stats/me
Authorization: Bearer <token>
```
- Devuelve `totalDistance`, `totalActivities`, `bestPace` (calculados al
  vuelo con agregación de Mongo sobre `activities`, no se cachean en la
  colección `stats`), `oms` (minutos de la última semana vs 150
  recomendados), `balanceCalorico` (quemadas vs consumidas hoy) e `imc`
  (`null` si no configuraste `weightKg`/`heightCm` en tu perfil).

```
GET /api/quotes/random
Authorization: Bearer <token>
```
- La primera llamada le pega a ZenQuotes. Llamadas siguientes dentro de
  los 30 minutos devuelven la misma frase desde caché (`cached: true`),
  sin volver a golpear la API externa.

```
POST /api/nutrition/log
Authorization: Bearer <token>
{ "queryText": "2 huevos y una tostada" }
```
- Responde `201` con `calories`/`proteinG`/`carbsG`/`fatG` reales de
  Edamam. Requiere `EDAMAM_APP_ID`/`EDAMAM_APP_KEY` en el
  `.env`; si faltan, si Edamam falla, o si se alcanza el límite gratuito
  (400 req/mes, 20/min) → `502` controlado.

```
GET /api/nutrition/logs?date=2026-07-05
Authorization: Bearer <token>
```
- Sin `?date`, devuelve todo el historial del usuario. Con `?date`,
  filtra solo ese día (formato `YYYY-MM-DD`, si no cumple ese formato →
  `400`).

```
DELETE /api/nutrition/logs/:id
Authorization: Bearer <token>
```
- Mismas reglas de propiedad que actividades (`403` de otro usuario,
  `404` si no existe, `400` si el id no es un ObjectId válido).

## 6. Deploy en Render

El código ya está listo para Render sin modificaciones (usa
`process.env.PORT`, tiene `npm start`, y corre como servidor persistente
— necesario porque el caché de frases y la cola de Nominatim viven en
memoria del proceso).

1. Sube este repo a GitHub.
2. En Render: **New → Web Service** → conecta el repo.
3. **Build Command:** `npm install` — **Start Command:** `npm start`.
4. Agrega todas las variables de `.env.example` en la sección
   **Environment** de Render (con tus valores reales).
5. Deploy. Verifica con `GET https://<tu-app>.onrender.com/health`.

## 7. Estructura de carpetas

```
src/
  config/       # conexión a Mongo, nodemailer, constantes
  models/       # 6 esquemas Mongoose (Sprint B1)
  controllers/  # auth (B2+B3), perfil (B4), actividades (B5), clima (B6), stats/quotes/nutrition (B7)
  routes/       # definición de rutas
  middleware/   # requireAuth, manejo de errores
  services/     # email (B3), cálculos de actividad (B5), clima/elevación/geocodificación (B6), stats/quotes/nutrition (B7)
  utils/        # password (bcryptjs), JWT, geo (Haversine), fetch con timeout, rate limiter
server.js
index.js
```

## 8. Siguientes sprints (no incluidos en este entregable)

- **B8**: checkpoint 50% — deploy y documentación final (colección de Postman exportada)

Ver `PLAN_SPRINTS_FitTrack_Pro.md` para el detalle completo de cada uno.
