import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { storage } from "./firebase.js";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function uploadIncidentImage(averiaId, file, prefix) {
  if (!file) throw new Error("Selecciona una imagen.");
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("La imagen debe pesar menos de 5 MB.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectRef = ref(storage, `incidencias/${averiaId}/${prefix}_${Date.now()}_${safeName}`);
  await uploadBytes(objectRef, file, { contentType: file.type });
  return getDownloadURL(objectRef);
}