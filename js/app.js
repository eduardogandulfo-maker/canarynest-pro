// Estado global
let STATE = { aves: [], jaulas: [], pichones: [], medicamentos: [], rutinas: [], planes: [] };

// ── AUTH ──
netlifyIdentity.on("init", user => user ? showApp(user) : showAuth());
netlifyIdentity.on("login", user => { netlifyIdentity.close(); showApp(user); });
netlifyIdentity.on("logout", () => showAuth());

function showAuth() {
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app").style.display = "none";
}

async function showApp(user) {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  document.getElementById("user-email").textContent = user.email;
  initDate();
  await loadWeather();
  await loadAll();
}

// ── DATE / WEATHER ──
function initDate() {
  const now = new Date();
  const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  document.getElementById("date-chip").textContent =
    `${dias[now.getDay()]} ${now.getDate()} ${meses[now.getMonth()]}`;
}

async function loadWeather() {
  let lat = -34.6037, lon = -58.3816;
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
    );
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
  } catch {}
  const w = await getWeather(lat, lon);
  const chip = document.getElementById("weather-chip");
  chip.innerHTML = `<i class="ti ${weatherIcon(w.code)}"></i> ${w.temp}°C · ${w.humidity}%`;
}

// ── NAVEGACIÓN ──
const PAGE_TITLES = {
  dashboard: ["Dashboard", "INICIO / RESUMEN"],
  aves: ["Mis Aves", "INICIO / AVES"],
  jaulas: ["Jaulas de Cría", "INICIO / JAULAS"],
  medicamentos: ["Medicamentos", "INICIO / MEDICAMENTOS"],
  sanitario: ["Plan Sanitario", "INICIO / PLAN SANITARIO"],
  rutinas: ["Alimentación y Limpieza", "INICIO / RUTINAS"],
};

function goTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  const info = PAGE_TITLES[page] || [page, ""];
  document.getElementById("page-title").textContent = info[0];
  document.getElementById("page-sub").textContent = info[1];
  document.querySelectorAll(".nav-item").forEach(n => {
    if (n.getAttribute("onclick")?.includes(`'${page}'`)) n.classList.add("active");
  });
  renderPage(page);
}

// ── CARGA DE DATOS ──
async function loadAll() {
  try {
    const [a, j, p, m, r, s] = await Promise.all([
      API.get("Aves"),
      API.get("Jaulas_Cria"),
      API.get("Pichones"),
      API.get("Medicamentos"),
      API.get("Tareas_Rutina"),
      API.get("Plan_Sanitario"),
    ]);
    STATE.aves = a.records || [];
    STATE.jaulas = j.records || [];
    STATE.pichones = p.records || [];
    STATE.medicamentos = m.records || [];
    STATE.rutinas = r.records || [];
    STATE.planes = s.records || [];
    renderPage("dashboard");
  } catch (e) {
    console.error(e);
    showToast("Error cargando datos", "danger");
  }
}

function renderPage(page) {
  if (page === "dashboard") renderDashboard();
  if (page === "aves") renderAves();
  if (page === "jaulas") renderJaulas();
  if (page === "medicamentos") renderMedicamentos();
  if (page === "sanitario") renderSanitario();
  if (page === "rutinas") renderRutinas();
}

// ── DASHBOARD ──
function renderDashboard() {
  renderAlertas();
  renderStats();
  renderJaulasResumen();
  renderRutinasHoy();
}

function renderAlertas() {
  const alertas = calcularAlertas(STATE.jaulas, STATE.pichones);
  const cont = document.getElementById("alertas-container");
  if (!alertas.length) { cont.innerHTML = ""; return; }
  cont.innerHTML = `
    <div class="section-title">Alertas del Día</div>
    <div class="alertas-wrap">
      ${alertas.map(a => `
        <div class="alerta ${a.tipo}">
          <i class="ti ${a.icono}"></i>
          <span>${a.msg}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStats() {
  const aves = STATE.aves.filter(a => a.fields.estado === "Activo");
  const machos = aves.filter(a => a.fields.sexo === "Macho").length;
  const hembras = aves.filter(a => a.fields.sexo === "Hembra").length;
  const pichones = STATE.pichones.filter(p => p.fields.estado === "Vivo").length;
  const jaulasActivas = STATE.jaulas.filter(j =>
    ["Postura","Incubando","Con pichones"].includes(j.fields.estado_jaula)
  ).length;

  const razas = {};
  aves.forEach(a => {
    const r = a.fields.tipo_canario || "Sin clasificar";
    razas[r] = (razas[r] || 0) + 1;
  });
  const razaTop = Object.entries(razas).sort((a,b) => b[1]-a[1]).slice(0,3)
    .map(([r,n]) => `<span class="badge badge-green">${r} ×${n}</span>`).join(" ");

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Aves</div>
      <div class="stat-value">${aves.length}</div>
      <div class="stat-sub">activas en el criadero</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Machos / Hembras</div>
      <div class="stat-value">${machos}<span style="font-size:18px;color:#ccc"> / </span>${hembras}</div>
      <div class="stat-sub">adultos</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pichones Vivos</div>
      <div class="stat-value">${pichones}</div>
      <div class="stat-sub">en nidos activos</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Jaulas Activas</div>
      <div class="stat-value">${jaulasActivas}</div>
      <div class="stat-sub">en cría esta temporada</div>
    </div>
    <div class="stat-card" style="grid-column: span 2">
      <div class="stat-label">Tipos de Canario</div>
      <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap">${razaTop || '<span class="badge badge-gray">Sin datos</span>'}</div>
    </div>
  `;
}

function renderJaulasResumen() {
  const activas = STATE.jaulas.filter(j =>
    ["Postura","Incubando","Con pichones"].includes(j.fields.estado_jaula)
  ).slice(0, 5);
  const cont = document.getElementById("jaulas-resumen");
  if (!activas.length) {
    cont.innerHTML = '<div class="empty"><i class="ti ti-cage"></i>No hay jaulas activas</div>';
    return;
  }
  cont.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Jaula</th><th>Estado</th><th>Huevos</th><th>Días inc.</th></tr></thead>
      <tbody>
        ${activas.map(j => {
          const f = j.fields;
          const dias = diasDesde(f.fecha_inicio_incubacion);
          return `<tr>
            <td><span class="ring-id">${f.nro_jaula_fisica || "—"}</span></td>
            <td>${estadoBadge(f.estado_jaula)}</td>
            <td>${f.cantidad_huevos || 0}</td>
            <td>${dias !== null ? dias + " días" : "—"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderRutinasHoy() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const pendientes = STATE.rutinas.filter(r => {
    if (!r.fields.activa) return false;
    if (!r.fields.ultimo_realizado) return true;
    const ult = new Date(r.fields.ultimo_realizado); ult.setHours(0,0,0,0);
    const intervalo = r.fields.intervalo_dias || 1;
    const prox = new Date(ult); prox.setDate(prox.getDate() + intervalo);
    return prox <= hoy;
  });
  const cont = document.getElementById("rutinas-hoy");
  if (!pendientes.length) {
    cont.innerHTML = '<div class="empty"><i class="ti ti-check"></i>Todo al día</div>';
    return;
  }
  cont.innerHTML = pendientes.map(r => `
    <div style="display:flex; align-items:center; gap:12px; padding:11px 18px; border-bottom:1px solid var(--light-gray)">
      <i class="ti ti-clock" style="color:var(--amber)"></i>
      <div style="flex:1">
        <div style="font-size:13px; font-weight:500">${r.fields.descripcion}</div>
        <div style="font-size:11px; color:var(--mid-gray)">${r.fields.tipo} · ${r.fields.nivel_aplicacion || ""}</div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="marcarRutina('${r.id}')">Hecho</button>
    </div>
  `).join("");
}

// ── AVES ──
function renderAves() {
  const buscar = document.getElementById("buscar-ave")?.value?.toLowerCase() || "";
  const sexo = document.getElementById("filtro-sexo")?.value || "";
  document.getElementById("buscar-ave")?.addEventListener("input", renderAves);

  let aves = STATE.aves;
  if (sexo) aves = aves.filter(a => a.fields.sexo === sexo);
  if (buscar) aves = aves.filter(a =>
    (a.fields.nro_anillo || "").toLowerCase().includes(buscar) ||
    (a.fields.nombre || "").toLowerCase().includes(buscar)
  );

  if (!aves.length) {
    document.getElementById("aves-table").innerHTML = '<div class="empty"><i class="ti ti-feather"></i>No hay aves registradas</div>';
    return;
  }

  document.getElementById("aves-table").innerHTML = `
    <table class="data-table">
      <thead><tr><th>Anillo</th><th>Nombre</th><th>Sexo</th><th>Tipo</th><th>Edad</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        ${aves.map(a => {
          const f = a.fields;
          const meses = f.fecha_nacimiento ? Math.floor((new Date() - new Date(f.fecha_nacimiento)) / 2592000000) : null;
          const edad = meses !== null ? (meses >= 12 ? Math.floor(meses/12) + " años" : meses + " m") : "—";
          return `<tr>
            <td><span class="ring-id">${f.nro_anillo || "—"}</span></td>
            <td>${f.nombre || "—"}</td>
            <td>${sexoBadge(f.sexo)}</td>
            <td>${f.tipo_canario || "—"}</td>
            <td>${edad}</td>
            <td>${estadoBadge(f.estado)}</td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="modalAve('${a.id}')"><i class="ti ti-edit"></i></button>
              <button class="btn btn-sm btn-danger" onclick="eliminarAve('${a.id}')"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ── JAULAS ──
function renderJaulas() {
  const cont = document.getElementById("jaulas-grid");
  if (!STATE.jaulas.length) {
    cont.innerHTML = '<div class="empty"><i class="ti ti-cage"></i>No hay jaulas registradas</div>';
    return;
  }
  cont.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px">
      ${STATE.jaulas.map(j => {
        const f = j.fields;
        const diasInc = diasDesde(f.fecha_inicio_incubacion);
        const pichsJaula = STATE.pichones.filter(p => {
          const pf = p.fields;
          return pf.criador_id && pf.estado === "Vivo";
        });
        return `
          <div class="panel" style="margin:0">
            <div class="panel-header">
              <div>
                <div class="panel-title">Jaula ${f.nro_jaula_fisica || "—"}</div>
                <div style="font-size:11px; color:var(--mid-gray)">Puesta ${f.nro_puesta || 1} · ${f.temporada || "2025"}</div>
              </div>
              <div style="display:flex; gap:6px; align-items:center">
                ${estadoBadge(f.estado_jaula)}
                <button class="btn btn-sm btn-secondary" onclick="modalJaula('${j.id}')"><i class="ti ti-edit"></i></button>
              </div>
            </div>
            <div style="padding:14px 16px; display:flex; flex-direction:column; gap:8px; font-size:13px">
              <div style="display:flex; justify-content:space-between">
                <span style="color:var(--mid-gray)">1er huevo</span>
                <span>${formatDate(f.fecha_1er_huevo)}</span>
              </div>
              <div style="display:flex; justify-content:space-between">
                <span style="color:var(--mid-gray)">Inicio incubación</span>
                <span>${formatDate(f.fecha_inicio_incubacion)}</span>
              </div>
              <div style="display:flex; justify-content:space-between">
                <span style="color:var(--mid-gray)">Huevos / Gallados</span>
                <span>${f.cantidad_huevos || 0} / ${f.huevos_gallados || 0}</span>
              </div>
              ${diasInc !== null ? `
              <div style="display:flex; justify-content:space-between">
                <span style="color:var(--mid-gray)">Día de incubación</span>
                <span style="font-weight:500; color:${diasInc >= 13 ? 'var(--red)' : diasInc >= 5 ? 'var(--amber)' : 'var(--green)'}">${diasInc} / 14</span>
              </div>
              ` : ""}
              ${f.observaciones ? `<div style="color:var(--mid-gray); font-size:12px; font-style:italic">${f.observaciones}</div>` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ── MEDICAMENTOS ──
function renderMedicamentos() {
  const cont = document.getElementById("med-table");
  if (!STATE.medicamentos.length) {
    cont.innerHTML = '<div class="empty"><i class="ti ti-pill"></i>No hay medicamentos registrados</div>';
    return;
  }
  cont.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Nombre</th><th>Categoría</th><th>Dosis</th><th>Stock</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        ${STATE.medicamentos.map(m => {
          const f = m.fields;
          const diasVence = f.fecha_vencimiento ?
            Math.floor((new Date(f.fecha_vencimiento) - new Date()) / 86400000) : null;
          const stockPct = f.stock_inicial ? (f.stock_actual / f.stock_inicial * 100) : 100;
          const stockBadge = stockPct <= 20
            ? '<span class="badge badge-red">Stock bajo</span>'
            : '<span class="badge badge-green">OK</span>';
          const venceBadge = diasVence !== null
            ? diasVence < 0 ? '<span class="badge badge-red">Vencido</span>'
            : diasVence <= 30 ? '<span class="badge badge-amber">Pronto</span>'
            : `<span class="badge badge-gray">${formatDate(f.fecha_vencimiento)}</span>`
            : '<span class="badge badge-gray">—</span>';
          return `<tr>
            <td><strong>${f.nombre || "—"}</strong><br><span style="font-size:11px;color:var(--mid-gray)">${f.principio_activo || ""}</span></td>
            <td><span class="badge badge-blue">${f.categoria || "—"}</span></td>
            <td>${f.dosis || "—"} ${f.unidad_dosis || ""}</td>
            <td>${f.stock_actual || 0} ${f.unidad_stock || ""} ${stockBadge}</td>
            <td>${venceBadge}</td>
            <td>${diasVence !== null && diasVence < 0 ? '<span class="badge badge-red">Vencido</span>' : '<span class="badge badge-green">Activo</span>'}</td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="modalMedicamento('${m.id}')"><i class="ti ti-edit"></i></button>
              <button class="btn btn-sm btn-danger" onclick="eliminar('Medicamentos','${m.id}','medicamentos')"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ── PLAN SANITARIO ──
function renderSanitario() {
  const cont = document.getElementById("plan-table");
  if (!STATE.planes.length) {
    cont.innerHTML = '<div class="empty"><i class="ti ti-calendar-check"></i>No hay planes registrados</div>';
    return;
  }
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  cont.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Tratamiento</th><th>Nivel</th><th>Frecuencia</th><th>Meses</th><th>Última aplic.</th><th></th></tr></thead>
      <tbody>
        ${STATE.planes.map(p => {
          const f = p.fields;
          const mesesAplic = (f.meses_aplicacion || []).map(m => {
            const idx = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].indexOf(m);
            const activo = new Date().getMonth() === idx;
            return `<span class="badge ${activo ? 'badge-green' : 'badge-gray'}">${meses[idx] || m}</span>`;
          }).join(" ");
          return `<tr>
            <td><strong>${f.nombre_tratamiento || "—"}</strong></td>
            <td><span class="badge badge-blue">${f.nivel_aplicacion || "—"}</span></td>
            <td>${f.frecuencia || "—"}</td>
            <td style="max-width:200px">${mesesAplic}</td>
            <td>${formatDate(f.ultima_aplicacion)}</td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="eliminar('Plan_Sanitario','${p.id}','planes')"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ── RUTINAS ──
function renderRutinas() {
  const cont = document.getElementById("rutinas-table");
  if (!STATE.rutinas.length) {
    cont.innerHTML = '<div class="empty"><i class="ti ti-checklist"></i>No hay tareas configuradas</div>';
    return;
  }
  cont.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Tarea</th><th>Tipo</th><th>Frecuencia</th><th>Último</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        ${STATE.rutinas.map(r => {
          const f = r.fields;
          const hoy = new Date(); hoy.setHours(0,0,0,0);
          let vencida = false;
          if (f.ultimo_realizado) {
            const ult = new Date(f.ultimo_realizado); ult.setHours(0,0,0,0);
            const prox = new Date(ult); prox.setDate(prox.getDate() + (f.intervalo_dias || 1));
            vencida = prox <= hoy;
          } else { vencida = true; }
          return `<tr>
            <td><strong>${f.descripcion || "—"}</strong></td>
            <td><span class="badge badge-blue">${f.tipo || "—"}</span></td>
            <td>${f.frecuencia || "—"}${f.intervalo_dias ? ` (${f.intervalo_dias}d)` : ""}</td>
            <td>${formatDate(f.ultimo_realizado)}</td>
            <td>${vencida ? '<span class="badge badge-red">Pendiente</span>' : '<span class="badge badge-green">Al día</span>'}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="marcarRutina('${r.id}')">Hecho</button>
              <button class="btn btn-sm btn-danger" onclick="eliminar('Tareas_Rutina','${r.id}','rutinas')"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ── MODALES ──
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

function modalAve(id = null) {
  const m = document.getElementById("modal-ave");
  document.getElementById("ave-id").value = "";
  document.getElementById("ave-anillo").value = "";
  document.getElementById("ave-nombre").value = "";
  document.getElementById("ave-sexo").value = "Macho";
  document.getElementById("ave-nacimiento").value = "";
  document.getElementById("ave-tipo").value = "Postura";
  document.getElementById("ave-procedencia").value = "Propio";
  document.getElementById("ave-estado").value = "Activo";
  document.getElementById("ave-obs").value = "";
  document.getElementById("modal-ave-title").textContent = id ? "Editar Ave" : "Nueva Ave";

  if (id) {
    const ave = STATE.aves.find(a => a.id === id);
    if (ave) {
      const f = ave.fields;
      document.getElementById("ave-id").value = id;
      document.getElementById("ave-anillo").value = f.nro_anillo || "";
      document.getElementById("ave-nombre").value = f.nombre || "";
      document.getElementById("ave-sexo").value = f.sexo || "Macho";
      document.getElementById("ave-nacimiento").value = f.fecha_nacimiento || "";
      document.getElementById("ave-tipo").value = f.tipo_canario || "Postura";
      document.getElementById("ave-procedencia").value = f.procedencia || "Propio";
      document.getElementById("ave-estado").value = f.estado || "Activo";
      document.getElementById("ave-obs").value = f.observaciones || "";
    }
  }
  openModal("modal-ave");
}

async function guardarAve() {
  const id = document.getElementById("ave-id").value;
  const fields = {
    nro_anillo: document.getElementById("ave-anillo").value,
    nombre: document.getElementById("ave-nombre").value,
    sexo: document.getElementById("ave-sexo").value,
    fecha_nacimiento: document.getElementById("ave-nacimiento").value || null,
    tipo_canario: document.getElementById("ave-tipo").value,
    procedencia: document.getElementById("ave-procedencia").value,
    estado: document.getElementById("ave-estado").value,
    observaciones: document.getElementById("ave-obs").value,
  };
  try {
    if (id) {
      const r = await API.patch("Aves", id, fields);
      const idx = STATE.aves.findIndex(a => a.id === id);
      if (idx >= 0) STATE.aves[idx] = r;
    } else {
      const r = await API.post("Aves", fields);
      if (r.records) STATE.aves.push(...r.records);
    }
    closeModal("modal-ave");
    renderAves();
    renderStats();
    showToast(id ? "Ave actualizada" : "Ave registrada");
  } catch { showToast("Error al guardar", "danger"); }
}

async function eliminarAve(id) {
  if (!confirm("¿Eliminar esta ave?")) return;
  await eliminar("Aves", id, "aves");
}

function modalJaula(id = null) {
  ["jaula-id","jaula-nro","jaula-obs"].forEach(f => document.getElementById(f).value = "");
  document.getElementById("jaula-temporada").value = "2025";
  document.getElementById("jaula-puesta").value = "1";
  document.getElementById("jaula-estado").value = "Vacía";
  document.getElementById("jaula-1er-huevo").value = "";
  document.getElementById("jaula-incubacion").value = "";
  document.getElementById("jaula-huevos").value = "";
  document.getElementById("jaula-gallados").value = "";

  if (id) {
    const j = STATE.jaulas.find(j => j.id === id);
    if (j) {
      const f = j.fields;
      document.getElementById("jaula-id").value = id;
      document.getElementById("jaula-nro").value = f.nro_jaula_fisica || "";
      document.getElementById("jaula-temporada").value = f.temporada || "2025";
      document.getElementById("jaula-puesta").value = f.nro_puesta || "1";
      document.getElementById("jaula-estado").value = f.estado_jaula || "Vacía";
      document.getElementById("jaula-1er-huevo").value = f.fecha_1er_huevo || "";
      document.getElementById("jaula-incubacion").value = f.fecha_inicio_incubacion || "";
      document.getElementById("jaula-huevos").value = f.cantidad_huevos || "";
      document.getElementById("jaula-gallados").value = f.huevos_gallados || "";
      document.getElementById("jaula-obs").value = f.observaciones || "";
    }
  }
  openModal("modal-jaula");
}

async function guardarJaula() {
  const id = document.getElementById("jaula-id").value;
  const fields = {
    nro_jaula_fisica: document.getElementById("jaula-nro").value,
    temporada: document.getElementById("jaula-temporada").value,
    nro_puesta: document.getElementById("jaula-puesta").value,
    estado_jaula: document.getElementById("jaula-estado").value,
    fecha_1er_huevo: document.getElementById("jaula-1er-huevo").value || null,
    fecha_inicio_incubacion: document.getElementById("jaula-incubacion").value || null,
    cantidad_huevos: parseInt(document.getElementById("jaula-huevos").value) || 0,
    huevos_gallados: parseInt(document.getElementById("jaula-gallados").value) || 0,
    observaciones: document.getElementById("jaula-obs").value,
  };
  try {
    if (id) {
      const r = await API.patch("Jaulas_Cria", id, fields);
      const idx = STATE.jaulas.findIndex(j => j.id === id);
      if (idx >= 0) STATE.jaulas[idx] = r;
    } else {
      const r = await API.post("Jaulas_Cria", fields);
      if (r.records) STATE.jaulas.push(...r.records);
    }
    closeModal("modal-jaula");
    renderJaulas();
    renderDashboard();
    showToast(id ? "Jaula actualizada" : "Jaula registrada");
  } catch { showToast("Error al guardar", "danger"); }
}

function modalMedicamento(id = null) {
  ["med-id","med-nombre","med-lab","med-activo","med-dosis","med-dias","med-stock-ini","med-stock-act","med-indicaciones"].forEach(f => {
    const el = document.getElementById(f);
    if (el) el.value = "";
  });
  document.getElementById("med-vencimiento").value = "";
  if (id) {
    const m = STATE.medicamentos.find(m => m.id === id);
    if (m) {
      const f = m.fields;
      document.getElementById("med-id").value = id;
      document.getElementById("med-nombre").value = f.nombre || "";
      document.getElementById("med-lab").value = f.laboratorio || "";
      document.getElementById("med-activo").value = f.principio_activo || "";
      document.getElementById("med-cat").value = f.categoria || "Antibiótico";
      document.getElementById("med-dosis").value = f.dosis || "";
      document.getElementById("med-unidad-dosis").value = f.unidad_dosis || "ml/L agua";
      document.getElementById("med-dias").value = f.dias_tratamiento || "";
      document.getElementById("med-via").value = f.via_administracion || "Oral";
      document.getElementById("med-stock-ini").value = f.stock_inicial || "";
      document.getElementById("med-stock-act").value = f.stock_actual || "";
      document.getElementById("med-unidad-stock").value = f.unidad_stock || "ml";
      document.getElementById("med-vencimiento").value = f.fecha_vencimiento || "";
      document.getElementById("med-indicaciones").value = f.indicaciones || "";
    }
  }
  openModal("modal-medicamento");
}

async function guardarMedicamento() {
  const id = document.getElementById("med-id").value;
  const fields = {
    nombre: document.getElementById("med-nombre").value,
    laboratorio: document.getElementById("med-lab").value,
    principio_activo: document.getElementById("med-activo").value,
    categoria: document.getElementById("med-cat").value,
    dosis: document.getElementById("med-dosis").value,
    unidad_dosis: document.getElementById("med-unidad-dosis").value,
    dias_tratamiento: parseInt(document.getElementById("med-dias").value) || null,
    via_administracion: document.getElementById("med-via").value,
    stock_inicial: parseInt(document.getElementById("med-stock-ini").value) || 0,
    stock_actual: parseInt(document.getElementById("med-stock-act").value) || 0,
    unidad_stock: document.getElementById("med-unidad-stock").value,
    fecha_vencimiento: document.getElementById("med-vencimiento").value || null,
    indicaciones: document.getElementById("med-indicaciones").value,
    fecha_alta: new Date().toISOString().split("T")[0],
  };
  try {
    if (id) {
      const r = await API.patch("Medicamentos", id, fields);
      const idx = STATE.medicamentos.findIndex(m => m.id === id);
      if (idx >= 0) STATE.medicamentos[idx] = r;
    } else {
      const r = await API.post("Medicamentos", fields);
      if (r.records) STATE.medicamentos.push(...r.records);
    }
    closeModal("modal-medicamento");
    renderMedicamentos();
    showToast(id ? "Medicamento actualizado" : "Medicamento registrado");
  } catch { showToast("Error al guardar", "danger"); }
}

function modalPlan() { openModal("modal-plan"); }
function modalRutina(id = null) {
  ["rutina-id","rutina-desc"].forEach(f => document.getElementById(f).value = "");
  document.getElementById("rutina-intervalo").value = "1";
  if (id) {
    const r = STATE.rutinas.find(r => r.id === id);
    if (r) {
      const f = r.fields;
      document.getElementById("rutina-id").value = id;
      document.getElementById("rutina-desc").value = f.descripcion || "";
      document.getElementById("rutina-tipo").value = f.tipo || "Alimento";
      document.getElementById("rutina-nivel").value = f.nivel_aplicacion || "Todas las jaulas";
      document.getElementById("rutina-frecuencia").value = f.frecuencia || "Diaria";
      document.getElementById("rutina-intervalo").value = f.intervalo_dias || 1;
    }
  }
  openModal("modal-rutina");
}

async function guardarRutina() {
  const id = document.getElementById("rutina-id").value;
  const fields = {
    descripcion: document.getElementById("rutina-desc").value,
    tipo: document.getElementById("rutina-tipo").value,
    nivel_aplicacion: document.getElementById("rutina-nivel").value,
    frecuencia: document.getElementById("rutina-frecuencia").value,
    intervalo_dias: parseInt(document.getElementById("rutina-intervalo").value) || 1,
    activa: true,
  };
  try {
    if (id) {
      const r = await API.patch("Tareas_Rutina", id, fields);
      const idx = STATE.rutinas.findIndex(r => r.id === id);
      if (idx >= 0) STATE.rutinas[idx] = r;
    } else {
      const r = await API.post("Tareas_Rutina", fields);
      if (r.records) STATE.rutinas.push(...r.records);
    }
    closeModal("modal-rutina");
    renderRutinas();
    showToast("Tarea guardada");
  } catch { showToast("Error al guardar", "danger"); }
}

async function marcarRutina(id) {
  try {
    const r = await API.patch("Tareas_Rutina", id, {
      ultimo_realizado: new Date().toISOString().split("T")[0]
    });
    const idx = STATE.rutinas.findIndex(r => r.id === id);
    if (idx >= 0) STATE.rutinas[idx] = r;
    renderRutinas();
    renderRutinasHoy();
    showToast("Tarea marcada como realizada");
  } catch { showToast("Error", "danger"); }
}

// ── ELIMINAR GENÉRICO ──
async function eliminar(tabla, id, stateKey) {
  if (!confirm("¿Confirmar eliminación?")) return;
  try {
    await API.delete(tabla, id);
    STATE[stateKey] = STATE[stateKey].filter(r => r.id !== id);
    renderPage(stateKey === "aves" ? "aves" :
               stateKey === "jaulas" ? "jaulas" :
               stateKey === "medicamentos" ? "medicamentos" :
               stateKey === "rutinas" ? "rutinas" : "sanitario");
    showToast("Eliminado correctamente");
  } catch { showToast("Error al eliminar", "danger"); }
}

// ── HELPERS VISUAL ──
function estadoBadge(estado) {
  const map = {
    "Activo": "badge-green", "Vivo": "badge-green", "Con pichones": "badge-green",
    "Incubando": "badge-blue", "Postura": "badge-amber", "Armando nido": "badge-amber",
    "Vendido": "badge-blue", "Cedido": "badge-blue",
    "Muerto": "badge-gray", "Retirado": "badge-gray", "Vacía": "badge-gray", "Cerrada": "badge-gray",
  };
  return `<span class="badge ${map[estado] || 'badge-gray'}">${estado || "—"}</span>`;
}

function sexoBadge(sexo) {
  if (sexo === "Macho") return `<span style="color:var(--blue); font-weight:600">♂ M</span>`;
  if (sexo === "Hembra") return `<span style="color:var(--amber); font-weight:600">♀ H</span>`;
  return `<span style="color:var(--mid-gray)">?</span>`;
}

// Cerrar modales clickeando backdrop
document.querySelectorAll(".modal-backdrop").forEach(b => {
  b.addEventListener("click", e => { if (e.target === b) b.classList.remove("open"); });
});
