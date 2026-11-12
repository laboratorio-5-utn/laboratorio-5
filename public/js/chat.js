import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";
import { escapeHtml, formatDate, showNotice } from "./ui.js";

export function ensureChat(averiaId, averia, profile) {
  return setDoc(doc(db, "chats", averiaId), {
    averiaId,
    averiaTitulo: averia.titulo,
    tecnicoId: averia.tecnicoAsignado,
    nombreTecnico: averia.nombreTecnico,
    ultimoMensaje: "",
    fechaActualizacion: serverTimestamp()
  }, { merge: true });
}

export function bindChat(container, averiaId, profile) {
  const messageList = container.querySelector(".chat-messages");
  const form = container.querySelector(".chat-form");
  const messagesQuery = query(collection(db, "chats", averiaId, "mensajes"), orderBy("fecha", "asc"));
  const stop = onSnapshot(messagesQuery, (snapshot) => {
    messageList.innerHTML = snapshot.docs.map((messageDoc) => {
      const message = messageDoc.data();
      const mine = message.remitenteId === profile.uid;
      return `<div class="message ${mine ? "mine" : ""}"><div>${escapeHtml(message.texto)}</div><small>${escapeHtml(message.rolRemitente)} · ${formatDate(message.fecha)}</small></div>`;
    }).join("") || '<div class="empty-state">Aún no hay mensajes.</div>';
    messageList.scrollTop = messageList.scrollHeight;
  }, (error) => showNotice(`No se pudo cargar el chat: ${error.message}`, "error"));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = form.elements.texto;
    const text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    try {
      const chatRef = doc(db, "chats", averiaId);
      const chatSnapshot = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").then(({ getDoc }) => getDoc(chatRef));
      const chat = chatSnapshot.data() || {};
      await addDoc(collection(db, "chats", averiaId, "mensajes"), {
        remitenteId: profile.uid,
        rolRemitente: profile.rol,
        texto: text,
        fecha: serverTimestamp()
      });
      await setDoc(chatRef, { ...chat, ultimoMensaje: text, fechaActualizacion: serverTimestamp() }, { merge: true });
      input.value = "";
    } catch (error) { showNotice(`No se pudo enviar el mensaje: ${error.message}`, "error"); }
    finally { input.disabled = false; input.focus(); }
  });
  return stop;
}

export function startAdminChat(container, profile) {
  const list = container.querySelector(".chat-list");
  const thread = container.querySelector(".chat-thread");
  let selectedStop = null;
  let selectedId = null;
  const stopList = onSnapshot(collection(db, "chats"), (snapshot) => {
    const chats = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    list.innerHTML = chats.length ? chats.map((chat) => `<button class="chat-thread-button ${selectedId === chat.id ? "active" : ""}" data-chat-id="${escapeHtml(chat.id)}"><strong>${escapeHtml(chat.averiaTitulo || "Avería")}</strong><span>${escapeHtml(chat.id)} · ${escapeHtml(chat.ultimoMensaje || "Sin mensajes")}</span></button>`).join("") : '<div class="empty-state">No hay conversaciones.</div>';
    list.querySelectorAll("[data-chat-id]").forEach((button) => button.addEventListener("click", () => {
      const chat = chats.find((item) => item.id === button.dataset.chatId);
      if (chat) select(chat);
    }));
    if (!selectedId && chats.length) select(chats[0]);
  }, (error) => showNotice(`No se pudieron cargar las conversaciones: ${error.message}`, "error"));

  function select(chat) {
    selectedId = chat.id;
    if (selectedStop) selectedStop();
    list.querySelectorAll(".chat-thread-button").forEach((button) => button.classList.toggle("active", button.dataset.chatId === chat.id));
    thread.innerHTML = `<div class="panel-title"><div><h3>${escapeHtml(chat.averiaTitulo || "Avería")}</h3><span class="hint">${escapeHtml(chat.id)} · Técnico: ${escapeHtml(chat.nombreTecnico || "Sin asignar")}</span></div></div><div class="chat-messages"></div><form class="chat-form"><input name="texto" maxlength="2000" placeholder="Responder al técnico..." aria-label="Mensaje" required><button class="btn btn-primary" type="submit">Enviar</button></form>`;
    selectedStop = bindChat(thread, chat.id, { ...profile, rol: "admin" });
  }
  return () => { stopList(); if (selectedStop) selectedStop(); };
}