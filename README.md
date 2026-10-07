# Stream App — Mobile

Cliente móvil de una aplicación de streaming personal (películas y series) construida con Expo. Consume un backend NestJS (repositorio hermano en `../backend`) que indexa contenido en Cloudflare R2 y sirve URLs presignadas para reproducción y descarga.

**Funcionalidades principales**

- Biblioteca con búsqueda, filtros (todo / películas / series) y paginación.
- Detalle de película y de serie (temporadas/episodios).
- Reproducción de vídeo con `expo-video`: URLs presignadas, subtítulos SRT en overlay y retomar donde se dejó.
- Descargas offline con pausa/reanudación, expiración a 7 días y reproducción desde archivo local.
- Sincronización de progreso de visionado con cola offline (last-write-wins) y reenvío al reconectar.
- Autenticación JWT (login/registro), sesión persistida y borrado de cuenta.
- Tema claro/oscuro, sync de biblioteca (escaneo de R2) y purge de descargas desde Ajustes.

---

## Stack técnico

| Capa | Tecnología |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19.2 |
| Lenguaje | TypeScript ~6 (`strict`) |
| Routing | Expo Router ~57 (rutas por archivo, `typedRoutes` habilitado) |
| Estado | Zustand 5 |
| HTTP | Axios (instancia única con interceptores) |
| Formularios | react-hook-form |
| Vídeo | `expo-video` (`useVideoPlayer` / `VideoView`) |
| Almacenamiento | `expo-secure-store` (nativo) + `@react-native-async-storage/async-storage` (web/pausas) |
| Ficheros/descargas | `expo-file-system` (`DownloadTask`, `File`, `Directory`) |
| Red | `@react-native-community/netinfo` |
| Imágenes | `expo-image` |
| Tests | Jest + `jest-expo` + `@testing-library/react-native` |
| Lint | ESLint 9 con `eslint-config-expo` |
| React Compiler | Habilitado en `app.json` (`experiments.reactCompiler`) |

---

## Requisitos previos

- Node.js 20+ y npm (o bun).
- Backend NestJS corriendo en `http://localhost:3000` (ver `../backend`).
- Expo Go en dispositivo o emulador/ simulador para desarrollo.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
npx expo start
```

Desde la terminal de Expo puedes abrir la app en Expo Go, emulador Android/iOS o en web.

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | URL base de la API. Opcional: si no se define, `src/shared/constants/config.ts` la resuelve automáticamente (web → `localhost:3000`, Android emulador → `10.0.2.2:3000`, dispositivo físico → host del bundler Metro). |

### Comandos

```bash
npm start           # expo start
npm run android     # expo run:android (development build)
npm run ios         # expo run:ios
npm run web         # expo start --web
npm run lint        # expo lint
npm test            # jest
npx tsc --noEmit    # typecheck
npx expo-doctor     # diagnóstico de dependencias/config
```

---

## Estructura del proyecto

```
src/
├── app/                     # Rutas (Expo Router) — cada archivo es una pantalla
│   ├── _layout.tsx          # Raíz: theme provider, hidratación de sesión, splash
│   ├── (tabs)/              # Navegación por pestañas (requiere sesión)
│   │   ├── _layout.tsx      # Tabs + gate de autenticación + badge de descargas
│   │   ├── index.tsx        # → LibraryScreen
│   │   ├── downloads.tsx    # → DownloadsScreen
│   │   └── settings.tsx     # → SettingsScreen
│   ├── auth/
│   │   ├── login.tsx        # → LoginScreen
│   │   └── register.tsx     # → RegisterScreen
│   ├── item/[id].tsx        # → ItemDetailScreen (detalle de película)
│   ├── series/[id].tsx      # → SeriesDetailScreen (temporadas/episodios)
│   └── player/[id].tsx      # → PlayerScreen (landscape, sin header)
├── features/                # Lógica de UI por dominio (componentes de pantalla)
│   ├── auth/  library/  series/  player/  downloads/  settings/
│   └── __tests__/           # Tests de pantallas con Testing Library
└── shared/                  # Código reutilizable
    ├── components/          # themed-text, themed-view, state-views (loading/error/empty),
    │                        # progress-bar, icon-button, password-input
    ├── constants/           # config.ts (URL de API), theme.ts (colores, fuentes, spacing)
    ├── hooks/               # use-theme, use-color-scheme(.web)
    ├── services/            # api.ts + clientes REST + download-manager + tokenStorage
    ├── store/               # auth.ts, progress-queue.ts (Zustand)
    └── utils/               # api-error, srt (parser de subtítulos), time, rn-form
```

**Convenciones**

- Alias de importación `@/*` → `src/*` y `@/assets/*` → `assets/*` (definido en `tsconfig.json`).
- Las rutas en `src/app/` son delgadas: leen `useLocalSearchParams` y delegan en el componente de `src/features/`.
- Los estilos usan `StyleSheet.create` con la escala `Spacing` (múltiplos de 4 px) y `MaxContentWidth` de `theme.ts`.
- `ios/` y `android/` son generados (CNG); en este repo existe `android/` por un prebuild local. No editarlos a mano: la configuración nativa vive en `app.json` (plugins: `expo-router`, `expo-splash-screen`, `expo-video`, `expo-secure-store`, `expo-image`).

---

## Rutas y navegación

| Ruta | Pantalla | Notas |
| --- | --- | --- |
| `/` (tabs) | Biblioteca | Redirect a `/auth/login` si no hay token |
| `/downloads` | Descargas | Badge con número de descargas activas |
| `/settings` | Ajustes | Perfil, sync de biblioteca, purge, logout, borrado de cuenta |
| `/auth/login` | Iniciar sesión | |
| `/auth/register` | Registro | |
| `/item/[id]` | Detalle de película | Play con `startAt` si hay progreso |
| `/series/[id]` | Detalle de serie | Episodios con progreso y descarga |
| `/player/[id]` | Reproductor | Sin header, orientación landscape |

Parámetros del reproductor: `id`, `r2Key`, `subtitleKey`, `title`, `itemType` (`movie` | `episode`), `startAt` (segundos). Si no llega `r2Key`, el player lo resuelve contra `/library/:id`.

---

## Autenticación y sesión

1. `authApi.ts` llama a `POST /auth/login` y `POST /auth/register` y devuelve el JWT (`access_token`).
2. El token se guarda con `tokenStorage.ts`: `expo-secure-store` en nativo (Keystore) y `AsyncStorage` en web.
3. `useAuthStore` (Zustand) gestiona `token` y `hydrated`; `hydrate()` se ejecuta en el layout raíz y la splash screen se oculta cuando termina.
4. El interceptor de request de `api.ts` añade `Authorization: Bearer <token>`; el interceptor de response limpia el token y notifica al store en `401`, lo que dispara el redirect a login.
5. El layout `(tabs)` hace `Redirect href="/auth/login"` si no hay token tras hidratar.

---

## Capa de API

`src/shared/services/api.ts` exporta una instancia Axios (`baseURL` resuelta, timeout 15 s) con los interceptores de auth descritos arriba. Los clientes por dominio:

| Módulo | Endpoints |
| --- | --- |
| `authApi.ts` | `POST /auth/login`, `POST /auth/register`, `DELETE /users/me` |
| `libraryApi.ts` | `GET /library` (paginación/filtro/búsqueda con `AbortSignal`), `GET /library/:id`, `GET /series/:id`, `POST /media/presign`, `GET /media/subtitle` |
| `progressApi.ts` | `GET /progress`, `POST /progress` (lote de updates) |
| `downloadsApi.ts` | `GET /downloads`, `POST /downloads/start`, `PATCH /downloads/:id/progress`, `PATCH /downloads/:id/complete`, `DELETE /downloads/:id` |
| `SettingsScreen` | `GET /users/me`, `POST /library/scan` + polling `GET /library/status` |

Los mensajes de error se normalizan con `getApiErrorMessage(e, fallback)` (`utils/api-error.ts`): prioriza `message` del cuerpo del servidor, luego mapea códigos HTTP (400/401/409/429/500) y distingue timeout vs. fallo de conexión.

---

## Reproducción (`features/player/PlayerScreen.tsx`)

- **Fuente**: si hay descarga local vigente (`findLocalPlaybackFile`), se reproduce el fichero de `Paths.document/downloads`; si no, `POST /media/presign` devuelve una URL temporal (`PRESIGN_TTL_SECONDS = 600`).
- **Subtítulos**: `GET /media/subtitle` → descarga bytes → `decodeSubtitleBytes` (UTF-8 estricto con fallback Windows-1252 y soporte de BOM) → `parseSrt` → overlay renderizado con `findCueAt` (búsqueda binaria). El botón CC alterna los subtítulos.
- **Progreso**: evento `timeUpdate` cada 0.5 s; se encola un reporte como máximo cada 10 s, al pausar, al terminar (100 %) y al desmontar. Los updates van a `useProgressQueueStore`.
- **UI**: chrome superior auto-oculto a los 4 s (visible en fullscreen no), estados de carga/error con reintento, controles nativos de `VideoView`.

## Cola de progreso offline (`store/progress-queue.ts`)

- `enqueue` deduplica por `itemType:refId` aplicando last-write-wins (`lastUpdated`).
- `flush` envía el lote a `POST /progress`; en error se conserva la cola.
- El layout raíz hace `flush()` al montar y al detectar conexión con `NetInfo`.

## Descargas (`services/download-manager.ts`)

- Store Zustand `useDownloadsStore` con `records` (espejo del servidor), `activeIds` y `pausedIds`.
- Flujo: `POST /downloads/start` → `File.createDownloadTask` hacia `downloads/<downloadId>.mp4` → progreso local y reporte al servidor como máximo cada 2 s → `PATCH /complete` al finalizar.
- **Pausa/reanuda**: `task.pause()` / `task.resumeAsync()`; el estado reanudable (`task.savable()`) se persiste en AsyncStorage (`download.pauseState.<id>`) para poder continuar tras reiniciar la app; si no hay estado, se reinicia la descarga desde cero.
- **Expiración**: los registros vencen a los 7 días (`DOWNLOAD_EXPIRY_DAYS`); `purgeExpired()` borra ficheros locales y registros (automático en `init()` y manual desde Ajustes).
- `remove()` cancela la tarea, borra el fichero y notifica al servidor.
- El badge de la pestaña Descargas refleja `activeIds.length`.

---

## Tema y estilos

- `Colors` claro/oscuro en `shared/constants/theme.ts`; `useTheme()` resuelve el esquema activo (`unspecified` → light).
- Fuentes por plataforma en `Fonts` (web usa variables CSS definidas en `src/global.css`, importado desde `theme.ts`).
- Componentes atemáticos: `ThemedText` (variantes por tipo y color de tema) y `ThemedView`.
- Estados reutilizables en `state-views.tsx`: `LoadingState`, `ErrorState` (con botón Reintentar) y `EmptyState`, en variantes `inline` | `fill`.

---

## Tests

- Preset `jest-expo`, setup en `jest.setup.ts` (mock de `react-native-safe-area-context` y de `AsyncStorage` con un `Map`), estilos resueltos con `jest.style-mock.js`.
- Suites existentes:

```
src/features/*/__tests__/          LibraryScreen, SeriesDetailScreen, PlayerScreen,
                                   DownloadsScreen, SettingsScreen
src/shared/services/__tests__/     download-manager
src/shared/utils/__tests__/        rn-form
```

```bash
npm test
```

---

## Build y distribución

- Los directorios nativos se generan con Continuous Native Generation; la configuración nativa vive en `app.json`.
- Para desarrollo con módulos nativos fuera de Expo Go: `npx expo run:android|ios` o un development build con EAS (`bunx eas-cli build --profile development`).
- Updates OTA: `bunx eas-cli update` (docs: https://docs.expo.dev/eas/index.md).

## Documentación relacionada

- Backend NestJS: `../backend`
- Plan y decisiones técnicas: `../docs/` (`ARQUITECTURA_PLAN.md`, `DECISIONES_TECNICAS.md`, `DIAGRAMA_FLUJO.md`, `PLAN_UI_UX.md`, `SDD.md`)

## Licencia

MIT (ver [LICENSE](./LICENSE)).
