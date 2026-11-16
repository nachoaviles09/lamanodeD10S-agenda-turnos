const APP_CONFIG = window.APP_CONFIG || CONFIG;
const SCRIPT_URL = APP_CONFIG.scriptURL;

let occupiedByDate = {};

document.addEventListener('DOMContentLoaded', () => {
  initHeaderAndNav();
  initDateLimit();
  populateDeportes();
  configurarBotonFlotante();
  initScrollReveal();

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

  // Actualiza disponibilidad silenciosamente cuando el jugador vuelve a la pestaña del navegador
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

  // Conserva la selección si sigue libre tras una recarga silenciosa
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

// 7. Envío atómico del formulario y generación de comprobante para el grupo
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
  const nombre = typeof formatearNombrePropio === 'function'
    ? formatearNombrePropio(nombreInput.value.trim())
    : nombreInput.value.trim();
  nombreInput.value = nombre;
  const telefono = document.getElementById('telefono').value.replace(/[^\d+]/g, '').trim();

  if (!fecha || !deporte || !cancha || !horarioRaw || !nombre || !telefono) return;

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

  let savedInSheet = false;
  let conflictDetected = false;
  let conflictMessage = '';

  if (SCRIPT_URL && !SCRIPT_URL.includes('TU_GOOGLE')) {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'reservar',
          code: `#${refCode}`,
          fecha,
          horario: slotsAGuardar[0],
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

  const mensajeGrupo =
    `⚽ *¡Tenemos cancha en ${APP_CONFIG.nombreComplejo}!*\n` +
    `📆 ${fechaFormateada} · ⏰ ${horarioTexto}\n` +
    `🏟️ ${cancha} (${deporte})${lineaValor}\n` +
    `📍 ${APP_CONFIG.direccion}\n` +
    `🎫 Código de ingreso: *#${refCode}*`;

  const waShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensajeGrupo)}`;

  const statusTitle = savedInSheet
    ? '¡Turno reservado en agenda!'
    : 'Sin conexión con la agenda automática';

  const statusNote = savedInSheet
    ? 'Tu turno ya quedó agendado. Guardá tu código para recepción y compartí los datos del partido con tu grupo:'
    : 'No pudimos conectar con la agenda automática, pero podés compartir los datos del partido con tu grupo:';

  statusBox.style.display = 'block';
  statusBox.className = `status-box ${savedInSheet ? 'success' : 'warning'}`;
  statusBox.innerHTML = `
    <div class="ticket-header">
      <span class="confirm-badge">CÓDIGO #${refCode}</span>
      <button type="button" class="btn-copy-code" onclick="copiarCodigoReserva('#${refCode}', this)">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        Copiar código
      </button>
    </div>
    <h4>${statusTitle}</h4>
    <p>${statusNote}</p>

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

    <a href="${waShareUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-confirm">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
      Compartir partido con el grupo
    </a>
    <button type="button" onclick="resetReservationFormUI()" style="margin-top: 14px; background: transparent; border: none; color: #94a3b8; font-size: 0.84rem; text-decoration: underline; cursor: pointer;">
      Hacer otra reserva
    </button>
  `;

  await fetchOccupiedSlots(fecha, true);
}

function resetReservationFormUI() {
  document.getElementById('reservationForm').reset();
  document.getElementById('statusBox').style.display = 'none';
  initDateLimit();
  syncSportsRules();
}

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

  reveals.forEach(el => observer.observe(el));
}