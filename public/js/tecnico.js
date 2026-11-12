import { collection, doc, onSnapshot, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";
import { watchRole, logout } from "./auth.js";
import { addFollowup, resolveAveria } from "./averias.js";
import { ensureChat, bindChat } from "./chat.js";
import { escapeHtml, formatDate, renderStatus, showNotice, setBusy } from "./ui.js";

const list = document.querySelector("#assigned-list");
const chatArea = document.querySelector("#chat-area");
let activeChatStop = null;
document.querySelector("#logout").addEventListener("click", logout);
document.querySelector("#close-chat").addEventListener("click", () => { chatArea.hidden = true; if (activeChatStop) activeChatStop(); });

document.addEventListener("helpdesk:ready", ({ detail: { user, profile } }) => {
  document.querySelector("#user-name").textContent = profile.nombre;
  const assignedQuery = query(collection(db, "averias"), where("tecnicoAsignado", "==", user.uid), orderBy("fechaAsignacion", "desc"));
  onSnapshot(assignedQuery, (snapshot) => {
    list.innerHTML = snapshot.empty ? '<div class="empty-state"><strong>Sin averías asignadas</strong><br>Las nuevas asignaciones aparecerán aquí.</div>' : snapshot.docs.map((item) => renderTicket(item.id, item.data())).join("");
    bindTicketActions(user, profile);
  }, (error) => showNotice(`No se pudieron cargar las asignaciones: ${error.message}`, "error"));

  function bindTicketActions(activeUser, activeProfile) {
    list.querySelectorAll("[data-followup-form]").forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault(); const button = form.querySelector("button[type=submit]"); setBusy(button, true, "Guardando...");
      try { await addFollowup(form.dataset.followupForm, activeUser, form); form.reset(); showNotice("Seguimiento agregado.", "success"); }
      catch (error) { showNotice(error.message, "error"); } finally { setBusy(button, false); }
    }));
    list.querySelectorAll("[data-solve-form]").forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault(); const button = form.querySelector("button[type=submit]"); setBusy(button, true, "Resolviendo...");
      try { await resolveAveria(form.dataset.solveForm, form); showNotice("Avería marcada como resuelta. El usuario debe validar la solución.", "success"); }
      catch (error) { showNotice(error.message, "error"); } finally { setBusy(button, false); }
    }));
    list.querySelectorAll("[data-open-chat]").forEach((button) => button.addEventListener("click", async () => {
      const item = snapshot.docs.find((entry) => entry.id === button.dataset.openChat);
      if (!item) return;
      try {
        const averia = { id: item.id, ...item.data() };
        await ensureChat(item.id, averia, activeProfile);
        chatArea.hidden = false;
        const thread = document.querySelector("#chat-thread");
        thread.innerHTML = `<div class="panel-title"><div><h3>${escapeHtml(averia.titulo)}</h3><span class="hint">Conversación privada con administración</span></div></div><div class="chat-messages"></div><form class="chat-form"><input name="texto" maxlength="2000" placeholder="Escribe al administrador..." aria-label="Mensaje" required><button class="btn btn-primary" type="submit">Enviar</button></form>`;
        if (activeChatStop) activeChatStop();
        activeChatStop = bindChat(thread, item.id, activeProfile);
        chatArea.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) { showNotice(`No se pudo abrir el chat: ${error.message}`, "error"); }
    }));
  }
});

function renderTicket(id, item) {
  return `<article class="ticket"><div class="ticket-head"><div><h2>${escapeHtml(item.titulo)}</h2><span class="hint">${escapeHtml(item.tipo)} · ${escapeHtml(item.departamento)} · ${escapeHtml(item.nombreUsuario)}</span></div>${renderStatus(item.estado)}</div><div class="ticket-meta"><span>Asignada: ${formatDate(item.fechaAsignacion)}</span><span>Reportada: ${formatDate(item.fechaCreacion)}</span></div><p>${escapeHtml(item.descripcion)}</p>${item.motivoRechazo ? `<div class="notice notice-error"><strong>Motivo de rechazo anterior:</strong> ${escapeHtml(item.motivoRechazo)}</div>` : ""}${item.imagenReporteUrl ? `<img class="evidence-image" src="${escapeHtml(item.imagenReporteUrl)}" alt="Evidencia reportada">` : ""}<div class="detail-box"><h3>Agregar seguimiento</h3><form data-followup-form="${escapeHtml(id)}"><div class="field"><label>Observación</label><textarea name="observacion" maxlength="2000" required placeholder="Trabajo realizado, diagnóstico o próximo paso"></textarea></div><div class="field"><label>Foto de evidencia (opcional)</label><input name="imagenEvidencia" type="file" accept="image/*"><span class="hint">Máximo 5 MB.</span></div><button class="btn btn-soft btn-small" type="submit">Guardar seguimiento</button></form></div>${item.estado !== "cerrado" && item.estado !== "resuelto" ? `<div class="detail-box"><h3>Resolver incidencia</h3><form data-solve-form="${escapeHtml(id)}"><div class="field"><label>Foto del resultado final (obligatoria)</label><input name="imagenSolucion" type="file" accept="image/*" required><span class="hint">Máximo 5 MB.</span></div><button class="btn btn-primary btn-small" type="submit">Marcar como resuelta</button></form></div>` : ""}<div class="ticket-actions"><button class="btn btn-outline btn-small" data-open-chat="${escapeHtml(id)}">Abrir chat con Admin</button></div></article>`;
}

watchRole(["tecnico"]);