# 📺 CanalCasa

Plataforma de streaming de TV para hogares guatemaltecos. Organiza canales nacionales, conéctalos a tus pantallas y guarda tus favoritos en un solo lugar.

## 🚀 Inicio rápido

### Requisitos previos

- **Node.js** 18.18+ (recomendado 20+)
- **PostgreSQL** 14+ corriendo localmente
- **Archivo M3U** con la lista de canales (ej. `gt.m3u`)

### Instalación (desarrollo local)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Edita .env.local con tu DATABASE_URL

# 3. Crear la base de datos y aplicar el esquema
npm run db:push

# 4. Cargar datos de demostración (canales desde gt.m3u)
npm run db:seed

# 5. Iniciar el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Cuenta de demostración

| Campo     | Valor            |
|-----------|------------------|
| Correo    | familia@demo.gt  |
| Contraseña| familia123       |

---

## ☁️ Despliegue en Vercel

### 1. Base de datos remota

Crea una base de datos PostgreSQL en la nube (gratis):

- **[Neon](https://neon.tech)** - PostgreSQL serverless
- **[Supabase](https://supabase.com)** - PostgreSQL + auth
- **[Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)** - Integrado con Vercel

Copia la URL de conexión (ej. `postgres://user:pass@host:5432/db`).

### 2. Sube el archivo M3U a una URL pública

El archivo `gt.m3u` debe estar accesible por URL. Opciones:

- **GitHub Gist** (recomendado): Sube `gt.m3u` como gist público y copia la URL del archivo raw.
- **Almacenamiento**: S3, Cloudinary, o cualquier hosting estático.

### 3. Configura las variables de entorno en Vercel

En el dashboard de Vercel → **Settings → Environment Variables**:

| Variable       | Valor                                      |
|----------------|--------------------------------------------|
| `DATABASE_URL` | URL de tu PostgreSQL remoto (Neon/Supabase)|
| `M3U_URL`      | URL pública de tu archivo `gt.m3u`         |

### 4. Despliega

```bash
# Opción A: CLI de Vercel
npm i -g vercel
vercel

# Opción B: Conectar repositorio de GitHub
# 1. Sube el proyecto a GitHub
# 2. Importa el repositorio en Vercel
# 3. Vercel detecta Next.js automáticamente
```

### 5. Aplica el esquema y carga los datos

Después del primer despliegue, ejecuta desde tu máquina local:

```bash
# Aplica el esquema a la BD remota
DATABASE_URL="postgres://tu-url-remota" npm run db:push

# Carga los canales desde M3U_URL
DATABASE_URL="postgres://tu-url-remota" M3U_URL="https://tu-url/gt.m3u" npm run db:seed
```

> **Nota**: El seed se ejecuta manualmente para sincronizar la base de datos con `M3U_URL`. Además, la página principal filtra los canales guardados contra la lista M3U actual y usa esa lista como respaldo si la base de datos todavía no tiene canales importados.

---

## 🛠️ Scripts disponibles

| Comando            | Descripción                                        |
|--------------------|----------------------------------------------------|
| `npm run dev`      | Inicia el servidor de desarrollo (Turbo)           |
| `npm run build`    | Compila la aplicación para producción              |
| `npm run start`    | Inicia el servidor de producción                   |
| `npm run lint`     | Ejecuta ESLint                                     |
| `npm run typecheck`| Verifica tipos con TypeScript                      |
| `npm run db:push`  | Aplica el esquema de Drizzle a la base de datos    |
| `npm run db:seed`  | Carga los datos de demostración y canales M3U      |

---

## 🏗️ Arquitectura del proyecto

```
Canal/
├── drizzle/                  # Migraciones SQL generadas por Drizzle
├── src/
│   ├── app/
│   │   ├── api/              # Rutas API (Route Handlers)
│   │   │   ├── auth/         # login, register, logout
│   │   │   ├── channels/     # CRUD de canales
│   │   │   ├── devices/      # CRUD de dispositivos
│   │   │   └── health/       # Health check de la BD
│   │   ├── globals.css       # Estilos globales y utilidades
│   │   ├── layout.tsx        # Layout raíz con metadata
│   │   └── page.tsx          # Página principal (SSR)
│   ├── components/
│   │   ├── dashboard.tsx     # Dashboard principal con reproductor
│   │   └── login-screen.tsx  # Pantalla de autenticación
│   ├── db/
│   │   ├── index.ts          # Conexión a PostgreSQL (Pool)
│   │   ├── schema.ts         # Esquema de tablas (Drizzle ORM)
│   │   └── seed.ts           # Datos demo + importación M3U
│   └── lib/
│       └── auth.ts           # Autenticación (sesiones, hash, cookies)
├── drizzle.config.json       # Configuración de Drizzle Kit
├── next.config.ts            # Configuración de Next.js
├── package.json
└── tsconfig.json
```

---

## 🗄️ Esquema de base de datos

### Tablas

| Tabla       | Descripción                                    |
|-------------|------------------------------------------------|
| `households`| Hogares/familias que usan la plataforma        |
| `users`     | Usuarios pertenecientes a un hogar             |
| `sessions`  | Sesiones de autenticación (cookie httpOnly)    |
| `channels`  | Canales de TV con metadatos y URL de streaming |
| `devices`   | Dispositivos conectados (Smart TVs, etc.)      |

### Relaciones

```
households 1───N users
households 1───N channels
households 1───N devices
users      1───N sessions
```

### Campos clave de `channels`

| Campo           | Tipo      | Descripción                          |
|-----------------|-----------|--------------------------------------|
| `name`          | text      | Nombre del canal                     |
| `number`        | text      | Número de canal (para zapping)       |
| `category`      | text      | Categoría (Nacional, Deportes, etc.) |
| `streamUrl`     | text      | URL del stream (HLS, MPEG-TS, etc.)  |
| `isFavorite`    | boolean   | Marcado como favorito                |
| `isLive`        | boolean   | Indica si está en vivo               |
| `currentProgram`| text      | Programa actual                      |
| `nextProgram`   | text      | Siguiente programa                   |
| `progress`      | integer   | Progreso del programa actual (0-100) |

---

## 📡 API

### Autenticación

| Método | Endpoint              | Descripción                    |
|--------|-----------------------|--------------------------------|
| POST   | `/api/auth/login`     | Inicia sesión                  |
| POST   | `/api/auth/register`  | Crea cuenta + hogar            |
| POST   | `/api/auth/logout`    | Cierra sesión                  |

### Canales

| Método | Endpoint              | Descripción                    |
|--------|-----------------------|--------------------------------|
| GET    | `/api/channels`       | Lista canales del hogar        |
| POST   | `/api/channels`       | Crea un canal                  |
| PATCH  | `/api/channels/[id]`  | Actualiza un canal             |
| DELETE | `/api/channels/[id]`  | Elimina un canal               |

### Dispositivos

| Método | Endpoint              | Descripción                    |
|--------|-----------------------|--------------------------------|
| GET    | `/api/devices`        | Lista dispositivos del hogar   |
| POST   | `/api/devices`        | Registra un dispositivo        |
| PATCH  | `/api/devices/[id]`   | Actualiza un dispositivo       |
| DELETE | `/api/devices/[id]`   | Elimina un dispositivo         |

### Salud

| Método | Endpoint              | Descripción                    |
|--------|-----------------------|--------------------------------|
| GET    | `/api/health`         | Verifica conexión a la BD      |

---

## 📺 Optimización para TV

CanalCasa está diseñada para funcionar en Smart TVs y pantallas grandes:

### Navegación con control remoto

| Tecla          | Acción                          |
|----------------|---------------------------------|
| `↑` / `↓`      | Cambiar canal en la lista       |
| `0-9`          | Ir directamente a un canal      |
| `Espacio` / `K`| Play / Pausa                    |
| `M`            | Silenciar / Activar sonido      |
| `F`            | Pantalla completa               |
| `?`            | Mostrar atajos de teclado       |
| `Esc`          | Cerrar paneles                  |

### Buenas prácticas para TV

1. **Foco visible**: Todos los elementos interactivos tienen `focus-visible` con anillo verde.
2. **Controles del reproductor**: Se auto-ocultan después de 4 segundos para no distraer.
3. **Tipografía grande**: En pantallas ≥1280px el texto base aumenta a 16px.
4. **Scroll suave**: El canal seleccionado siempre se mantiene visible con `scrollIntoView`.
5. **Reduced motion**: Respeta `prefers-reduced-motion` para usuarios sensibles.
6. **Contraste**: Fondo oscuro (`zinc-950`) con texto claro para mejor legibilidad en TV.

---

## 🎨 Guía de estilos

### Paleta de colores

| Color        | Uso                          |
|--------------|------------------------------|
| `#168766`    | Verde primario (acciones)    |
| `#34d399`    | Verde claro (foco, acentos)  |
| `#18181b`    | Fondo oscuro (zinc-950)      |
| `#f4f7f6`    | Fondo claro (login)          |
| `#f59e0b`    | Ámbar (favoritos)            |

### Tipografía

- **Fuente**: `ui-sans-serif, system-ui, -apple-system, ...`
- **Títulos**: `font-black` / `font-bold` con `tracking-tight`
- **Cuerpo**: `text-sm` / `text-base` con `text-zinc-400`

### Componentes

- **Botones**: `btn-primary`, `btn-secondary`, `btn-light`, `player-action`
- **Tarjetas**: `.panel`, `.channel-grid`, `.card-icon`
- **Inputs**: `.input`, `.form-label`
- **Scroll**: `.scrollbar-none`, `.custom-scrollbar`

---

## 🔐 Seguridad

- **Contraseñas**: Hash con `scrypt` + salt aleatorio (16 bytes).
- **Sesiones**: Cookie `httpOnly` + `sameSite=lax` + `secure` en producción.
- **Tokens**: Hash SHA-256 antes de almacenar en BD.
- **Autorización**: Cada consulta verifica que el recurso pertenezca al `householdId` del usuario.
- **Validación**: Entrada validada en las rutas API (nombre, email, contraseña mínima).

---

## 🧑‍💻 Guía de programación

### Cómo agregar un nuevo campo a `channels`

1. **Edita el schema** en `src/db/schema.ts`:

```ts
// Ejemplo: agregar campo "language"
language: text("language").default("es"),
```

2. **Aplica la migración**:

```bash
npm run db:push
```

3. **Actualiza la interfaz** en `src/components/dashboard.tsx`:

```ts
interface Channel {
  // ...
  language: string;
}
```

4. **Actualiza el mapeo** en `src/app/page.tsx`:

```ts
language: row.language ?? "es",
```

### Cómo agregar una nueva ruta API

1. Crea la carpeta en `src/app/api/`:

```
src/app/api/mi-recurso/route.ts
```

2. Implementa el handler:

```ts
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  // ... lógica
  return Response.json({ ok: true });
}
```

### Cómo agregar un nuevo atajo de teclado

En `src/components/dashboard.tsx`, dentro del `useEffect` de `handleKeyDown`:

```ts
if (e.key === "r" || e.key === "R") {
  // Acción para la tecla R
  return;
}
```

### Cómo importar un nuevo archivo M3U

```bash
# Edita la ruta en src/db/seed.ts y ejecuta:
npm run db:seed
```

---

## 🧪 Verificación

```bash
# Verificar tipos
npm run typecheck

# Verificar lint
npm run lint

# Compilar para producción
npm run build
```

---

## 📄 Licencia

Uso privado. Hecho para hogares guatemaltecos · Usa únicamente fuentes autorizadas.