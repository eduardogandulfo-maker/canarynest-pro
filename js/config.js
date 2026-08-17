const CONFIG = {
  WORKER_URL: "https://canarynest-api.eduardogandulfo.workers.dev",
  WEATHER_URL: "https://api.open-meteo.com/v1/forecast",
};

// API helper
async function api(method, table, data = null, recordId = "") {
  const user = netlifyIdentity.currentUser();
  if (!user) throw new Error("No autenticado");
  const token = user.token.access_token;
  const url = `${CONFIG.WORKER_URL}/api/${table}${recordId ? "/" + recordId : ""}`;
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (data) opts.body = JSON.stringify(data);
  const res = await fetch(url, opts);
  return res.json();
}

const API = {
  get: (table, id = "") => api("GET", table, null, id),
  post: (table, fields) => api("POST", table, { fields }),
  patch: (table, id, fields) => api("PATCH", table, { fields }, id),
  delete: (table, id) => api("DELETE", table, null, id),
};

// Clima via Open-Meteo (sin API key)
async function getWeather(lat = -34.6037, lon = -58.3816) {
  try {
    const url = `${CONFIG.WEATHER_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    return {
      temp: Math.round(data.current.temperature_2m),
      humidity: data.current.relative_humidity_2m,
      code: data.current.weather_code,
    };
  } catch {
    return { temp: "--", humidity: "--", code: 0 };
  }
}

function weatherIcon(code) {
  if (code === 0) return "ti-sun";
  if (code <= 3) return "ti-cloud";
  if (code <= 67) return "ti-cloud-rain";
  if (code <= 77) return "ti-snowflake";
  return "ti-cloud-storm";
}

// Alertas del día
function calcularAlertas(jaulas, pichones) {
  const alertas = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (const j of jaulas) {
    const f = j.fields;
    if (!f.fecha_inicio_incubacion) continue;
    const incubacion = new Date(f.fecha_inicio_incubacion);
    incubacion.setHours(0, 0, 0, 0);
    const diasInc = Math.floor((hoy - incubacion) / 86400000);

    if (diasInc === 5 && !f.alerta_gallado_enviada) {
      alertas.push({ tipo: "warning", icono: "ti-eye", msg: `Controlar gallado — Jaula ${f.nro_jaula_fisica}`, jaula: j.id });
    }
    if (diasInc === 13 && !f.alerta_nacimiento_enviada) {
      alertas.push({ tipo: "info", icono: "ti-egg", msg: `Nacimiento esperado hoy — Jaula ${f.nro_jaula_fisica}`, jaula: j.id });
    }
    if (diasInc >= 15 && !f.alerta_nacimiento_enviada) {
      alertas.push({ tipo: "danger", icono: "ti-alert-triangle", msg: `Revisar urgente, día ${diasInc} — Jaula ${f.nro_jaula_fisica}`, jaula: j.id });
    }
  }

  for (const p of pichones) {
    const f = p.fields;
    if (!f.fecha_nacimiento || f.estado !== "Vivo") continue;
    const nac = new Date(f.fecha_nacimiento);
    nac.setHours(0, 0, 0, 0);
    const dias = Math.floor((hoy - nac) / 86400000);
    const jaula = f.nro_jaula || "?";

    if ([1, 2, 3].includes(dias) && !f[`alerta_d${dias}_ok`]) {
      alertas.push({ tipo: "info", icono: "ti-feather", msg: `Control pichón día ${dias} — Jaula ${jaula}`, pichon: p.id });
    }
    if (dias >= 6 && dias <= 8 && !f.alerta_anillo_ok) {
      alertas.push({ tipo: "warning", icono: "ti-circle", msg: `Colocar anillo — Jaula ${jaula} (día ${dias})`, pichon: p.id });
    }
    if (dias === 20 && !f.alerta_d20_ok) {
      alertas.push({ tipo: "info", icono: "ti-home", msg: `Controlar nido nueva postura — Jaula ${jaula}`, pichon: p.id });
    }
  }

  return alertas;
}

// Utilidades
function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function diasDesde(str) {
  if (!str) return null;
  const d = new Date(str);
  d.setHours(0, 0, 0, 0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy - d) / 86400000);
}

function showToast(msg, tipo = "success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast-${tipo} show`;
  setTimeout(() => t.classList.remove("show"), 3000);
}
