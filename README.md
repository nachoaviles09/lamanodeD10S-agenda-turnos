# ⚽ LAMANODED10S — Plataforma Web de Reservas y Control de Acceso

Sistema web integral desarrollado a medida para el complejo deportivo **LAMANODED10S** (Fraternidad y Gobernador Crespo, Paraná, Entre Ríos). Permite gestionar reservas online en tiempo real mediante un mapa táctico interactivo, evitar superposición de turnos, autogestionar bajas, controlar ingresos en puerta con PIN y sincronizar toda la agenda, estadísticas y bloqueos operativos directamente en **Google Sheets**.

---

## 📋 Tabla de Contenidos

1. [Arquitectura y Stack Tecnológico](#1-arquitectura-y-stack-tecnológico)
2. [Estructura del Repositorio](#2-estructura-del-repositorio)
3. [Módulos y Funcionalidades del Sistema](#3-módulos-y-funcionalidades-del-sistema)
4. [Configuración Centralizada (`config.js`)](#4-configuración-centralizada-configjs)
5. [Backend, Base de Datos y Automatizaciones (`Code.gs`)](#5-backend-base-de-datos-y-automatizaciones-codegs)
6. [Manual Operativo para Administración y Recepción](#6-manual-operativo-para-administración-y-recepción)
7. [Flujo de Trabajo con Git y Publicación en GitHub Pages](#7-flujo-de-trabajo-con-git-y-publicación-en-github-pages)
8. [Guía de Mantenimiento Futuro](#8-guía-de-mantenimiento-futuro)
9. [Solución de Problemas Frecuentes](#9-solución-de-problemas-frecuentes)
10. [Créditos y Autoría](#10-créditos-y-autoría)

---

## 1. Arquitectura y Stack Tecnológico

El sistema opera bajo una arquitectura **Serverless / Static Web**, diseñada para ofrecer alta disponibilidad sin costos fijos de servidores ni bases de datos externas:

* **Frontend:** HTML5 semántico, CSS3 moderno (Variables CSS, Grid/Flexbox, Glassmorphism, `color-scheme: dark` y diseño responsivo *mobile-first*) y JavaScript Vanilla (ES6+).
* **Backend / API REST:** **Google Apps Script** publicado como Web App (`doGet` y `doPost`), con control de concurrencia atómico mediante `LockService`.
* **Base de Datos y Tablero:** **Google Sheets** con generación automática de pestañas mensuales, expansión dinámica de bloques horarios, vencimiento automático de turnos no asistidos y cuadro resumen en vivo.
* **Multimedia CDN:** Videos verticales (9:16) alojados y servidos optimizados desde **Cloudinary**.
* **Control de Versiones y Hosting:** **Git** + **GitHub** + **GitHub Pages** con certificado SSL/HTTPS automático.

---

## 2. Estructura del Repositorio

```text
lamanoded10s/
├── index.html          # Portal principal: vista táctica de canchas, reservas, videos, tarifas y mapa
├── cancelar.html       # Portal de autogestión para dar de baja turnos mediante código #LMD-XXXX
├── ingreso.html        # Panel de recepción protegido con PIN para validar ingresos en puerta
├── styles.css          # Hoja de estilos principal (tema oscuro, cancha LED, tarjetas y ticket digital)
├── config.js           # Archivo único de configuración (tarifas, horarios, canchas, PIN, WhatsApp y URL API)
├── app.js              # Lógica del cliente: mapa interactivo, sanitización de inputs, reservas y localStorage
├── Code.gs             # Código del servidor en Google Apps Script (respaldo sincronizado del backend)
├── logo.jpg            # Logotipo circular oficial del complejo (favicon, cabecera interactiva y Open Graph)
└── README.md           # Documentación técnica y manual operativo del sistema
```

---

## 3. Módulos y Funcionalidades del Sistema

### 3.1. Portal Principal y Mapa Táctico (`index.html` + `styles.css` + `app.js`)
* **Cabecera interactiva:** El logotipo y nombre del complejo funcionan como botón de retorno suave (`scroll-behavior: smooth`) hacia el inicio de la página.
* **Vista táctica interactiva del predio (`#pitchBlueprint`):**
  * Representación visual compacta de las **4 canchas de Fútbol 5** (en fila en PC / grilla 2×2 en móviles) y la **Cancha 5 reglamentaria de Fútbol 7** en barra horizontal inferior.
  * Iluminación ambiental con reflectores LED en las esquinas, haces de luz proyectados sobre el césped, efecto *spotlight* al mover el cursor y etiquetas de disponibilidad en vivo (*Libre*, *Seleccionada*, *Completa hoy*).
  * Al tocar cualquier cancha del plano, el sistema selecciona automáticamente la disciplina correspondiente, asigna la cancha en el formulario y enfoca el selector de horario.
* **Reglas inteligentes por actividad:**
  * **Fútbol 5 (`$35.000 / hora`):** Habilita la elección entre `Cancha 1`, `Cancha 2`, `Cancha 3` y `Cancha 4`.
  * **Fútbol 7 (`$65.000 / hora`):** Asigna automáticamente la `Cancha 5 (Fútbol 7)`.
  * **Cumpleaños y eventos (`$100.000 / pack 3 hs`):** Preselecciona la `Cancha 4 (Fútbol 5)` y agrupa franjas de 3 horas consecutivas verificando que los 3 bloques estén libres.
* **Validación y sanitización de formularios (`initInputSanitizers`):**
  * **Nombre y apellido:** Filtra en tiempo real y al enviar para aceptar únicamente letras, tildes, `ñ` y espacios (bloquea números y símbolos).
  * **Teléfono:** Activa teclado numérico en móviles (`inputmode="numeric"`) y elimina cualquier carácter no numérico, exigiendo entre 8 y 15 dígitos.
  * **Bloqueo horario:** Deshabilita fechas pasadas, turnos ocupados/bloqueados y horarios del día actual cuya hora de inicio ya transcurrió (`esHorarioPasado`).
* **Ticket Digital, Persistencia y WhatsApp:**
  * Genera un código único con formato `#LMD-XXXX` y guarda el comprobante en `localStorage` (`lmd_last_reservation_ticket`) durante 12 horas para recuperarlo ante recargas accidentales sin impedir que el encargado cargue múltiples turnos seguidos desde la PC del predio.
  * Abre WhatsApp con el comprobante prearmado hacia el número oficial del complejo (`+54 9 343 471-7233`) y ofrece el botón **Compartir partido con el grupo** (el mensaje grupal omite el código `#LMD-XXXX` por seguridad para evitar cancelaciones accidentales por parte de otros jugadores).

### 3.2. Autogestión de Cancelaciones (`cancelar.html`)
* Permite al responsable de la reserva dar de baja su turno ingresando los 4 dígitos de su código `#LMD-XXXX`.
* Bloquea la cancelación de turnos que ya fueron validados en puerta (`Confirmado`) o que ya se encontraban dados de baja (`Cancelado`).
* Libera el horario de manera inmediata en la agenda pública y reordena la planilla.

### 3.3. Control de Acceso en Recepción (`ingreso.html`)
* **Acceso protegido con PIN:** Requiere el PIN de 4 dígitos configurado en `config.js` (`pinRecepcion: "1010"`), manteniendo la sesión activa únicamente mientras la pestaña permanezca abierta (`sessionStorage`) y permitiendo bloquearla manualmente en cualquier momento.
* **Validación en puerta (`checkin`):**
  * **Verde (`ACCESO PERMITIDO`):** El turno corresponde al día actual en Argentina (`America/Argentina/Buenos_Aires`), pasa de `Pendiente` a `Confirmado` y suma en los contadores mensuales.
  * **Amarillo (`WARNING`):** El código ya fue utilizado previamente o pertenece a otra fecha.
  * **Rojo (`ERROR`):** El turno fue cancelado, venció sin confirmar o el código no existe.
* **Agenda del día en vivo:** Muestra tarjetas agrupadas por reserva con contadores de *Confirmados hoy* y *Pendientes hoy*, sincronizando automáticamente cada 30 segundos o al volver a enfocar la pestaña.

---

## 4. Configuración Centralizada (`config.js`)

Los parámetros operativos del complejo se administran desde **`config.js`** sin necesidad de modificar `app.js` ni `Code.gs`:

| Propiedad | Descripción | Valor Configurado |
| :--- | :--- | :--- |
| `nombreComplejo` | Nombre comercial mostrado en títulos, tickets y mensajes | `"LAMANODED10S"` |
| `direccion` | Ubicación utilizada en comprobantes y enlaces | `"Fraternidad y Gobernador Crespo, Paraná"` |
| `prefijoCodigo` | Prefijo identificador de reservas | `"LMD"` |
| `pinRecepcion` | Clave numérica de 4 dígitos para abrir `ingreso.html` | `"1010"` |
| `whatsappContacto` | Teléfono del complejo en formato internacional sin `+` | `"5493434717233"` |
| `scriptURL` | URL `/exec` de implementación activa en Google Apps Script | `https://script.google.com/macros/s/.../exec` |
| `precios` | Tarifas vigentes por actividad | F5: `$35.000` · F7: `$65.000` · Cumple: `$100.000` |
| `canchas` | Listado de canchas habilitadas | Canchas 1 a 4 (F5) y Cancha 5 (F7) |
| `horarios` | Grilla de turnos disponibles | `"14:00 a 15:00 hs"` hasta `"23:00 a 00:00 hs"` |

---

## 5. Backend, Base de Datos y Automatizaciones (`Code.gs`)

### 5.1. Estructura de la Planilla en Google Sheets
El servidor crea automáticamente una pestaña por cada mes bajo el formato **`Mes Año`** (ej. `Noviembre 2026`, `Diciembre 2026`) con **10 columnas principales (`A:J`)**:

| Col | Encabezado | Formato / Regla |
| :---: | :--- | :--- |
| **A** | `Código` | Texto (`#LMD-XXXX` para reservas / `#BLOQ-XXXX` para bloqueos) |
| **B** | `Fecha Registro` | Timestamp `dd/MM/yyyy HH:mm` (zona horaria Argentina) |
| **C** | `Fecha Turno` | Texto plano (`@`) `yyyy-MM-dd` |
| **D** | `Horario` | Ej. `20:00 a 21:00 hs` o `18:00 a 21:00 (Pack 3 hs)` |
| **E** | `Disciplina` | `Fútbol 5`, `Fútbol 7`, `Cumpleaños (3 hs · F5)` o `Bloqueo (...)` |
| **F** | `Cancha` | Cancha asignada |
| **G** | `Modalidad` | `Turno 1 hora`, `Pack 3 horas` o `Día completo` |
| **H** | `Responsable` | Nombre y apellido capitalizados |
| **I** | `Teléfono` | Texto plano (`@`) |
| **J** | `Estado` | `Pendiente`, `Confirmado`, `Bloqueado` o `Cancelado` |

### 5.2. Tablero Resumen Automático (`K:M`)
En cada actualización de la hoja (`actualizarResumenPestana`), el script genera y formatea automáticamente un cuadro resumen en las columnas **`K:M`** con los indicadores del mes:
* **Total Confirmados** (suma general de partidos jugados/validados)
* **Confirmados Fútbol 5**
* **Confirmados Fútbol 7**
* **Pendientes vigentes**
* **Cancelados / No asistió** *(los registros en estado `Bloqueado` no alteran las métricas de partidos confirmados)*

### 5.3. Automatizaciones y Concurrencia
* **Registro atómico (`LockService` + `expandirSlotsHorario`):** Cada reserva ocupa una única fila en la planilla (incluso los packs de 3 horas o bloqueos de día completo `14:00 a 00:00 hs`). Al verificar choques horarios, `expandirSlotsHorario` descompone cualquier rango en bloques individuales de 1 hora bajo bloqueo exclusivo (`lock.waitLock(10000)`).
* **Vencimiento automático de pendientes (`autoCancelarPendientesVencidos`):** Todo turno que haya quedado en estado `Pendiente` cuya fecha ya finalizó (`fechaTurno < hoyArgentina`) pasa automáticamente a `Cancelado` al consultar la agenda, validar códigos o mediante el activador nocturno (`cerrarPendientesDelDiaEnTodasLasHojas`).
* **Ordenamiento inteligente (`ordenarPestana` + `onEdit`):** Ordena las filas por prioridad de estado (`Confirmado` arriba en verde → `Pendiente` en blanco → `Bloqueado` en gris → `Cancelado` abajo en rojo), fecha y horario, tanto en operaciones vía API como al editar manualmente el desplegable de la columna `J` en Google Sheets.

---

## 6. Manual Operativo para Administración y Recepción

### 6.1. Bloquear una cancha o todo el predio (Lluvia, Torneos o Mantenimiento)
Desde la planilla de Google Sheets, sin necesidad de tocar código ni reservar hora por hora:
1. Abrí el menú superior **⚽ lamanoded10s → Bloquear cancha / predio por fecha**.
2. Ingresá la fecha en formato `AAAA-MM-DD` (ej. `2026-11-28`).
3. Escribí el número de cancha (`1` al `5`) o `0` para cerrar las **5 canchas** del complejo.
4. Indicá el motivo (ej. *Lluvia*, *Torneo interno*, *Mantenimiento*).
5. *Para volver a habilitar:* Cambiá el estado de esa fila de `Bloqueado` a **`Cancelado`** en la columna `J` y los horarios se liberarán al instante en la web.

### 6.2. Activador Nocturno Automático (Opcional)
Para que la planilla amanezca ordenada y con los turnos no asistidos cerrados a la madrugada sin depender de visitas a la web:
1. En el editor de **Google Apps Script**, entrá a **Activadores** (ícono del reloj en el menú izquierdo).
2. Tocá **+ Añadir activador** y seleccioná la función **`cerrarPendientesDelDiaEnTodasLasHojas`**.
3. Configurá la fuente del evento en **Según tiempo** → **Temporizador por días** → **De 1 a 2 a. m.** y guardá.

---

## 7. Flujo de Trabajo con Git y Publicación en GitHub Pages

El proyecto se gestiona íntegramente mediante **Git** y se aloja en **GitHub Pages**:

1. **Actualizar archivos locales:** Realizá los cambios en `index.html`, `styles.css`, `app.js`, `config.js` o `ingreso.html`.
2. **Invalidar caché de navegadores (*Cache Busting*):** Incrementá el parámetro `?v=XX` en las etiquetas `<link>` y `<script>` de `index.html` e `ingreso.html` antes de subir cambios.
3. **Subir cambios al repositorio remoto:**
   ```bash
   git status
   git add .
   git commit -m "Actualizo sistema LAMANODED10S"
   git push origin main
   ```
4. **Verificar despliegue:** En GitHub, ingresá a la pestaña **Actions** del repositorio y aguardá ~30–60 segundos hasta que el flujo **`pages build and deployment`** marque el tilde verde.

---

## 8. Guía de Mantenimiento Futuro

* **Actualizar tarifas:** Modificar los valores dentro de `precios` y `notasPrecios` en `config.js` y actualizar los importes visibles en las tarjetas de la sección `#deportes` en `index.html`.
* **Modificar franjas horarias:** Editar el array `horarios` en `config.js` respetando el formato exacto `"HH:MM a HH:MM hs"`.
* **Cambiar el PIN de recepción:** Editar `pinRecepcion` en `config.js` (4 dígitos numéricos).
* **Cambiar el WhatsApp del complejo:** Editar `whatsappContacto` en `config.js` con formato `549` + código de área sin `0` + número sin `15`.
* **Actualizar el backend (`Code.gs`):** Tras guardar cambios (`Ctrl + S`) en Google Apps Script, ir a **Implementar → Administrar implementaciones → Editar (lápiz) → Versión: Nueva versión → Implementar** para conservar la misma URL `/exec`.

---

## 9. Solución de Problemas Frecuentes

* **Los cambios visuales o de scripts no impactan en el celular:** Verificar que se haya incrementado el número de versión `?v=XX` en `index.html` y que el último `git push` haya finalizado en la pestaña **Actions** de GitHub.
* **Demora de 2 a 4 segundos en la primera carga del día:** Comportamiento normal de arranque en frío (*cold start*) de los servidores de Google Apps Script tras períodos de inactividad; las consultas posteriores responden en ~1 segundo.
* **Error de conexión al probar localmente:** No abrir los archivos `.html` mediante doble clic (`file:///`), ya que los navegadores bloquean peticiones `fetch` desde rutas locales. Utilizar siempre la URL de GitHub Pages o una extensión de servidor local como *Live Server*.
* **Un turno anotado a mano en Google Sheets no bloquea la web:** Verificar que la columna `C` (`Fecha Turno`) tenga el formato `AAAA-MM-DD`, que la columna `D` (`Horario`) coincida exactamente con los textos de `config.js` y que la columna `J` tenga estado `Pendiente`, `Confirmado` o `Bloqueado`.

---

## 10. Créditos y Autoría

* **Cliente:** Complejo Deportivo **LAMANODED10S** — Paraná, Entre Ríos (`@complejo.lamanoded10s`).
* **Arquitectura, Diseño y Desarrollo Full-Stack:** Ignacio Avilés Peltzer.
