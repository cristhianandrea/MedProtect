

## Estructura del Proyecto

```text
MedProtect/
├── SPRINT.md           # Cómo exponer el sprint y cada sección
├── implementation_plan.md
├── backend/            # API REST (Node.js / Express)
│   ├── data/           # JSON local (usuarios, citas, consultas, recetas)
│   ├── server.js       # Servidor principal y endpoints de la API
│   ├── package.json    # Dependencias y scripts del backend
│   └── .env.example    # Plantilla de variables de entorno
└── frontend/           # Portal Web (HTML5, CSS3, JavaScript)
    ├── index.html              # Página principal y login multi-rol
    ├── medico-dashboard.html   # Portal del médico: consulta, historial, perfil
    ├── medico-receta.html      # Receta electrónica vinculada a la consulta
    ├── paciente-dashboard.html # Panel de control del paciente
    ├── api-client.js           # Cliente HTTP para conexión con la API
    ├── script.js               # Lógica de interfaz y control de sesión
    ├── styles.css              # Sistema de diseño e interfaz
    ├── ui-icons.css
    └── ui-icons.js
```

---


##  Tecnologías
- **Frontend**: HTML5, CSS3 moderno, JavaScript (ES6+).
- **Backend**: Node.js, Express, CORS, JSON Web Tokens (JWT).
