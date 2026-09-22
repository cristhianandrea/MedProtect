# Plan de Implementación: Flujo Médico Integral MedProtect

Convertir el proyecto actual en un flujo clínico funcional de extremo a extremo:
**Médico → Registro/Login → Dashboard → Buscar/Seleccionar Paciente → Crear Consulta & Diagnóstico → Generar Receta Vinculada → Visualización/Impresión → Consulta Completada.**

---

## Restricciones y Principios Arquitectónicos
- **Tecnologías:** Frontend Vanilla JavaScript (ES6+), HTML5, Vanilla CSS3 (`styles.css`). Backend Node.js + Express.
- **Persistencia:** Archivos locales JSON en `backend/data/`.
- **Integridad:** No romper el flujo existente de pacientes, menores o citas. No introducir frameworks como React/Vue. No hardcodear entidades para el flujo real.

---

## Cambios Propuestos por Fase

### FASE 1: Consultas en Backend
#### [NEW] [consultations.json](file:///c:/Users/caah2/OneDrive/Escritorio/MedProtect/backend/data/consultations.json)
- Inicializar como arreglo vacío `[]`.

#### [MODIFY] [server.js](file:///c:/Users/caah2/OneDrive/Escritorio/MedProtect/backend/server.js)
- Definir `const consultationsFile = path.join(dataDir, 'consultations.json');`.
- Implementar:
  - `POST /api/consultations`: Genera `CON-${Date.now()}`, valida campos mínimos, asocia `doctorId`, `doctorName`, `doctorLicense`, `patientId`, `patientName`, `patientCurp`, `vitals`, `reason`, `symptoms`, `physicalExam`, `diagnosis`, `status: "Pendiente"`, `prescriptionId: null`, `prescriptionFolio: null`.
  - `GET /api/consultations`: Soporta filtros `?doctorId=...` y `?patientId=...` y devuelve lista ordenada por fecha descendente.
  - `GET /api/consultations/:id`: Devuelve la consulta específica por su ID.
  - `PUT /api/consultations/:id/prescription`: Asocia `prescriptionId` y `prescriptionFolio`, cambiando `status` a `"Completada"`.

---

### FASE 2: Pacientes en Backend
#### [MODIFY] [server.js](file:///c:/Users/caah2/OneDrive/Escritorio/MedProtect/backend/server.js)
- Implementar `GET /api/patients`:
  - Permite buscar pacientes registrados en `users.json` (`users.patients`).
  - Soporta filtro `?q=...` que busca por nombre completo o CURP.
  - Omite contraseñas y datos sensibles de autenticación (`password` se excluye).

---

### FASE 3: Cliente HTTP (`api-client.js`)
#### [MODIFY] [api-client.js](file:///c:/Users/caah2/OneDrive/Escritorio/MedProtect/frontend/api-client.js)
- Agregar al objeto `MedConnectAPI`:
  - `getPatients(query)`: Petición a `/api/patients?q=${encodeURIComponent(query)}`.
  - `createConsultation(consultationData)`: `POST /api/consultations`.
  - `getConsultations(filters)`: `GET /api/consultations?...`.
  - `getConsultationById(id)`: `GET /api/consultations/${id}`.
  - `linkPrescriptionToConsultation(id, prescriptionId, folio)`: `PUT /api/consultations/${id}/prescription`.
  - Mantener fallback ordenado a `localStorage` para robustez.

---

### FASE 4: Registro y Login del Médico en Frontend
#### [MODIFY] [script.js](file:///c:/Users/caah2/OneDrive/Escritorio/MedProtect/frontend/script.js)
- **Registro Médico Real:**
  - En `registerDoctorForm`, reemplazar el `setTimeout` simulado por una llamada real a `window.MedConnectAPI.register('doctor', doctorPayload)`.
  - Enviar: `name` (nombre completo), `firstName`, `lastNameP`, `lastNameM`, `curp`, `professionalId` (Cédula), `specialty`, `clinicName` (hospital), `phone`, `email`, `password`.
  - Al completar el registro, guardar y mostrar mensaje con opción de iniciar sesión.
- **Login Médico con Redirección:**
  - En `doctorLoginForm`, tras autenticar con éxito (`loginRes.ok`), guardar usuario activo en sesión y redirigir inmediatamente a: `medico-dashboard.html`.

---

### FASE 5: Dashboard del Médico
#### [NEW] [medico-dashboard.html](file:///c:/Users/caah2/OneDrive/Escritorio/MedProtect/frontend/medico-dashboard.html)
- Integrado con la estética médica de MedProtect (`Plus Jakarta Sans`, paleta `#347072`, `#2D6061`, `#1E2B37`).
- **Sección A: Cabecera Dinámica del Médico**
  - Nombre, Cédula Profesional, Especialidad, Hospital/Clínica cargados desde el usuario autenticado (`localStorage` / `GET /api/doctor/profile`).
  - Botón para cerrar sesión (`btnLogoutDoctor`).
- **Sección B: Selector / Buscador de Pacientes**
  - Input de búsqueda interactiva (por Nombre o CURP).
  - Listado de coincidencias con botón "Seleccionar para Consulta".
  - Opción rápida para registrar un paciente nuevo o usar pacientes existentes en la base de datos.
- **Sección C: Formulario de Consulta Médica**
  - Ficha del paciente seleccionado (Nombre, CURP, Edad, Alergias).
  - Captura de Signos Vitales (Presión arterial, FC, Temp, Peso, Talla, IMC automático).
  - Motivo de consulta y síntomas / anamnesis.
  - Exploración física.
  - Diagnóstico clínico.
- **Sección D: Botón de Acción Principal**
  - *"Guardar Consulta y Continuar con Receta"*:
    - Valida datos mínimos.
    - Ejecuta `POST /api/consultations`.
    - Redirige a `medico-receta.html?consultationId=${consultationId}`.
- **Sección E: Historial de Consultas del Médico**
  - Tabla de consultas realizadas por el médico.
  - Insignias de estado: `Pendiente` (amarillo) vs `Completada` (verde con folio de receta asociado).
  - Acción para ver receta si ya fue completada o continuar con receta si está pendiente.
- **Sección F: Módulo "Mi Perfil" (Fase 10)**
  - Formulario para consultar y actualizar perfil profesional usando `GET /api/doctor/profile` y `PUT /api/doctor/profile`.

---

### FASE 6 & FASE 9: Integración de `medico-receta.html`
#### [MODIFY] [medico-receta.html](file:///c:/Users/caah2/OneDrive/Escritorio/MedProtect/frontend/medico-receta.html)
- **Lectura de Parámetro `consultationId`:**
  - Extraer `consultationId` de `window.location.search`.
  - Si existe `consultationId`, solicitar los datos de la consulta mediante `MedConnectAPI.getConsultationById(consultationId)`.
  - Precargar automáticamente:
    - Paciente: Nombre, CURP, Alergias registradas.
    - Diagnóstico en el bloque de observaciones.
    - Médico: Nombre, Cédula Profesional, Especialidad y Clínica del médico activo en sesión.
- **Botón de Retorno:**
  - Agregar botón *"← Volver a Consultas"* en la cabecera y en el modal de receta, redirigiendo a `medico-dashboard.html`.

---

### FASE 7 & FASE 8: Guardado de Receta, Vinculación y PDF
#### [MODIFY] [server.js](file:///c:/Users/caah2/OneDrive/Escritorio/MedProtect/backend/server.js)
- En `POST /api/prescriptions`:
  - Aceptar `consultationId`, `patientId`, `doctorId`, `diagnosis`.
  - Persistir estos identificadores en `prescriptions.json`.
  - Si viene `consultationId`, actualizar automáticamente `consultations.json`:
    - `prescriptionId: newPrescription.id`
    - `prescriptionFolio: assignedFolio`
    - `status: "Completada"`
    - `updatedAt: new Date().toISOString()`
- Mantener la generación de folios consecutivos anuales y el modal con `@media print` para exportación directa a PDF e impresión.

---

## Plan de Verificación

### Pruebas Automatizadas y de Backend
- Iniciar backend en `localhost:5000`.
- Ejecutar suite de pruebas con scripts de verificación HTTP:
  - Registro de médico de prueba (`POST /api/auth/register`).
  - Login de médico (`POST /api/auth/login`).
  - Registro de paciente de prueba.
  - Búsqueda de paciente (`GET /api/patients?q=...`).
  - Creación de consulta (`POST /api/consultations`).
  - Consulta de consulta por ID (`GET /api/consultations/:id`).
  - Emisión de receta vinculada (`POST /api/prescriptions`).
  - Verificación de que la consulta cambió a status "Completada".

### Pruebas de Flujo en el Navegador (Browser Subagent)
1. Abrir `index.html`.
2. Registrar un médico nuevo con cédula profesional.
3. Iniciar sesión con esa cédula y verificar redirección a `medico-dashboard.html`.
4. Verificar que la cabecera muestra la información del médico en sesión.
5. Buscar y seleccionar un paciente.
6. Llenar los datos de la consulta y diagnóstico.
7. Presionar *"Guardar consulta y continuar con receta"*.
8. Verificar apertura de `medico-receta.html?consultationId=...` con datos precargados.
9. Agregar medicamentos, firmar digitalmente en el canvas y guardar receta.
10. Verificar vista previa y botón de retorno al dashboard.
11. Regresar a `medico-dashboard.html` y confirmar que la consulta figura como "Completada" con su folio.
12. Abrir la pestaña "Mi Perfil" y editar datos para comprobar `PUT /api/doctor/profile`.
