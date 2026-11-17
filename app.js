const APP_CONFIG = window.APP_CONFIG || CONFIG;
const SCRIPT_URL = APP_CONFIG.scriptURL;
const STORAGE_LAST_TICKET_KEY = 'lmd_last_reservation_ticket';

let occupiedByDate = {};

document.addEventListener('DOMContentLoaded', () => {
  initHeaderAndNav();
  initDateLimit();
  populateDeportes();
  configurarBotonFlotante();
  initScrollReveal();
  initScrollSpy();
  restaurarUltimoComprobante();

  const fechaInput = document.getElementById('fecha');
  const deporteSelect = document.getElementById('deporte');
  const canchaSelect = document.getElementById('cancha');
  const form = document.getElementById('reservationForm');

  fechaInput.addEventListener('change', async () => {
    await fetchOccupiedSlots(fechaInput.value, false);
    actualizarHorariosDisponibles();
  });

  deporteSelect.addEventListener('change', () => {
    syncSportsRules();
    actualizarHorariosDisponibles();
  });

  canchaSelect.addEventListener('change', () => {
    actualizarHorariosDisponibles();
  });

  // Actualiza disponibilidad silenciosamente cuando el jugador vuelve a la pestaña
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && fechaInput && fechaInput.value) {
      await fetchOccupiedSlots(fechaInput.value, true);
    }
  });

  form.addEventListener('submit', handleReservationSubmit);
});

// 1. Navegación móvil
function initHeaderAndNav() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      menuToggle.classList.toggle('active');
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        menuToggle.classList.remove('active');
      });
    });
  }
}

// 2. Bloquear fechas pasadas en el calendario
function initDateLimit() {
  const fechaInput = document.getElementById('fecha');
  if (!fechaInput) return;
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  const minDate = `${yyyy}-${mm}-${dd}`;
  fechaInput.min = minDate;
  fechaInput.value = minDate;
  fetchOccupiedSlots(minDate, false);
}

// 3. Cargar disciplinas desde config.js
function populateDeportes() {
  const deporteSelect = document.getElementById('deporte');
  if (!deporteSelect) return;

  deporteSelect.innerHTML = '<option value="">Seleccioná una opción...</option>';
  APP_CONFIG.deportes.forEach(dep => {
    const opt = document.createElement('option');
    opt.value = dep;
    opt.textContent = dep;
    deporteSelect.appendChild(opt);
  });
}

// 4. Reglas de selección de canchas y tarifa según disciplina
function syncSportsRules() {
  const deporte = document.getElementById('deporte').value;
  const canchaSelect = document.getElementById('cancha');
  const horarioNote = document.getElementById('horarioNote');

  canchaSelect.innerHTML = '';

  if (!deporte) {
    canchaSelect.disabled = true;
    canchaSelect.innerHTML = '<option value="">Elegí primero actividad...</option>';
    horarioNote.textContent = 'Los horarios ocupados se bloquean automáticamente.';
    return;
  }

  canchaSelect.disabled = false;

  const precio = (APP_CONFIG.precios && APP_CONFIG.precios[deporte]) || '';
  const notaPrecio = (APP_CONFIG.notasPrecios && APP_CONFIG.notasPrecios[deporte]) || '';
  const textoTarifa = precio ? `Tarifa: ${precio} (${notaPrecio}) · ` : '';

  if (deporte === 'Fútbol 7') {
    const canchasF7 = APP_CONFIG.canchas.filter(c => c.includes('Fútbol 7'));
    canchasF7.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      canchaSelect.appendChild(opt);
    });
    horarioNote.textContent = `${textoTarifa}Turnos de 1 hora en cancha exclusiva de Fútbol 7.`;
  } else {
    const canchasF5 = APP_CONFIG.canchas.filter(c => c.includes('Fútbol 5'));
    canchaSelect.innerHTML = '<option value="">Elegí una cancha de F5...</option>';
    canchasF5.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      canchaSelect.appendChild(opt);
    });

    if (deporte.includes('Cumpleaños')) {
      if (canchasF5.includes('Cancha 4 (Fútbol 5)')) {
        canchaSelect.value = 'Cancha 4 (Fútbol 5)';
      }
      horarioNote.textContent = `${textoTarifa}Incluye parrillas, freezer, heladeras, mesas, sillas y tablones.`;
    } else {
      horarioNote.textContent = `${textoTarifa}Los horarios ocupados se bloquean automáticamente.`;
    }
  }
}

// 5. Consultar turnos ocupados al servidor (Google Apps Script)
async function fetchOccupiedSlots(fecha, silent = false) {
  if (!fecha) return;

  if (!SCRIPT_URL || SCRIPT_URL.includes('TU_GOOGLE')) {
    occupiedByDate[fecha] = occupiedByDate[fecha] || {};
    actualizarBadgeDisponibilidad(fecha);
    return;
  }

  const badge = document.getElementById('liveAvailabilityBadge');
  const horarioSelect = document.getElementById('horario');

  if (!silent) {
    if (badge) {
      badge.className = 'live-slots-pill';
      badge.innerHTML = `<span class="live-dot"></span> Consultando disponibilidad...`;
    }
    if (horarioSelect) {
      horarioSelect.disabled = true;
      horarioSelect.innerHTML = '<option value="">Consultando disponibilidad...</option>';
    }
  }

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getOccupied&fecha=${encodeURIComponent(fecha)}`);
    const data = await res.json();
    if (data && data.occupied) {
      occupiedByDate[fecha] = data.occupied;
    } else {
      occupiedByDate[fecha] = {};
    }
  } catch (err) {
    console.warn('No se pudo verificar disponibilidad en vivo:', err);
    occupiedByDate[fecha] = occupiedByDate[fecha] || {};
  } finally {
    actualizarBadgeDisponibilidad(fecha);
    actualizarHorariosDisponibles();
  }
}

// Verifica si la hora de inicio del turno ya pasó cuando la fecha elegida es hoy
function esHorarioPasado(fechaSeleccionada, slot) {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  const hoyStr = `${yyyy}-${mm}-${dd}`;

  if (fechaSeleccionada < hoyStr) return true;
  if (fechaSeleccionada > hoyStr) return false;

  const horaInicioStr = slot.split(' a ')[0].trim();
  const [horas, minutos] = horaInicioStr.split(':').map(Number);

  const minutosSlot = horas * 60 + (minutos || 0);
  const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();

  return minutosSlot <= minutosActuales;
}

// 6. Armar dropdown de horarios bloqueando ocupados y horarios ya pasados
function actualizarHorariosDisponibles() {
  const fecha = document.getElementById('fecha').value;
  const deporte = document.getElementById('deporte').value;
  const cancha = document.getElementById('cancha').value;
  const horarioSelect = document.getElementById('horario');

  actualizarBadgeDisponibilidad(fecha);

  if (!fecha || !deporte || !cancha) {
    horarioSelect.disabled = true;
    horarioSelect.innerHTML = '<option value="">Elegí fecha y cancha...</option>';
    return;
  }

  const valorPrevio = horarioSelect.value;
  const ocupadosEnCancha = (occupiedByDate[fecha] && occupiedByDate[fecha][cancha]) || [];
  const listaHorarios = APP_CONFIG.horarios;
  const esCumple = deporte.includes('Cumpleaños');

  horarioSelect.disabled = false;
  horarioSelect.innerHTML = '<option value="">Seleccioná tu horario...</option>';

  if (!esCumple) {
    listaHorarios.forEach(slot => {
      const opt = document.createElement('option');
      const ocupado = ocupadosEnCancha.includes(slot);
      const pasado = esHorarioPasado(fecha, slot);

      opt.value = slot;
      opt.disabled = ocupado || pasado;

      if (pasado) {
        opt.textContent = `${slot} (Horario pasado)`;
      } else if (ocupado) {
        opt.textContent = `${slot} (Ocupado)`;
      } else {
        opt.textContent = `${slot} — Disponible`;
      }

      horarioSelect.appendChild(opt);
    });
  } else {
    for (let i = 0; i <= listaHorarios.length - 3; i++) {
      const s1 = listaHorarios[i];
      const s2 = listaHorarios[i + 1];
      const s3 = listaHorarios[i + 2];

      const pasado = esHorarioPasado(fecha, s1);
      const ocupado =
        ocupadosEnCancha.includes(s1) ||
        ocupadosEnCancha.includes(s2) ||
        ocupadosEnCancha.includes(s3);

      const horaInicio = s1.split(' a ')[0];
      const horaFin = s3.split(' a ')[1];
      const etiqueta = `${horaInicio} a ${horaFin} (Pack 3 hs)`;

      const opt = document.createElement('option');
      opt.value = JSON.stringify({ label: etiqueta, slots: [s1, s2, s3] });
      opt.disabled = ocupado || pasado;

      if (pasado) {
        opt.textContent = `${etiqueta} (Horario pasado)`;
      } else if (ocupado) {
        opt.textContent = `${etiqueta} (No disponible)`;
      } else {
        opt.textContent = `${etiqueta} — Disponible`;
      }

      horarioSelect.appendChild(opt);
    }
  }

  if (valorPrevio) {
    const opcionExistente = Array.from(horarioSelect.options).find(o => o.value === valorPrevio && !o.disabled);
    if (opcionExistente) {
      horarioSelect.value = valorPrevio;
    }
  }
}

// Actualiza el indicador en vivo de turnos disponibles para la fecha elegida
function actualizarBadgeDisponibilidad(fecha) {
  const badge = document.getElementById('liveAvailabilityBadge');
  if (!badge || !fecha) return;

  if (!occupiedByDate[fecha]) {
    badge.className = 'live-slots-pill';
    badge.innerHTML = `<span class="live-dot"></span> Consultando disponibilidad...`;
    return;
  }

  const ocupadosFecha = occupiedByDate[fecha];
  let libres = 0;

  APP_CONFIG.canchas.forEach(cancha => {
    const ocupadosCancha = ocupadosFecha[cancha] || [];
    APP_CONFIG.horarios.forEach(slot => {
      if (!ocupadosCancha.includes(slot) && !esHorarioPasado(fecha, slot)) {
        libres++;
      }
    });
  });

  if (libres > 0) {
    badge.className = 'live-slots-pill';
    badge.innerHTML = `<span class="live-dot"></span> Quedan ${libres} ${libres === 1 ? 'turno disponible' : 'turnos disponibles'} para esta fecha`;
  } else {
    badge.className = 'live-slots-pill full';
    badge.innerHTML = `<span class="live-dot"></span> Agenda completa para esta fecha`;
  }
}

// Utilidades de formato y copiado al portapapeles
function formatearNombrePropio(texto) {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function copiarFallback(texto, callback) {
  const area = document.createElement('textarea');
  area.value = texto;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  try {
    document.execCommand('copy');
    callback();
  } catch (err) {
    console.error('No se pudo copiar:', err);
  }
  document.body.removeChild(area);
}

window.copiarCodigoReserva = function(codigo, btn) {
  const marcarCopiado = () => {
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> ¡Copiado!`;
    btn.style.borderColor = '#22c55e';
    btn.style.color = '#22c55e';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(codigo).then(marcarCopiado).catch(() => copiarFallback(codigo, marcarCopiado));
  } else {
    copiarFallback(codigo, marcarCopiado);
  }
};

window.copiarDireccion = function(btn) {
  const dir = `${APP_CONFIG.direccion}, Entre Ríos`;
  const marcarCopiado = () => {
    const original = btn.textContent;
    btn.textContent = 'Dirección copiada';
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(dir).then(marcarCopiado).catch(() => copiarFallback(dir, marcarCopiado));
  } else {
    copiarFallback(dir, marcarCopiado);
  }
};

// Renderiza el comprobante digital (usado tanto tras reservar como al recuperar desde localStorage)
function renderTicketHTML(ticketData, esRecuperado = false) {
  const {
    codigoCompleto,
    fechaFormateada,
    horarioTexto,
    cancha,
    precioTurno,
    savedInSheet,
    waUrl,
    waShareUrl
  } = ticketData;

  const titulo = esRecuperado
    ? 'Ya tenés una reserva activa registrada'
    : (savedInSheet ? '¡Turno reservado en agenda!' : '¡Comprobante generado!');

  const bajada = esRecuperado
    ? 'Recuperamos tu último turno guardado en este dispositivo para evitar reservas duplicadas. Si no se abrió WhatsApp, usá el botón verde:'
    : 'Tu turno ya quedó agendado. Si WhatsApp no se abrió automáticamente, presioná el botón verde para enviar el comprobante al complejo:';

  return `
    <div class="ticket-header">
      <span class="confirm-badge">CÓDIGO ${codigoCompleto}</span>
      <button type="button" class="btn-copy-code" onclick="copiarCodigoReserva('${codigoCompleto}', this)">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        Copiar código
      </button>
    </div>
    <h4>${titulo}</h4>
    <p>${bajada}</p>

    <div class="ticket-grid">
      <div class="ticket-cell">
        <span class="ticket-label">Fecha</span>
        <span class="ticket-value">${fechaFormateada}</span>
      </div>
      <div class="ticket-cell">
        <span class="ticket-label">Horario</span>
        <span class="ticket-value">${horarioTexto}</span>
      </div>
      <div class="ticket-cell">
        <span class="ticket-label">Cancha</span>
        <span class="ticket-value">${cancha}</span>
      </div>
      <div class="ticket-cell">
        <span class="ticket-label">Valor estimado</span>
        <span class="ticket-value">${precioTurno}</span>
      </div>
    </div>

    <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-confirm">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg>
      Enviar comprobante por WhatsApp
    </a>

    <a href="${waShareUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-group">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
      Compartir partido con el grupo
    </a>

    <button type="button" onclick="resetReservationFormUI()" style="margin-top: 14px; background: transparent; border: none; color: #94a3b8; font-size: 0.84rem; text-decoration: underline; cursor: pointer;">
      Hacer otra reserva
    </button>
  `;
}

// Recupera el último ticket si el jugador recarga por error o latencia 4G (expira a las 12 hs o si el turno ya pasó)
function restaurarUltimoComprobante() {
  try {
    const raw = localStorage.getItem(STORAGE_LAST_TICKET_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || !saved.fecha || !saved.createdAt) return;

    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    const hoyStr = `${yyyy}-${mm}-${dd}`;

    const doceHorasMs = 12 * 60 * 60 * 1000;
    if (saved.fecha < hoyStr || (Date.now() - saved.createdAt) > doceHorasMs) {
      localStorage.removeItem(STORAGE_LAST_TICKET_KEY);
      return;
    }

    const statusBox = document.getElementById('statusBox');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'status-box success';
      statusBox.innerHTML = renderTicketHTML(saved, true);
    }
  } catch (err) {
    console.warn('No se pudo leer el último comprobante guardado:', err);
  }
}

// 7. Envío atómico del formulario, validación de teléfono, guardado en localStorage y WhatsApp
async function handleReservationSubmit(e) {
  e.preventDefault();

  const btnSubmit = document.getElementById('btnSubmit');
  const btnText = btnSubmit.querySelector('.btn-text');
  const loader = document.getElementById('submitLoader');
  const statusBox = document.getElementById('statusBox');

  const fecha = document.getElementById('fecha').value;
  const deporte = document.getElementById('deporte').value;
  const cancha = document.getElementById('cancha').value;
  const horarioRaw = document.getElementById('horario').value;
  const nombreInput = document.getElementById('nombre');
  const telefonoInput = document.getElementById('telefono');

  const nombre = formatearNombrePropio(nombreInput.value.trim());
  nombreInput.value = nombre;

  // 1) Validación estricta de teléfono: limpia espacios/guiones/paréntesis y exige al menos 8 dígitos
  const telefono = telefonoInput.value.replace(/[^\d+]/g, '').trim();
  const soloDigitos = telefono.replace(/\D/g, '');
  telefonoInput.value = telefono;

  if (!fecha || !deporte || !cancha || !horarioRaw || !nombre) return;

  if (soloDigitos.length < 8) {
    statusBox.style.display = 'block';
    statusBox.className = 'status-box warning';
    statusBox.innerHTML = `
      <span class="confirm-badge">TELÉFONO INCOMPLETO</span>
      <h4>Revisá tu número de teléfono</h4>
      <p>Ingresá un número válido de al menos 8 dígitos (con código de área, por ejemplo: <strong>3434717233</strong>).</p>
    `;
    telefonoInput.focus();
    return;
  }

  btnSubmit.disabled = true;
  btnText.textContent = 'Agendando turno...';
  if (loader) loader.style.display = 'inline-block';

  const esCumple = deporte.includes('Cumpleaños');
  let slotsAGuardar = [];
  let horarioTexto = horarioRaw;

  if (esCumple) {
    const parsed = JSON.parse(horarioRaw);
    slotsAGuardar = parsed.slots;
    horarioTexto = parsed.label;
  } else {
    slotsAGuardar = [horarioRaw];
  }

  const prefijo = APP_CONFIG.prefijoCodigo || 'LMD';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const refCode = `${prefijo}-${randomNum}`;
  const codigoCompleto = `#${refCode}`;

  let savedInSheet = false;
  let conflictDetected = false;
  let conflictMessage = '';

  if (SCRIPT_URL && !SCRIPT_URL.includes('TU_GOOGLE')) {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'reservar',
          code: codigoCompleto,
          fecha,
          horario: horarioTexto,
          horarioEtiqueta: horarioTexto,
          slots: slotsAGuardar,
          deporte,
          cancha,
          nombre,
          telefono
        })
      });
      const result = await response.json();

      if (result.status === 'conflict') {
        conflictDetected = true;
        conflictMessage = result.message || 'Ese horario se acaba de ocupar. Elegí otro turno disponible.';
      } else if (result.status === 'ok' || result.result === 'success') {
        savedInSheet = true;
      }
    } catch (err) {
      console.error('Error guardando reserva:', err);
    }
  }

  btnSubmit.disabled = false;
  btnText.textContent = 'Confirmar reserva';
  if (loader) loader.style.display = 'none';

  if (conflictDetected) {
    statusBox.style.display = 'block';
    statusBox.className = 'status-box warning';
    statusBox.innerHTML = `
      <span class="confirm-badge">HORARIO NO DISPONIBLE</span>
      <h4>Turno recién ocupado</h4>
      <p>${conflictMessage}</p>
    `;
    await fetchOccupiedSlots(fecha, false);
    return;
  }

  const [y, m, d] = fecha.split('-');
  const fechaFormateada = `${d}/${m}/${y}`;

  const precioTurno = (APP_CONFIG.precios && APP_CONFIG.precios[deporte]) || 'A confirmar';
  const lineaValor = precioTurno !== 'A confirmar' ? `\n💰 *Valor:* ${precioTurno}` : '';
  const extrasCumple = esCumple
    ? `\n🎂 *Incluye:* 3 hs de cancha + freezer, heladeras, parrillas, mesas, sillas y tablones.`
    : '';

  // Mensaje directo para el WhatsApp del complejo
  const mensajeComplejo =
    `⚽ *NUEVA RESERVA - ${APP_CONFIG.nombreComplejo.toUpperCase()}*\n` +
    `🎫 *Código:* ${codigoCompleto}\n` +
    `📆 *Fecha:* ${fechaFormateada}\n` +
    `⏰ *Horario:* ${horarioTexto}\n` +
    `🏆 *Actividad:* ${deporte}\n` +
    `🏟️ *Cancha:* ${cancha}${lineaValor}\n` +
    `👤 *A nombre de:* ${nombre}\n` +
    `📞 *Tel:* ${telefono}${extrasCumple}\n\n` +
    `_Envío este comprobante para confirmar mi lugar._`;

  // Mensaje para compartir con el grupo de jugadores
  const mensajeGrupo =
    `⚽ *¡Tenemos cancha en ${APP_CONFIG.nombreComplejo}!*\n` +
    `📆 ${fechaFormateada} · ⏰ ${horarioTexto}\n` +
    `🏟️ ${cancha} (${deporte})${lineaValor}\n` +
    `📍 ${APP_CONFIG.direccion}\n` +
    `🎫 Código de ingreso: *${codigoCompleto}*`;

  const waUrl = `https://api.whatsapp.com/send?phone=${APP_CONFIG.whatsappContacto}&text=${encodeURIComponent(mensajeComplejo)}`;
  const waShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensajeGrupo)}`;

  const ticketData = {
    codigoCompleto,
    fecha,
    fechaFormateada,
    horarioTexto,
    cancha,
    precioTurno,
    savedInSheet,
    waUrl,
    waShareUrl,
    createdAt: Date.now()
  };

  // 2) Guardar último comprobante en localStorage para evitar duplicados si recarga la página
  try {
    localStorage.setItem(STORAGE_LAST_TICKET_KEY, JSON.stringify(ticketData));
  } catch (err) {
    console.warn('No se pudo guardar en localStorage:', err);
  }

  // 3) Mostrar tarjeta con botón manual "Enviar comprobante por WhatsApp" + "Compartir partido con el grupo"
  statusBox.style.display = 'block';
  statusBox.className = `status-box ${savedInSheet ? 'success' : 'warning'}`;
  statusBox.innerHTML = renderTicketHTML(ticketData, false);

  await fetchOccupiedSlots(fecha, true);

  // Intenta abrir WhatsApp automáticamente (si el navegador interno de Instagram lo frena, queda el botón manual visible)
  setTimeout(() => {
    window.location.href = waUrl;
  }, 350);
}

window.resetReservationFormUI = function() {
  try {
    localStorage.removeItem(STORAGE_LAST_TICKET_KEY);
  } catch (err) {}
  document.getElementById('reservationForm').reset();
  document.getElementById('statusBox').style.display = 'none';
  initDateLimit();
  syncSportsRules();
};

// 8. Botón flotante de WhatsApp
function configurarBotonFlotante() {
  const waFloat = document.querySelector('.whatsapp-float');
  if (!waFloat) return;
  const texto = `¡Hola! Quiero hacer una consulta en ${APP_CONFIG.nombreComplejo} ⚽`;
  waFloat.href = `https://api.whatsapp.com/send?phone=${APP_CONFIG.whatsappContacto}&text=${encodeURIComponent(texto)}`;
}

// 9. Animaciones suaves al scrollear
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => observer.observe(el));
}

// 10. Marcar enlace activo en la barra superior según la sección visible
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-35% 0px -55% 0px' });

  sections.forEach(sec => observer.observe(sec));
}