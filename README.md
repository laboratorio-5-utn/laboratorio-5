# Help Desk TI

Aplicación web de reportes de averías e incidencias con Firebase Authentication, Cloud Firestore, Cloud Storage, Firebase Hosting y Google Charts. La interfaz usa HTML, módulos ES y Bootstrap 5 por CDN.

## Configuración de Firebase

1. En Firebase Console, abre el proyecto `laboratorio-5-e547`.
2. En **Authentication → Método de acceso**, habilita **Correo electrónico/contraseña**.
3. En **Firestore Database**, crea la base de datos en modo de producción y selecciona una ubicación cercana. Despliega las reglas de este repositorio con Firebase CLI.
4. En **Storage**, crea el bucket. Si Firebase solicita facturación, revisa las condiciones mostradas en la consola antes de habilitarla.
5. En **Configuración del proyecto → General → Tus apps**, copia la configuración de la aplicación web y reemplaza los valores `YOUR_*` de `public/js/firebase-config.js`.
6. Para las pruebas del laboratorio, crea una cuenta seleccionando el rol administrador; crea después otras cuentas de usuario y técnico. La selección de rol abierta está habilitada solo para facilitar el laboratorio.

La configuración web de Firebase se utiliza en el navegador y no es una clave privada. No agregues claves de cuentas de servicio al frontend.

## Probar localmente

Sirve la carpeta `public` desde un servidor HTTP; no abras los HTML mediante `file://`, porque los módulos ES requieren un origen HTTP:

```bash
cd public
python -m http.server 8000
```

Abre `http://localhost:8000`. También puedes usar cualquier servidor estático equivalente.

## Desplegar

Instala Node.js y Firebase CLI, inicia sesión y despliega desde la raíz del proyecto:

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

El proyecto predeterminado está indicado en `.firebaserc`. `firebase deploy` publica Hosting y despliega las reglas e índices configurados en `firebase.json`.

## Modelo de datos

- `usuarios/{uid}`: `nombre`, `correo`, `rol`, `departamento`.
- `averias/{averiaId}`: reporte, asignación, resolución y conformidad.
- `averias/{averiaId}/seguimientos/{seguimientoId}`: bitácora técnica.
- `chats/{averiaId}` y `chats/{averiaId}/mensajes/{mensajeId}`: conversación asociada a la avería.
- Las imágenes se guardan bajo `incidencias/{averiaId}/`.

Las reglas de Firestore restringen los reportes al creador, técnico asignado y administrador. Las reglas de Storage exigen usuario autenticado, imagen y tamaño menor a 5 MB en `incidencias/`.

## Nota de seguridad

El registro permite elegir `admin` para facilitar las pruebas solicitadas en el laboratorio. **No uses este flujo en producción**: cualquiera podría darse privilegios administrativos. Para producción, elimina la opción del formulario y asigna ese rol desde un proceso controlado por un administrador o un entorno confiable.