import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { showNotice, setBusy } from "./ui.js";

export function roleHome(role) {
  return ({ usuario: "usuario.html", tecnico: "tecnico.html", admin: "admin.html" })[role] || "index.html";
}

export async function getProfile(user) {
  const snapshot = await getDoc(doc(db, "usuarios", user.uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export function watchRole(allowedRoles) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("index.html");
      return;
    }
    try {
      const profile = await getProfile(user);
      if (!profile || !allowedRoles.includes(profile.rol)) {
        await signOut(auth);
        window.location.replace("index.html");
        return;
      }
      document.dispatchEvent(new CustomEvent("helpdesk:ready", { detail: { user, profile } }));
    } catch (error) {
      showNotice(`No se pudo cargar el perfil: ${error.message}`, "error");
    }
  });
}

export async function logout() {
  await signOut(auth);
  window.location.replace("index.html");
}

const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const modeButtons = document.querySelectorAll("[data-auth-mode]");

if (loginForm && registerForm) {
  modeButtons.forEach((button) => button.addEventListener("click", () => {
    const registering = button.dataset.authMode === "register";
    loginForm.hidden = registering;
    registerForm.hidden = !registering;
    modeButtons.forEach((item) => item.classList.toggle("active", item === button));
  }));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector("button[type=submit]");
    setBusy(button, true, "Ingresando...");
    try {
      const credentials = await signInWithEmailAndPassword(auth, loginForm.email.value.trim(), loginForm.password.value);
      const profile = await getProfile(credentials.user);
      if (!profile) throw new Error("Tu cuenta no tiene un perfil. Contacta al administrador.");
      window.location.href = roleHome(profile.rol);
    } catch (error) {
      showNotice(authMessage(error), "error");
    } finally { setBusy(button, false); }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = registerForm.querySelector("button[type=submit]");
    setBusy(button, true, "Creando cuenta...");
    try {
      const name = registerForm.nombre.value.trim();
      const email = registerForm.correo.value.trim();
      const role = registerForm.rol.value;
      const credentials = await createUserWithEmailAndPassword(auth, email, registerForm.password.value);
      await setDoc(doc(db, "usuarios", credentials.user.uid), {
        nombre: name, correo: email, rol: role, departamento: registerForm.departamento.value
      });
      window.location.href = roleHome(role);
    } catch (error) {
      showNotice(authMessage(error), "error");
    } finally { setBusy(button, false); }
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const profile = await getProfile(user);
      if (profile) window.location.replace(roleHome(profile.rol));
    } catch (error) { showNotice(authMessage(error), "error"); }
  });
}

function authMessage(error) {
  const messages = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email": "Escribe un correo válido."
  };
  return messages[error.code] || error.message || "Ocurrió un error. Intenta de nuevo.";
}