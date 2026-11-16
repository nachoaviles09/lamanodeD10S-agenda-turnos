# ⚽ LAMANODED10S — Plataforma Web de Reservas y Control de Acceso

Sistema web integral desarrollado para el complejo deportivo **LAMANODED10S** (Fraternidad y Gobernador Crespo, Paraná, Entre Ríos). Permite gestionar reservas online en tiempo real, evitar superposición de turnos, autogestionar cancelaciones, validar ingresos en recepción con PIN y sincronizar toda la agenda de forma automática en **Google Sheets**.

---

## 📋 Tabla de Contenidos

1. [Arquitectura y Tecnologías](#1-arquitectura-y-tecnologías)
2. [Estructura de Archivos del Proyecto](#2-estructura-de-archivos-del-proyecto)
3. [Módulos del Sistema](#3-módulos-del-sistema)
4. [Configuración Centralizada (`config.js`)](#4-configuración-centralizada-configjs)
5. [Backend y Base de Datos (`Code.gs` + Google Sheets)](#5-backend-y-base-de-datos-codegs--google-sheets)
6. [Despliegue y Publicación (Netlify / GitHub)](#6-despliegue-y-publicación-netlify--github)
7. [Guía de Mantenimiento Futuro](#7-guía-de-mantenimiento-futuro)
8. [Solución de Problemas Frecuentes](#8-solución-de-problemas-frecuentes)
9. [Créditos y Autoría](#9-créditos-y-autoría)

---

## 1. Arquitectura y Tecnologías

El proyecto está construido con una arquitectura **Serverless / Static Web**, sin costos mensuales de servidores ni bases de datos externas:

* **Frontend:** HTML5 semántico, CSS3 moderno (Variables CSS, Grid/Flexbox, Glassmorphism, diseño responsivo *mobile-first* y `color-scheme: dark`) y JavaScript Vanilla (ES6+).
* **Backend / API REST:** **Google Apps Script** expuesto como Web App (`doGet` y `doPost`), con control de concurrencia mediante `LockService` para transacciones atómicas.
* **Base de Datos:** **Google Sheets** con generación automática de pestañas mensuales, validaciones de datos y ordenamiento por prioridad de estado.
* **Hosting y CDN:** **Netlify** conectado a repositorio **GitHub** con certificado SSL/HTTPS automático.

---

## 2. Estructura de Archivos del Proyecto

```text
lamanoded10s/
├── index.html          # Página principal: presentación, reserva online, galería, precios y ubicación
├── cancelar.html       # Portal de autogestión para dar de baja turnos mediante código #LMD-XXXX
├── ingreso.html        # Panel de recepción protegido con PIN para validar ingresos en puerta
├── styles.css          # Hoja de estilos principal (tema oscuro, tarjetas, ticket digital y responsive)
├── config.js           # Archivo único de configuración (tarifas, horarios, canchas, PIN, WhatsApp y URL API)
├── app.js              # Lógica del frontend: disponibilidad en vivo, reglas de canchas y envío de reservas
├── Code.gs             # Código del servidor en Google Apps Script (respaldo para editar en Apps Script)
├── logo.jpg            # Logotipo circular oficial del complejo (favicon, header y Open Graph)
├── videos/
│   ├── video_1.mp4     # Reel vertical 9:16 (H.264) — Partidos y canchas iluminadas
│   └── video_2.mp4     # Reel vertical 9:16 (H.264) — Recorrido por las instalaciones
└── README.md           # Documentación técnica del sistema
```

---

## 3. Módulos del Sistema

### 3.1. Portal Principal y Motor de Reservas (`index.html` + `app.js`)
* **Indicador de disponibilidad en vivo:** Consulta `doGet` al cargar o cambiar la fecha y muestra cuántos turnos libres quedan en total para ese día.
* **Reglas inteligentes por actividad:**
  * **Fútbol 5 ($35.000/h):** Habilita la selección entre `Cancha 1`, `Cancha 2`, `Cancha 3` y `Cancha 4`.
  * **Fútbol 7 ($65.000/h):** Asigna automáticamente la `Cancha 5 (Fútbol 7)`.
  * **Cumpleaños y eventos ($100.000 / 3 hs):** Preselecciona la `Cancha 4 (Fútbol 5)` y agrupa bloques de 3 horas consecutivas verificando que las 3 franjas estén libres.
* **Bloqueo automático:** Deshabilita fechas anteriores al día actual, horarios ya ocupados y turnos cuya hora de inicio ya transcurrió en el día en curso (`esHorarioPasado`).
* **Ticket Digital y WhatsApp:**
  * Genera un código único con formato `#LMD-XXXX`.
  * Renderiza una credencial digital con fecha, horario, cancha, valor y botón de copia en un toque (`copiarCodigoReserva`).
  * Redirige automáticamente al WhatsApp oficial del complejo (`+54 9 343 471-7233`) con el comprobante prearmado, dejando visible en la web el botón *Compartir partido con el grupo*.

### 3.2. Autogestión de Cancelaciones (`cancelar.html`)
* Permite al cliente cancelar su turno ingresando los 4 dígitos de su código `#LMD-XXXX`.
* Impide cancelar turnos que ya fueron utilizados (`Confirmado`) o que ya estaban dados de baja (`Cancelado`).
* Al confirmar la baja, marca la/s fila/s como `Cancelado` en rojo y libera inmediatamente ese horario en la agenda pública.

### 3.3. Control de Acceso en Recepción (`ingreso.html`)
* **Seguridad:** Pantalla de bloqueo inicial que exige el PIN de 4 dígitos configurado en `config.js` (`pinRecepcion: "1010"`), persistiendo la sesión únicamente mientras la pestaña esté abierta (`sessionStorage`).
* **Validación en puerta:** Al ingresar un código `#LMD-`, verifica:
  * **Verde (`ACCESO PERMITIDO`):** El turno corresponde al día actual (`America/Argentina/Buenos_Aires`) y pasa de `Pendiente` a `Confirmado`.
  * **Amarillo (`WARNING`):** El código ya ingresó previamente o pertenece a otra fecha.
  * **Rojo (`ERROR`):** El turno fue cancelado o el código no existe.
* **Tablero diario en vivo:** Muestra contadores de *Confirmados hoy* y *Pendientes hoy*, sincronizando cada 30 segundos o al volver a enfocar la pestaña.

---

## 4. Configuración Centralizada (`config.js`)

Cualquier cambio operativo habitual se realiza editando únicamente **`config.js`** sin tocar la lógica de `app.js` ni `Code.gs`:

| Propiedad | Descripción | Valor Actual |
| :--- | :--- | :--- |
| `nombreComplejo` | Nombre mostrado en títulos, tickets y mensajes | `"LAMANODED10S"` |
| `direccion` | Dirección física usada en tickets y mapa | `"Fraternidad y Gobernador Crespo, Paraná"` |
| `prefijoCodigo` | Prefijo de identificación de turnos | `"LMD"` |
| `pinRecepcion` | Clave numérica de 4 dígitos para `ingreso.html` | `"1010"` |
| `whatsappContacto` | Número internacional sin `+` ni espacios | `"5493434717233"` |
| `scriptURL` | Endpoint `/exec` activo de Google Apps Script | `https://script.google.com/macros/s/.../exec` |
| `precios` | Mapa de tarifas por actividad | F5: `$35.000` · F7: `$65.000` · Cumple: `$100.000` |
| `canchas` | Listado de canchas disponibles | Canchas 1 a 4 (F5) y Cancha 5 (F7) |
| `horarios` | Franjas horarias de turnos | `"14:00 a 15:00 hs"` hasta `"23:00 a 00:00 hs"` |

---

## 5. Backend y Base de Datos (`Code.gs` + Google Sheets)

### 5.1. Estructura de la Planilla
El script crea automáticamente una pestaña por mes con formato **`Mes Año`** (ej. `Noviembre 2026`, `Diciembre 2026`) y las siguientes **10 columnas (`A` a `J`)**:

| Col | Encabezado | Formato / Regla |
| :---: | :--- | :--- |
| **A** | `Código` | Texto (`#LMD-XXXX`) |
| **B** | `Fecha Registro` | Timestamp `dd/MM/yyyy HH:mm` (hora Argentina) |
| **C** | `Fecha Turno` | Texto plano (`@`) `yyyy-MM-dd` |
| **D** | `Horario` | Ej. `20:00 a 21:00 hs` |
| **E** | `Disciplina` | `Fútbol 5`, `Fútbol 7` o `Cumpleaños (3 hs · F5)` |
| **F** | `Cancha` | Nombre de la cancha asignada |
| **G** | `Modalidad` | `Turno 1 hora` o `Pack 3 horas` |
| **H** | `Responsable` | Nombre y apellido capitalizados |
| **I** | `Teléfono` | Texto plano (`@`) |
| **J** | `Estado` | `Pendiente` (blanco), `Confirmado` (verde `#d9ead3`), `Cancelado` (rojo `#f4cccc`) |

### 5.2. Control de Concurrencia y Ordenamiento Automático
* **Bloqueo atómico (`LockService`):** `doPost` adquiere un bloqueo exclusivo (`lock.waitLock(10000)`) antes de leer y escribir. Si dos usuarios intentan reservar el mismo turno simultáneamente, el segundo recibe `{ status: 'conflict' }` sin pisar la reserva del primero.
* **Ordenamiento por prioridad (`ordenarPestana`):** Cada vez que entra una reserva, se valida un ingreso, se cancela un turno o se edita manualmente la columna `J` (`onEdit`), la pestaña reordena todas las filas bajo tres niveles:
  1. **Estado:** `Confirmado` (arriba) → `Pendiente` (centro) → `Cancelado` (abajo).
  2. **Fecha Turno:** Ascendente (`yyyy-MM-dd`).
  3. **Horario:** Ascendente cronológico.

### 5.3. Endpoints de la API (`Code.gs`)
* **`GET ?action=getOccupied&fecha=YYYY-MM-DD`:** Devuelve `{ status, fecha, bookings, turnos, occupied }` para la fecha consultada (si no se envía fecha, toma el día actual en Argentina).
* **`POST { action: "reservar", ... }`:** Valida disponibilidad, inserta 1 fila (turno simple) o 3 filas (pack cumpleaños) bajo el mismo código `#LMD-XXXX` y ordena la hoja.
* **`POST { action: "checkin", code: "..." }`:** Busca el código en todas las pestañas, valida fecha de hoy y estado, actualiza a `Confirmado` y pinta en verde.
* **`POST { action: "cancelar", code: "..." }`:** Busca el código activo, cambia estado a `Cancelado` y pinta en rojo.

---

## 6. Despliegue y Publicación (Netlify / GitHub)

### 6.1. Actualizar Frontend
1. Realizar las modificaciones en los archivos locales (`index.html`, `styles.css`, `app.js`, `config.js`).
2. **Importante (Cache Busting):** Incrementar el parámetro de versión en `index.html` (ej. `styles.css?v=42`, `app.js?v=42`, `config.js?v=9`) para forzar a los navegadores móviles a descargar los cambios inmediatamente.
3. Subir los cambios a GitHub (`git push`) o arrastrar la carpeta raíz al panel **Deploys** de Netlify.

### 6.2. Actualizar Backend (`Code.gs`)
Cada vez que se modifique `Code.gs` en Google Apps Script:
1. Guardar el proyecto (`Ctrl + S`).
2. Ir a **Implementar → Administrar implementaciones**.
3. Hacer clic en el ícono del **lápiz (Editar)** → En *Versión*, seleccionar **Nueva versión** → Presionar **Implementar**.
*(Nota: Al editar la implementación existente en lugar de crear una nueva, la URL `/exec` no cambia y no hace falta modificar `config.js`).*

---

## 7. Guía de Mantenimiento Futuro

* **Cambiar precios de canchas o eventos:** Editar los valores dentro de `precios` y `notasPrecios` en `config.js` y actualizar los textos visibles en las tarjetas de `index.html` (`#deportes`).
* **Agregar o quitar horarios:** Modificar el array `horarios` en `config.js` respetando estrictamente el formato `"HH:MM a HH:MM hs"`.
* **Cambiar el PIN de recepción:** Modificar `pinRecepcion` en `config.js` (4 dígitos numéricos).
* **Cambiar el número de WhatsApp receptor:** Modificar `whatsappContacto` en `config.js` usando el formato `549` + código de área sin `0` + número sin `15` (ej. `5493434717233`).
* **Reemplazar videos institucionales:** Exportar en formato vertical **9:16**, códec **H.264 (`.mp4`)**, peso recomendado menor a 15 MB, y sobrescribir `videos/video_1.mp4` y `videos/video_2.mp4`.

---

## 8. Solución de Problemas Frecuentes

* **Los cambios en CSS/JS no se ven en el celular:** Verificar que se haya incrementado el número `?v=XX` en las etiquetas `<link>` y `<script>` de `index.html` y que el deploy en Netlify haya finalizado.
* **Error de conexión al abrir `index.html` o `ingreso.html`:** No abrir los archivos mediante doble clic (`file:///`). El navegador bloquea peticiones `fetch` a Apps Script desde rutas locales; abrir siempre mediante el dominio de Netlify o un servidor local (`Live Server`).
* **Un turno cargado manualmente en Sheets no bloquea la web:** Revisar que la columna `C` (`Fecha Turno`) tenga el formato exacto `AAAA-MM-DD` (ej. `2026-11-20`) y que la columna `D` (`Horario`) coincida letra por letra con `config.js`.

---

## 9. Créditos y Autoría

* **Cliente:** Complejo Deportivo **LAMANODED10S** — Paraná, Entre Ríos.
* **Diseño y Desarrollo Full-Stack:** Ignacio Aviles Peltzer.
