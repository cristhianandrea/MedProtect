# Sprint de la semana — Flujo médico integral

**Objetivo:** convertir MedProtect en un flujo clínico de extremo a extremo:

**Registro/Login del médico → Dashboard → Buscar paciente → Consulta y diagnóstico → Receta vinculada → Impresión/PDF → Consulta completada.**

Stack: frontend HTML/CSS/JS vanilla, backend Node.js + Express, persistencia en JSON (`backend/data/`).

---

## Cómo exponerlo (guion de 5–8 minutos)

1. Abrir `frontend/index.html` y mostrar el portal (paciente y médico).
2. Registrar o iniciar sesión como **médico** (cédula profesional).
3. Recorrer las pestañas del **dashboard médico**.
4. Buscar un paciente, llenar consulta y guardar.
5. Mostrar la receta precargada, firmar y guardar.
6. Volver al historial: estado **Completada** + folio.
7. (Opcional) abrir **Mi perfil** y actualizar datos.
8. Cerrar con los endpoints nuevos del backend.

**Arranque técnico**

```bash
cd backend
npm install
npm start
```

Abrir `frontend/index.html` (Live Server o el navegador). API en `http://localhost:5000`.

---

## Secciones que se crearon

### 1. Backend de consultas

**Archivos:** `backend/server.js`, `backend/data/consultations.json`

| Endpoint | Qué hace |
|---|---|
| `POST /api/consultations` | Crea consulta (`CON-{timestamp}`), signos vitales, diagnóstico, estado `Pendiente` |
| `GET /api/consultations` | Lista filtrada por `doctorId` o `patientId` |
| `GET /api/consultations/:id` | Detalle de una consulta |
| `PUT /api/consultations/:id/prescription` | Vincula receta y marca `Completada` |

**Qué decir:** las consultas ya no viven solo en el navegador; quedan persistidas y se pueden consultar después.

---

### 2. Búsqueda de pacientes

**Endpoint:** `GET /api/patients?q=...`

Busca en `users.json` por nombre o CURP y **no** expone contraseñas.

**Qué decir:** el médico trabaja con pacientes reales del sistema, no con datos inventados en pantalla.

---

### 3. Cliente HTTP

**Archivo:** `frontend/api-client.js`

Métodos nuevos: `getPatients`, `createConsultation`, `getConsultations`, `getConsultationById`, `linkPrescriptionToConsultation`, más perfil del médico.

Si el backend no responde, hay fallback a `localStorage` para no romper la demo.

---

### 4. Registro y login del médico

**Archivos:** `frontend/index.html`, `frontend/script.js`

- Registro real con `MedConnectAPI.register('doctor', ...)`.
- Login con cédula y redirección a `medico-dashboard.html`.

**Qué decir:** se acabó el login simulado; el médico entra a su propio portal.

---

### 5. Dashboard médico — pestañas

**Archivo nuevo:** `frontend/medico-dashboard.html`

| Pestaña | Sección | Qué muestra |
|---|---|---|
| **Inicio** | Cabecera del médico | Nombre, cédula, especialidad, hospital, cerrar sesión |
| **Consultas** | Buscador + ficha + formulario | Buscar por nombre/CURP, signos vitales (IMC automático), motivo, exploración, diagnóstico. Botón *Guardar consulta y continuar con receta* |
| **Recetas** | Acceso al módulo de receta | Emisión electrónica vinculada a la consulta |
| **Historial** | Tabla de consultas | Insignia `Pendiente` / `Completada` + folio; continuar o ver receta |
| **Mi perfil** | Datos profesionales | `GET` / `PUT /api/doctor/profile` |

Estética: Plus Jakarta Sans, paleta `#347072` / `#2D6061` / `#1E2B37`. Iconografía en `ui-icons.css` y `ui-icons.js`.

---

### 6. Receta vinculada a la consulta

**Archivo:** `frontend/medico-receta.html`

- Lee `?consultationId=` y precarga paciente, alergias, diagnóstico y datos del médico.
- Botón *Volver a Consultas*.
- Al guardar, `POST /api/prescriptions` recibe `consultationId` y cierra el ciclo (consulta `Completada` + folio).

---

### 7. PDF e impresión

- Folios consecutivos anuales.
- Vista previa e impresión (`@media print`).
- Endpoint `GET /api/prescriptions/:folio/pdf` (dependencia `pdfkit`).

---

## Flujo que deben ver en la demo

```text
index.html
  → login médico
    → medico-dashboard.html
      → seleccionar paciente
      → guardar consulta
        → medico-receta.html?consultationId=CON-...
          → medicamentos + firma
          → receta con folio
        → historial: Completada
```

---

## Archivos clave de este sprint

| Archivo | Tipo |
|---|---|
| `frontend/medico-dashboard.html` | Nuevo — portal clínico |
| `frontend/ui-icons.css` / `ui-icons.js` | Nuevo — iconos de UI |
| `backend/data/consultations.json` | Nuevo — persistencia de consultas |
| `backend/server.js` | Consultas, pacientes, receta vinculada, PDF |
| `frontend/api-client.js` | Cliente de las APIs nuevas |
| `frontend/script.js` | Registro/login médico reales |
| `frontend/medico-receta.html` | Precarga y retorno al dashboard |
| `implementation_plan.md` | Plan por fases (F1–F10) |

---

## Qué no se rompió

El portal del **paciente**, menores y **citas** se mantienen. No se introdujeron frameworks (React/Vue).
