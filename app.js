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
    await fetchOccupiedSlots(fechaInput.value);
    actualizarHorariosDisponibles();
  });

  deporteSelect.addEventListener('change', () => {
    syncSportsRules();
    actualizarHorariosDisponibles();
  });

  canchaSelect.addEventListener('change', () => {
    actualizarHorariosDisponibles();
  });

  form.addEventListener('submit', handleReservationSubmit);
});

// 1. Navegación móvil y scroll suave
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
  fetchOccupiedSlots(minDate);
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

// 4. Reglas de selección de canchas según disciplina
function syncSportsRules() {
  const deporte = document.getElementById('deporte').value;
  const canchaSelect = document.getElementById('cancha');
  const horarioNote = document.getElementById('horarioNote');

  canchaSelect.innerHTML = '';

  if (!deporte) {
    canchaSelect.disabled = true;
    canchaSelect.innerHTML = '<option value="">Primero elegí una disciplina...</option>';
    horarioNote.textContent = 'Los horarios ocupados se bloquean automáticamente en tiempo real.';
    return;
  }

  canchaSelect.disabled = false;

  if (deporte === 'Fútbol 7') {
    const canchasF7 = APP_CONFIG.canchas.filter(c => c.includes('Fútbol 7'));
    canchasF7.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      canchaSelect.appendChild(opt);
    });
    horarioNote.textContent = 'Turnos de 1 hora en cancha exclusiva de Fútbol 7.';
  } else {
    // Tanto Fútbol 5 como Cumpleaños utilizan cualquiera de las 4 canchas de Fútbol 5
    const canchasF5 = APP_CONFIG.canchas.filter(c => c.includes('Fútbol 5'));
    canchaSelect.innerHTML = '<option value="">Elegí una cancha de F5...</option>';
    canchasF5.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      canchaSelect.appendChild(opt);
    });

    if (deporte.includes('Cumpleaños')) {
      // Preseleccionar Cancha 4 por comodidad, pero dejando elegir otra si está ocupada
      if (canchasF5.includes('Cancha 4 (Fútbol 5)')) {
        canchaSelect.value = 'Cancha 4 (Fútbol 5)';
      }
      horarioNote.textContent = '🎂 El pack cumpleaños reserva 3 horas seguidas e incluye parrillas, freezer, heladeras y mobiliario.';
    } else {
      horarioNote.textContent = 'Turnos de 1 hora. Los horarios ocupados se bloquean automáticamente.';
    }
  }
}

// 5. Consultar turnos ocupados al servidor (Google Apps Script)
async function fetchOccupiedSlots(fecha) {
  if (!fecha || !SCRIPT_URL || SCRIPT_URL.includes('TU_GOOGLE')) return;

  const horarioSelect = document.getElementById('horario');
  horarioSelect.disabled = true;
  horarioSelect.innerHTML = '<option value="">Consultando disponibilidad...</option>';

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
  }
}

// 6. Armar dropdown de horarios (1 hora normal o bloques de 3 horas para Cumpleaños)
function actualizarHorariosDisponibles() {
  const fecha = document.getElementById('fecha').value;
  const deporte = document.getElementById('deporte').value;
  const cancha = document.getElementById('cancha').value;
  const horarioSelect = document.getElementById('horario');

  if (!fecha || !deporte || !cancha) {
    horarioSelect.disabled = true;
    horarioSelect.innerHTML = '<option value="">Primero seleccioná fecha, disciplina y cancha...</option>';
    return;
  }

  const ocupadosEnCancha = (occupiedByDate[fecha] && occupiedByDate[fecha][cancha]) || [];
  const listaHorarios = APP_CONFIG.horarios;
  const esCumple = deporte.includes('Cumpleaños');

  horarioSelect.disabled = false;
  horarioSelect.innerHTML = '<option value="">Seleccioná tu horario...</option>';

  if (!esCumple) {
    // Turnos normales de 1 hora
    listaHorarios.forEach(slot => {
      const opt = document.createElement('option');
      const ocupado = ocupadosEnCancha.includes(slot);
      opt.value = slot;
      opt.disabled = ocupado;
      opt.textContent = ocupado ? `${slot} (Ocupado)` : `${slot} — Disponible`;
      horarioSelect.appendChild(opt);
    });
  } else {
    // Bloques de 3 horas consecutivas para Cumpleaños
    for (let i = 0; i <= listaHorarios.length - 3; i++) {
      const s1 = listaHorarios[i];
      const s2 = listaHorarios[i + 1];
      const s3 = listaHorarios[i + 2];

      const ocupado =
        ocupadosEnCancha.includes(s1) ||
        ocupadosEnCancha.includes(s2) ||
        ocupadosEnCancha.includes(s3);

      const horaInicio = s1.split(' a ')[0];
      const horaFin = s3.split(' a ')[1];
      const etiqueta = `${horaInicio} a ${horaFin} (Pack 3 hs)`;

      const opt = document.createElement('option');
      opt.value = JSON.stringify({ label: etiqueta, slots: [s1, s2, s3] });
      opt.disabled = ocupado;
      opt.textContent = ocupado ? `${etiqueta} (No disponible)` : `${etiqueta} — Disponible`;
      horarioSelect.appendChild(opt);
    }
  }
}

// 7. Envío del formulario y generación de WhatsApp
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
  const nombre = document.getElementById('nombre').value.trim();
  const telefono = document.getElementById('telefono').value.trim();

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

  if (SCRIPT_URL && !SCRIPT_URL.includes('TU_GOOGLE')) {
    try {
      // Guarda 1 fila para turnos normales o 3 filas consecutivas para Cumpleaños
      for (const slot of slotsAGuardar) {
        const response = await fetch(SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'reservar',
            code: `#${refCode}`,
            fecha,
            horario: slot,
            deporte,
            cancha,
            nombre,
            telefono
          })
        });
        const result = await response.json();
        if (result.status === 'ok' || result.result === 'success') {
          savedInSheet = true;
        }
      }
    } catch (err) {
      console.error('Error guardando reserva:', err);
    }
  }

  // Formatear fecha DD/MM/YYYY para el mensaje
  const [y, m, d] = fecha.split('-');
  const fechaFormateada = `${d}/${m}/${y}`;

  const extrasCumple = esCumple
    ? `\n🎂 *Incluye:* 3 hs de cancha + freezer, heladeras, parrillas, mesas, sillas y tablones.`
    : '';

  const mensajeComplejo =
    `⚽ *NUEVA RESERVA - ${APP_CONFIG.nombreComplejo.toUpperCase()}*\n` +
    `🎫 *Código:* #${refCode}\n` +
    `📆 *Fecha:* ${fechaFormateada}\n` +
    `⏰ *Horario:* ${horarioTexto}\n` +
    `🏆 *Actividad:* ${deporte}\n` +
    `🏟️ *Cancha:* ${cancha}\n` +
    `👤 *A nombre de:* ${nombre}\n` +
    `📞 *Tel:* ${telefono}${extrasCumple}\n\n` +
    `_Envío este comprobante para confirmar mi lugar._`;

  const mensajeGrupo =
    `⚽ *¡Tenemos cancha en ${APP_CONFIG.nombreComplejo}!*\n` +
    `📆 ${fechaFormateada} · ⏰ ${horarioTexto}\n` +
    `🏟️ ${cancha} (${deporte})\n` +
    `📍 ${APP_CONFIG.direccion}\n` +
    `🎫 Código de ingreso: *#${refCode}*`;

  const waUrl = `https://api.whatsapp.com/send?phone=${APP_CONFIG.whatsappContacto}&text=${encodeURIComponent(mensajeComplejo)}`;
  const waShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensajeGrupo)}`;

  btnSubmit.disabled = false;
  btnText.textContent = 'Generar Solicitud de Reserva 🚀';
  if (loader) loader.style.display = 'none';

  const statusTitle = savedInSheet
    ? '¡Turno pre-reservado en agenda!'
    : '⚠️ Sin conexión con la agenda automática';

  const statusNote = savedInSheet
    ? 'Tu horario quedó bloqueado por 15 minutos. Tocá el botón verde de abajo para enviarnos el comprobante por WhatsApp y confirmarlo.'
    : 'No pudimos conectar con la agenda automática, pero podés enviarnos tu pedido directo por WhatsApp tocando el botón de abajo.';

  statusBox.style.display = 'block';
  statusBox.className = `status-box ${savedInSheet ? 'success' : 'warning'}`;
  statusBox.innerHTML = `
    <span class="confirm-badge">CÓDIGO #${refCode}</span>
    <h4>${statusTitle}</h4>
    <p>${statusNote}</p>
    <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-confirm" style="margin-bottom: 10px;">
      📲 Enviar solicitud por WhatsApp al complejo
    </a>
    <a href="${waShareUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-confirm" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #38bdf8;">
      👥 Compartir partido con el grupo
    </a>
    <button type="button" onclick="resetReservationFormUI()" style="margin-top: 14px; background: transparent; border: none; color: #94a3b8; font-size: 0.85rem; text-decoration: underline; cursor: pointer;">
      Hacer otra reserva
    </button>
  `;

  window.open(waUrl, '_blank');
  await fetchOccupiedSlots(fecha);
  actualizarHorariosDisponibles();
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

  reveals.forEach(el => observer.observe(el));
}