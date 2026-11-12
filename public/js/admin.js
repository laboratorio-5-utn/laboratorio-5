import { collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";
import { watchRole, logout } from "./auth.js";
import { assignAveria } from "./averias.js";
import { startAdminChat } from "./chat.js";
import { escapeHtml, formatDate, showNotice } from "./ui.js";

const queue = document.querySelector("#queue");
const filter = document.querySelector("#date-filter");
const startInput = filter.inicio;
const endInput = filter.fin;
const today = new Date();
startInput.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
endInput.value = today.toISOString().slice(0, 10);
document.querySelector("#logout").addEventListener("click", logout);

let technicians = [];
let allReports = [];
let adminProfile;

document.addEventListener("helpdesk:ready", ({ detail: { user, profile } }) => {
  adminProfile = profile;
  document.querySelector("#user-name").textContent = profile.nombre;
  startAdminChat(document.querySelector("#admin-chat"), { ...profile, uid: user.uid });
  onSnapshot(query(collection(db, "usuarios"), where("rol", "==", "tecnico")), (snapshot) => {
    technicians = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderQueue();
  }, (error) => showNotice(`No se pudo cargar el equipo técnico: ${error.message}`, "error"));
  onSnapshot(query(collection(db, "averias"), where("estado", "==", "pendiente")), (snapshot) => {
    window.pendingReports = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderQueue();
  }, (error) => showNotice(`No se pudo cargar la cola: ${error.message}`, "error"));
  onSnapshot(collection(db, "averias"), (snapshot) => {
    allReports = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    drawStats();
  }, (error) => showNotice(`No se pudieron cargar las estadísticas: ${error.message}`, "error"));
});

function renderQueue() {
  const pending = window.pendingReports || [];
  document.querySelector("#queue-count").textContent = `${pending.length} pendientes`;
  if (!pending.length) { queue.innerHTML = '<div class="empty-state">La cola está al día. No hay reportes pendientes.</div>'; return; }
  queue.innerHTML = pending.map((item) => `<article class="ticket"><div class="ticket-head"><div><h3>${escapeHtml(item.titulo)}</h3><span class="hint">${escapeHtml(item.tipo)} · ${escapeHtml(item.departamento)} · ${escapeHtml(item.nombreUsuario)}</span></div><span class="status status-pendiente">Pendiente</span></div><div class="ticket-meta"><span>Recibida: ${formatDate(item.fechaCreacion)}</span></div><p>${escapeHtml(item.descripcion)}</p>${item.imagenReporteUrl ? `<img class="evidence-image" src="${escapeHtml(item.imagenReporteUrl)}" alt="Imagen del reporte">` : ""}<div class="ticket-actions"><select aria-label="Seleccionar técnico" data-technician-for="${escapeHtml(item.id)}"><option value="">Selecciona técnico...</option>${technicians.map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.nombre)} (${escapeHtml(person.departamento || "TI")})</option>`).join("")}</select><button class="btn btn-primary btn-small" data-assign="${escapeHtml(item.id)}" ${technicians.length ? "" : "disabled"}>Asignar</button></div></article>`).join("");
  queue.querySelectorAll("[data-assign]").forEach((button) => button.addEventListener("click", async () => {
    const select = queue.querySelector(`[data-technician-for="${CSS.escape(button.dataset.assign)}"]`);
    const person = technicians.find((tech) => tech.id === select.value);
    if (!person) { showNotice("Selecciona un técnico para asignar el reporte.", "error"); return; }
    button.disabled = true;
    try { await assignAveria(button.dataset.assign, person); showNotice(`Reporte asignado a ${person.nombre}.`, "success"); }
    catch (error) { showNotice(`No se pudo asignar: ${error.message}`, "error"); button.disabled = false; }
  }));
}

filter.addEventListener("submit", (event) => { event.preventDefault(); drawStats(); });

function drawStats() {
  if (!allReports.length && !window.google?.charts) return;
  const from = new Date(`${startInput.value || "1900-01-01"}T00:00:00`);
  const to = new Date(`${endInput.value || "2999-12-31"}T23:59:59.999`);
  if (from > to) { showNotice("La fecha inicial debe ser anterior a la fecha final.", "error"); return; }
  const reports = allReports.filter((item) => {
    const created = asDate(item.fechaCreacion);
    return created && created >= from && created <= to;
  });
  const hardware = reports.filter((item) => item.tipo === "hardware").length;
  const software = reports.filter((item) => item.tipo === "software").length;
  const resolved = reports.filter((item) => item.fechaResolucion && item.tecnicoAsignado);
  const durationMinutes = (item) => {
    const start = asDate(item.fechaAsignacion) || asDate(item.fechaCreacion);
    const finish = asDate(item.fechaResolucion);
    return start && finish ? Math.max(0, (finish - start) / 60000) : null;
  };
  document.querySelector("#stats-metrics").innerHTML = `<div class="metric"><strong>${reports.length}</strong><span>Incidencias en el rango</span></div><div class="metric"><strong>${hardware}</strong><span>Hardware · ${percent(hardware, reports.length)}%</span></div><div class="metric"><strong>${software}</strong><span>Software · ${percent(software, reports.length)}%</span></div>`;

  const departments = [...new Set(reports.map((item) => item.departamento || "Sin departamento"))].sort();
  const departmentRows = departments.map((department) => {
    const subset = reports.filter((item) => item.departamento === department);
    const hw = subset.filter((item) => item.tipo === "hardware").length;
    const sw = subset.filter((item) => item.tipo === "software").length;
    return [department, hw, `${percent(hw, subset.length)}%`, sw, `${percent(sw, subset.length)}%`, subset.length, `${percent(subset.length, reports.length)}%`];
  });
  renderTable("department-table", ["Departamento", "Hardware", "% hardware", "Software", "% software", "Total", "% del total"], departmentRows);

  const technicianIds = [...new Set(resolved.map((item) => item.tecnicoAsignado))].sort();
  const technicianRows = technicianIds.map((technicianId) => {
    const subset = resolved.filter((item) => item.tecnicoAsignado === technicianId);
    const hw = subset.map(durationMinutes).filter((value, index) => Number.isFinite(value) && subset[index].tipo === "hardware");
    const sw = subset.map(durationMinutes).filter((value, index) => Number.isFinite(value) && subset[index].tipo === "software");
    return [subset[0].nombreTecnico || "Técnico", averageMinutes(hw), averageMinutes(sw)];
  });
  const resolutionRows = resolved.map((item) => [item.titulo, item.nombreTecnico || "Técnico", item.tipo, durationMinutes(item) === null ? "-" : `${durationMinutes(item).toFixed(1)} min`, formatDate(item.fechaResolucion)]);
  renderTable("resolution-table", ["Avería", "Técnico", "Tipo", "Tiempo", "Resuelta"], resolutionRows);

  if (!window.google?.charts) return;
  window.google.charts.load("current", { packages: ["corechart", "bar"] });
  window.google.charts.setOnLoadCallback(() => {
    const deptData = new google.visualization.DataTable();
    deptData.addColumn("string", "Departamento"); deptData.addColumn("number", "Hardware"); deptData.addColumn("number", "Software");
    deptData.addRows(departments.map((department) => {
      const subset = reports.filter((item) => item.departamento === department);
      return [department, subset.filter((item) => item.tipo === "hardware").length, subset.filter((item) => item.tipo === "software").length];
    }));
    new google.visualization.ColumnChart(document.querySelector("#department-chart")).draw(deptData, chartOptions("#1f6b58"));
    const typeData = google.visualization.arrayToDataTable([["Tipo", "Total"], ["Hardware", hardware], ["Software", software]]);
    new google.visualization.PieChart(document.querySelector("#type-chart")).draw(typeData, { ...chartOptions(), pieHole: .52, colors: ["#1f6b58", "#d85e46"], legend: { position: "bottom" } });
    const techData = new google.visualization.DataTable();
    techData.addColumn("string", "Técnico"); techData.addColumn("number", "Hardware (min)"); techData.addColumn("number", "Software (min)");
    techData.addRows(technicianRows);
    new google.visualization.BarChart(document.querySelector("#technician-chart")).draw(techData, { ...chartOptions("#276b83"), bars: "horizontal" });
  });
}

function renderTable(elementId, headers, rows) {
  const host = document.getElementById(elementId);
  host.innerHTML = rows.length ? `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : '<div class="empty-state">No hay datos para el rango elegido.</div>';
}

function asDate(value) { return value?.toDate ? value.toDate() : value ? new Date(value) : null; }
function percent(value, total) { return total ? (value / total * 100).toFixed(1) : "0.0"; }
function averageMinutes(values) { return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0; }
function chartOptions(color = "#1f6b58") { return { height: 300, colors: [color, "#d85e46"], chartArea: { width: "82%", height: "72%" }, legend: { position: "bottom" }, fontName: "DM Sans", backgroundColor: "transparent" }; }

watchRole(["admin"]);