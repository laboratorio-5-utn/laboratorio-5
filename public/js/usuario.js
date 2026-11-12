import { collection, onSnapshot, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";
import { watchRole, logout } from "./auth.js";
import { createAveria, validateSolution } from "./averias.js";
import { escapeHtml, formatDate, renderStatus, showNotice, setBusy } from "./ui.js";

const reportForm = document.querySelector("#report-form");
const tickets = document.querySelector("#tickets");
document.querySelector("#logout").addEventListener("click", logout);
document.addEventListener("helpdesk:ready", ({ detail: { user, profile } }) => {
  document.querySelector("#user-name").textContent = profile.nombre;
  reportForm.departamento.value = profile.departamento || "TI";
  reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = reportForm.querySelector("button[type=submit]"); setBusy(button, true, "Enviando...");
    try { await createAveria(reportForm, user, profile); reportForm.reset(); reportForm.departamento.value = profile.departamento || "TI"; showNotice("Reporte enviado correctamente.", "success"); }
    catch (error) { showNotice(error.message, "error"); }
    finally { setBusy(button, false); }
  });
  const reportsQuery = query(collection(db, "averias"), where("creadoPor", "==", user.uid), orderBy("fechaCreacion", "desc"));
  onSnapshot(reportsQuery, (snapshot) => {
    if (snapshot.empty) { tickets.innerHTML = '<div class="empty-state"><div class="empty-icon">+</div><strong>Aún no tienes reportes</strong><br>Al enviar uno, aparecerá aquí.</div>'; return; }
    tickets.innerHTML = snapshot.docs.map((item) => ticketMarkup(item.id, item.data())).join("");
    tickets.querySelectorAll("[data-followups]").forEach((box) => listenFollowups(box.dataset.followups, box));
    tickets.querySelectorAll("[data-accept]").forEach((button) => button.addEventListener("click", () => confirmSolution(button.dataset.accept, true)));
    tickets.querySelectorAll("[data-reject-start]").forEach((button) => button.addEventListener("click", () => {
      const form = tickets.querySelector(`[data-reject-form="${CSS.escape(button.dataset.rejectStart)}"]`);
      form.hidden = false;
      button.hidden = true;
      form.querySelector("textarea").focus();
    }));
    tickets.querySelectorAll("[data-reject-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try { await validateSolution(form.dataset.rejectForm, false, form.motivo.value); showNotice("Rechazo enviado al técnico.", "success"); }
        catch (error) { showNotice(error.message, "error"); }
      });
      form.querySelector("[data-cancel-reject]").addEventListener("click", () => {
        form.hidden = true;
        const button = tickets.querySelector(`[data-reject-start="${CSS.escape(form.dataset.rejectForm)}"]`);
        if (button) button.hidden = false;
      });
    });
  }, (error) => showNotice(`No se pudieron cargar tus reportes: ${error.message}`, "error"));
});

function ticketMarkup(id, item) {
  const solution = item.estado === "resuelto" ? `<div class="detail-box"><strong>Solución propuesta</strong><br><img class="solution-image" src="${escapeHtml(item.imagenSolucionUrl || "")}" alt="Imagen de la solución"><div class="ticket-actions"><button class="btn btn-primary btn-small" data-accept="${escapeHtml(id)}">Aceptar conformidad</button><button class="btn btn-danger btn-small" data-reject-start="${escapeHtml(id)}">Rechazar solución</button></div><form class="detail-box" data-reject-form="${escapeHtml(id)}" hidden><div class="field"><label>Motivo del rechazo</label><textarea name="motivo" maxlength="1500" required placeholder="Explica qué parte del problema continúa..."></textarea></div><div class="ticket-actions"><button class="btn btn-danger btn-small" type="submit">Enviar rechazo</button><button class="btn btn-outline btn-small" type="button" data-cancel-reject>Cancelar</button></div></form></div>` : "";
  return `<article class="ticket"><div class="ticket-head"><div><h3>${escapeHtml(item.titulo)}</h3><span class="hint">${escapeHtml(item.tipo)} · ${escapeHtml(item.departamento)}</span></div>${renderStatus(item.estado)}</div><div class="ticket-meta"><span>Creado: ${formatDate(item.fechaCreacion)}</span><span>Técnico: ${escapeHtml(item.nombreTecnico || "Por asignar")}</span></div><p>${escapeHtml(item.descripcion)}</p>${item.imagenReporteUrl ? `<img class="evidence-image" src="${escapeHtml(item.imagenReporteUrl)}" alt="Imagen del reporte">` : ""}${solution}<div class="detail-box"><h3>Bitácora de seguimiento</h3><div data-followups="${escapeHtml(id)}" class="followup-list"><span class="hint">Cargando seguimientos...</span></div></div></article>`;
}

function listenFollowups(id, host) {
  onSnapshot(query(collection(db, "averias", id, "seguimientos"), orderBy("fecha", "desc")), (snapshot) => {
    host.innerHTML = snapshot.empty ? '<span class="hint">Aún no hay actualizaciones.</span>' : snapshot.docs.map((item) => {
      const data = item.data();
      return `<div class="followup"><strong>${escapeHtml(data.observacion)}</strong><br><small>${formatDate(data.fecha)}</small>${data.imagenEvidenciaUrl ? `<br><img class="evidence-image" src="${escapeHtml(data.imagenEvidenciaUrl)}" alt="Evidencia del seguimiento">` : ""}</div>`;
    }).join("");
  });
}

async function confirmSolution(id, accepted) {
  try { await validateSolution(id, accepted); showNotice("Conformidad registrada. Incidencia cerrada.", "success"); }
  catch (error) { showNotice(error.message, "error"); }
}

watchRole(["usuario"]);