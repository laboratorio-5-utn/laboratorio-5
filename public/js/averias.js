import {
  addDoc, collection, doc, serverTimestamp, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";
import { uploadIncidentImage } from "./storage.js";

export async function createAveria(form, user, profile) {
  const image = form.imagenReporte.files[0];
  if (!image) throw new Error("La fotografía del daño es obligatoria.");
  const averiaRef = doc(collection(db, "averias"));
  const imagenReporteUrl = await uploadIncidentImage(averiaRef.id, image, "reporte");
  await setDoc(averiaRef, {
    titulo: form.titulo.value.trim(),
    descripcion: form.descripcion.value.trim(),
    tipo: form.tipo.value,
    departamento: form.departamento.value,
    creadoPor: user.uid,
    nombreUsuario: profile.nombre,
    imagenReporteUrl,
    estado: "pendiente",
    fechaCreacion: serverTimestamp()
  });
}

export async function assignAveria(averiaId, technician) {
  await updateDoc(doc(db, "averias", averiaId), {
    tecnicoAsignado: technician.id,
    nombreTecnico: technician.nombre,
    fechaAsignacion: serverTimestamp(),
    estado: "asignado"
  });
}

export async function addFollowup(averiaId, user, form) {
  const image = form.imagenEvidencia.files[0];
  const imagenEvidenciaUrl = image ? await uploadIncidentImage(averiaId, image, "seguimiento") : "";
  await addDoc(collection(db, "averias", averiaId, "seguimientos"), {
    tecnicoId: user.uid,
    observacion: form.observacion.value.trim(),
    imagenEvidenciaUrl,
    fecha: serverTimestamp()
  });
}

export async function resolveAveria(averiaId, form) {
  const image = form.imagenSolucion.files[0];
  if (!image) throw new Error("Adjunta una foto del resultado de la corrección.");
  const imagenSolucionUrl = await uploadIncidentImage(averiaId, image, "solucion");
  await updateDoc(doc(db, "averias", averiaId), {
    imagenSolucionUrl,
    fechaResolucion: serverTimestamp(),
    estado: "resuelto"
  });
}

export async function validateSolution(averiaId, accepted, reason = "") {
  if (!accepted && !reason.trim()) throw new Error("Escribe el motivo del rechazo.");
  await updateDoc(doc(db, "averias", averiaId), accepted ? {
    conformidad: true,
    motivoRechazo: "",
    estado: "cerrado"
  } : {
    conformidad: false,
    motivoRechazo: reason.trim(),
    estado: "asignado"
  });
}