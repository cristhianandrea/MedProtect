
##  Estructura del Backend

```
MedConnectApi/
├── data/                      # Persistencia JSON local
│   ├── users.json             # Usuarios (Pacientes, Menores, Médicos, Clínicas)
│   ├── appointments.json      # Citas médicas activas e históricas
│   └── medications.json       # Medicamentos y recetas
├── images/                    # Recursos de imágenes estáticas y carrusel
│   └── README.txt             # Guía de formatos de imágenes
├── server.js                  # Servidor REST API en Node.js / Express
├── dev-api-server.ps1         # Servidor API nativo Windows (.NET HttpListener)
├── package.json               # Dependencias del servidor (express, cors, dotenv)
├── .env                       # Variables de configuración
└── README.md                  # Este documento
```

---

##  Endpoints REST Disponibles

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado de salud de la API y tiempo activo |
| `GET` | `/api/carousel` | Datos y rutas de imágenes para el carrusel de la portada |
| `POST` | `/api/auth/login` | Autenticación multi-rol (`patient`, `minor`, `doctor`, `clinic`) |
| `POST` | `/api/auth/register` | Registro de nuevos usuarios y expedientes |
| `GET` | `/api/patient/profile` | Información del perfil del paciente activo |
| `GET` | `/api/appointments` | Listado de citas médicas del paciente |
| `POST` | `/api/appointments` | Agendar una nueva cita médica |
| `PUT` | `/api/appointments/:id` | Reprogramar fecha/hora de una cita |
| `DELETE` | `/api/appointments/:id` | Cancelar una cita existente |
| `GET` | `/api/medications` | Lista de medicamentos activos y crónicos |
| `GET` | `/images/:filename` | Servidor estático de imágenes médicas |
