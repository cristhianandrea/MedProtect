# 🏥 MedProtect

Plataforma integral médica con portal web interactivo para pacientes y médicos, acompañada de una API REST backend para gestión de usuarios, citas, recetas y expedientes clínicos.

---

## 📁 Estructura del Proyecto

```text
MedProtect/
├── backend/            # API REST (Node.js / Express)
│   ├── data/           # Almacenamiento JSON local (usuarios, citas, recetas)
│   ├── server.js       # Servidor principal y endpoints de la API
│   ├── package.json    # Dependencias y scripts del backend
│   └── .env.example    # Plantilla de variables de entorno
└── frontend/           # Portal Web (HTML5, CSS3, JavaScript)
    ├── index.html      # Página principal y login multi-rol
    ├── paciente-dashboard.html # Panel de control del paciente
    ├── medico-receta.html      # Gestión y emisión de recetas médicas
    ├── api-client.js   # Cliente HTTP para conexión con la API
    ├── script.js       # Lógica de interfaz y control de sesión
    └── styles.css      # Sistema de diseño e interfaz
```

---

## 🚀 Inicio Rápido

### 1. Iniciar Backend
```bash
cd backend
npm install
npm start
```
*El servidor iniciará en `http://localhost:5000`.*

### 2. Iniciar Frontend
Abre `frontend/index.html` en tu navegador o utilizando Live Server en VS Code.

---

## 🛠️ Tecnologías
- **Frontend**: HTML5, CSS3 moderno, JavaScript (ES6+).
- **Backend**: Node.js, Express, CORS, JSON Web Tokens (JWT).
