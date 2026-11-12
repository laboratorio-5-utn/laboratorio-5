export function showNotice(message, type = "info", target = "global-alert") {
  const host = document.getElementById(target);
  if (!host) return;
  host.innerHTML = `<div class="notice notice-${type}" role="alert">${escapeHtml(message)}</div>`;
  window.setTimeout(() => { host.innerHTML = ""; }, 5500);
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

export function formatDate(value) {
  if (!value) return "Pendiente";
  const date = value.toDate ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function statusLabel(status = "pendiente") {
  return ({ pendiente: "Pendiente", asignado: "En atención", resuelto: "Resuelto", cerrado: "Cerrado" })[status] || status;
}

export function renderStatus(status = "pendiente") {
  return `<span class="status status-${escapeHtml(status)}">${statusLabel(status)}</span>`;
}

export function setBusy(button, busy, busyText = "Procesando...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}