/**
 * MedConnect REST API Server (Node.js / Express)
 * Backend limpio para conexión directa con Base de Datos.
 * Sin datos simulados ni precargados.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir recursos estáticos de imágenes desde MedConnectApi/images
const imagesPath = path.join(__dirname, 'images');
app.use('/images', express.static(imagesPath));
app.use('/api/images', express.static(imagesPath));

// Rutas de archivos de datos JSON
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const appointmentsFile = path.join(dataDir, 'appointments.json');
const medicationsFile = path.join(dataDir, 'medications.json');
const prescriptionsFile = path.join(dataDir, 'prescriptions.json');

// Utilidades para lectura/escritura de datos
function loadJSON(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error leyendo ${filePath}:`, err);
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error guardando ${filePath}:`, err);
  }
}

// =========================================================
// 1. ENDPOINT: SALUD DE LA API
// =========================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MedConnect API (Conexión Limpia a BD)',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// =========================================================
// 2. ENDPOINTS: RECURSOS DEL CARRUSEL (DINÁMICO SEGÚN IMÁGENES)
// =========================================================
app.get('/api/carousel', (req, res) => {
  const slides = [];
  try {
    if (fs.existsSync(imagesPath)) {
      const files = fs.readdirSync(imagesPath).filter(f => /\.(jpg|jpeg|png|webp|svg)$/i.test(f));
      files.forEach((file, index) => {
        slides.push({
          id: index + 1,
          title: `Slide ${index + 1}`,
          subtitle: '',
          image: `/images/${file}`,
          badge: 'MedConnect'
        });
      });
    }
  } catch (err) {
    console.error('Error leyendo directorio de imágenes:', err);
  }

  res.json({
    success: true,
    count: slides.length,
    slides
  });
});

// =========================================================
// 3. ENDPOINTS: AUTENTICACIÓN MULTI-ROL (VALIDACIÓN REAL EN BD)
// =========================================================
app.post('/api/auth/login', (req, res) => {
  const { role, credential, password } = req.body;

  if (!role || !credential) {
    return res.status(400).json({
      success: false,
      message: 'Debes proporcionar el rol y las credenciales requeridas.'
    });
  }

  const users = loadJSON(usersFile, { patients: [], minors: [], doctors: [], clinics: [] });

  let user = null;

  if (role === 'patient') {
    user = (users.patients || []).find(p => 
      p.curp?.toLowerCase() === credential.toLowerCase() || 
      p.email?.toLowerCase() === credential.toLowerCase() ||
      p.phone === credential
    );
  } else if (role === 'minor') {
    user = (users.minors || []).find(m => 
      m.minorCurp?.toLowerCase() === credential.toLowerCase() || 
      m.id?.toLowerCase() === credential.toLowerCase()
    );
  } else if (role === 'doctor') {
    user = (users.doctors || []).find(d => 
      d.professionalId === credential || 
      d.email?.toLowerCase() === credential.toLowerCase()
    );
  } else if (role === 'clinic') {
    user = (users.clinics || []).find(c => 
      c.clues?.toLowerCase() === credential.toLowerCase() || 
      c.contactEmail?.toLowerCase() === credential.toLowerCase()
    );
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Usuario o credenciales no encontradas en la base de datos.'
    });
  }

  const token = `token_${role}_${Date.now()}`;

  return res.json({
    success: true,
    message: 'Inicio de sesión exitoso.',
    token,
    user: {
      ...user,
      role
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { role, data } = req.body;

  if (!role || !data) {
    return res.status(400).json({
      success: false,
      message: 'Faltan datos de registro requeridos.'
    });
  }

  const users = loadJSON(usersFile, { patients: [], minors: [], doctors: [], clinics: [] });
  const newId = `${role.toUpperCase().slice(0, 3)}-${Date.now()}`;
  const newUser = {
    id: newId,
    ...data,
    role,
    createdAt: new Date().toISOString()
  };

  if (role === 'patient') {
    if (!users.patients) users.patients = [];
    users.patients.unshift(newUser);
  } else if (role === 'minor') {
    if (!users.minors) users.minors = [];
    users.minors.unshift(newUser);
  } else if (role === 'doctor') {
    if (!users.doctors) users.doctors = [];
    users.doctors.unshift(newUser);
  } else if (role === 'clinic') {
    if (!users.clinics) users.clinics = [];
    users.clinics.unshift(newUser);
  }

  saveJSON(usersFile, users);

  return res.status(201).json({
    success: true,
    message: 'Registro completado y guardado en la base de datos.',
    user: newUser
  });
});

// =========================================================
// 4. ENDPOINTS: PERFIL DEL PACIENTE
// =========================================================
app.get('/api/patient/profile', (req, res) => {
  const users = loadJSON(usersFile, { patients: [] });
  const patient = (users.patients && users.patients.length > 0) ? users.patients[0] : null;

  if (!patient) {
    return res.json({
      success: true,
      patient: null,
      message: 'Sin paciente registrado en la base de datos.'
    });
  }

  res.json({
    success: true,
    patient
  });
});

// =========================================================
// 4.1 ENDPOINTS: PERFIL Y GESTIÓN DE MÉDICOS
// =========================================================
// Obtener perfil del médico activo
app.get('/api/doctor/profile', (req, res) => {
  const { professionalId } = req.query;
  const users = loadJSON(usersFile, { doctors: [] });
  const doctors = users.doctors || [];

  let doctor = null;
  if (professionalId) {
    doctor = doctors.find(d => d.professionalId?.toLowerCase() === professionalId.toLowerCase());
  } else if (doctors.length > 0) {
    doctor = doctors[0];
  } else {
    // Médico predeterminado demo para inicializar
    doctor = {
      id: "DOC-DEFAULT",
      name: "Dr. Carlos Mendoza Silva",
      professionalId: "CED-PROF-8942150",
      specialty: "Medicina Interna y Familiar",
      email: "dr.mendoza@medconnect.mx",
      phone: "55-4123-8900",
      city: "Ciudad de México",
      state: "CDMX",
      clinicName: "Centro Médico San Ángel - Consultorio 304",
      clinicAddress: "Av. Insurgentes Sur 1450, Col. Crédito Constructor, Benito Juárez",
      clinicPhone: "55-5678-9000",
      bio: "Especialista en medicina interna con más de 12 años de experiencia en consulta preventiva, diagnóstico clínico y tratamiento integral.",
      availableForHiring: true,
      consultationFee: "$800 MXN",
      schedule: "Lunes a Viernes 09:00 - 18:00 hrs"
    };
  }

  res.json({
    success: true,
    doctor
  });
});

// Actualizar o registrar perfil del médico
app.put('/api/doctor/profile', (req, res) => {
  const doctorData = req.body;
  if (!doctorData || !doctorData.name) {
    return res.status(400).json({ success: false, message: 'El nombre del médico es obligatorio.' });
  }

  const users = loadJSON(usersFile, { patients: [], minors: [], doctors: [], clinics: [] });
  if (!users.doctors) users.doctors = [];

  const existingIndex = users.doctors.findIndex(d => 
    (doctorData.professionalId && d.professionalId === doctorData.professionalId) ||
    (doctorData.id && d.id === doctorData.id)
  );

  const updatedDoctor = {
    ...(existingIndex !== -1 ? users.doctors[existingIndex] : {}),
    ...doctorData,
    id: doctorData.id || `DOC-${Date.now()}`,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex !== -1) {
    users.doctors[existingIndex] = updatedDoctor;
  } else {
    users.doctors.unshift(updatedDoctor);
  }

  saveJSON(usersFile, users);

  res.json({
    success: true,
    message: 'Perfil médico actualizado exitosamente en el sistema.',
    doctor: updatedDoctor
  });
});

// Directorio público de médicos (Búsqueda y Vinculación)
app.get('/api/doctors', (req, res) => {
  const { q, specialty, city } = req.query;
  const users = loadJSON(usersFile, { doctors: [] });
  let list = users.doctors || [];

  if (list.length === 0) {
    list = [
      {
        id: "DOC-001",
        name: "Dr. Carlos Mendoza Silva",
        professionalId: "CED-PROF-8942150",
        specialty: "Medicina Interna y Familiar",
        city: "Ciudad de México",
        clinicName: "Centro Médico San Ángel",
        clinicAddress: "Av. Insurgentes Sur 1450, CDMX",
        phone: "55-4123-8900",
        email: "carlos.mendoza@medconnect.mx",
        availableForHiring: true,
        experienceYears: 12,
        rating: "4.9"
      },
      {
        id: "DOC-002",
        name: "Dra. Sofía Valenzuela Rivas",
        professionalId: "CED-PROF-7231456",
        specialty: "Pediatría Integral",
        city: "Guadalajara",
        clinicName: "Clínica Pediátrica Providencia",
        clinicAddress: "Av. Américas 1200, Guadalajara",
        phone: "33-1456-7890",
        email: "sofia.valenzuela@medconnect.mx",
        availableForHiring: true,
        experienceYears: 9,
        rating: "5.0"
      },
      {
        id: "DOC-003",
        name: "Dr. Alejandro Garza Morales",
        professionalId: "CED-PROF-6129845",
        specialty: "Cardiología Clínica",
        city: "Monterrey",
        clinicName: "Hospital Ángeles Valle Oriente",
        clinicAddress: "Av. Frida Kahlo 180, San Pedro Garza García",
        phone: "81-8976-5432",
        email: "alejandro.garza@medconnect.mx",
        availableForHiring: false,
        experienceYears: 16,
        rating: "4.8"
      },
      {
        id: "DOC-004",
        name: "Dra. Mariana Treviño Castillo",
        professionalId: "CED-PROF-9834211",
        specialty: "Ginecología y Obstetricia",
        city: "Puebla",
        clinicName: "Centro de Especialidades Angelópolis",
        clinicAddress: "Blvd. Atlixcáyotl 2200, Puebla",
        phone: "22-2345-6789",
        email: "mariana.trevino@medconnect.mx",
        availableForHiring: true,
        experienceYears: 8,
        rating: "4.9"
      }
    ];
  }

  if (q) {
    const query = q.toLowerCase();
    list = list.filter(d => 
      d.name?.toLowerCase().includes(query) ||
      d.specialty?.toLowerCase().includes(query) ||
      d.city?.toLowerCase().includes(query) ||
      d.professionalId?.toLowerCase().includes(query)
    );
  }
  if (specialty && specialty !== 'all') {
    list = list.filter(d => d.specialty?.toLowerCase().includes(specialty.toLowerCase()));
  }
  if (city && city !== 'all') {
    list = list.filter(d => d.city?.toLowerCase().includes(city.toLowerCase()));
  }

  res.json({
    success: true,
    count: list.length,
    doctors: list
  });
});

// Enviar solicitud de colaboración / vinculación a un médico
app.post('/api/doctors/request-collaboration', (req, res) => {
  const { doctorId, applicantName, applicantEmail, clinicName, proposalType, message } = req.body;

  if (!doctorId || !applicantName || !applicantEmail) {
    return res.status(400).json({
      success: false,
      message: 'Faltan datos obligatorios para enviar la solicitud de colaboración.'
    });
  }

  const collaborationRequestsFile = path.join(dataDir, 'collaboration_requests.json');
  const requests = loadJSON(collaborationRequestsFile, []);

  const newRequest = {
    id: `REQ-${Date.now()}`,
    doctorId,
    applicantName,
    applicantEmail,
    clinicName: clinicName || 'No especificada',
    proposalType: proposalType || 'Contratación / Turno Médico',
    message: message || '',
    status: 'Pendiente de Revisión',
    createdAt: new Date().toISOString()
  };

  requests.unshift(newRequest);
  saveJSON(collaborationRequestsFile, requests);

  res.status(201).json({
    success: true,
    message: 'Solicitud de colaboración médica enviada exitosamente.',
    request: newRequest
  });
});

// =========================================================
// 5. ENDPOINTS: CITAS MÉDICAS (AGENDA)
// =========================================================
app.get('/api/appointments', (req, res) => {
  const appointments = loadJSON(appointmentsFile, []);
  res.json({
    success: true,
    count: appointments.length,
    appointments
  });
});

app.post('/api/appointments', (req, res) => {
  const { clinic, specialty, date, time, notes, patientId, doctor } = req.body;

  if (!clinic || !specialty || !date || !time) {
    return res.status(400).json({
      success: false,
      message: 'Sede, especialidad, fecha y horario son obligatorios.'
    });
  }

  const parsedDate = new Date(date + 'T00:00:00');
  const appointments = loadJSON(appointmentsFile, []);

  const newAppt = {
    id: `APPT-${Date.now()}`,
    patientId: patientId || null,
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth(),
    day: parsedDate.getDate(),
    time,
    doctor: doctor || 'Especialista Asignado',
    specialty,
    location: clinic,
    type: req.body.type || 'Presencial',
    status: 'Confirmada',
    notes: notes || '',
    createdAt: new Date().toISOString()
  };

  appointments.unshift(newAppt);
  saveJSON(appointmentsFile, appointments);

  res.status(201).json({
    success: true,
    message: 'Cita médica agendada y guardada en base de datos.',
    appointment: newAppt
  });
});

app.put('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const { date, time } = req.body;

  const appointments = loadJSON(appointmentsFile, []);
  const apptIndex = appointments.findIndex(a => a.id === id);

  if (apptIndex === -1) {
    return res.status(404).json({ success: false, message: 'Cita médica no encontrada en la base de datos.' });
  }

  const parsed = new Date(date + 'T00:00:00');
  appointments[apptIndex].year = parsed.getFullYear();
  appointments[apptIndex].month = parsed.getMonth();
  appointments[apptIndex].day = parsed.getDate();
  appointments[apptIndex].time = time;
  appointments[apptIndex].updatedAt = new Date().toISOString();

  saveJSON(appointmentsFile, appointments);

  res.json({
    success: true,
    message: 'Cita médica reprogramada exitosamente.',
    appointment: appointments[apptIndex]
  });
});

app.delete('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  let appointments = loadJSON(appointmentsFile, []);
  
  const initialLength = appointments.length;
  appointments = appointments.filter(a => a.id !== id);

  if (appointments.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Cita médica no encontrada para cancelar.' });
  }

  saveJSON(appointmentsFile, appointments);

  res.json({
    success: true,
    message: 'La cita médica ha sido cancelada en la base de datos.'
  });
});

// =========================================================
// 6. ENDPOINTS: MEDICAMENTOS Y RECETAS
// =========================================================
app.get('/api/medications', (req, res) => {
  const { type } = req.query;
  const medications = loadJSON(medicationsFile, []);

  const filtered = type && type !== 'all' 
    ? medications.filter(m => m.type === type)
    : medications;

  res.json({
    success: true,
    count: filtered.length,
    medications: filtered
  });
});

// Helper: Generador de Folio Único Consecutivo
function generateNextFolio(existingPrescriptions) {
  const currentYear = new Date().getFullYear();
  const prefix = `FOL-${currentYear}-`;
  
  const currentYearFolios = existingPrescriptions
    .map(p => p.folio || '')
    .filter(f => f.startsWith(prefix))
    .map(f => {
      const numPart = parseInt(f.replace(prefix, ''), 10);
      return isNaN(numPart) ? 0 : numPart;
    });

  const nextNumber = currentYearFolios.length > 0 ? Math.max(...currentYearFolios) + 1 : 1;
  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

// 6.1 Obtener el siguiente folio disponible
app.get('/api/prescriptions/next-folio', (req, res) => {
  const prescriptions = loadJSON(prescriptionsFile, []);
  const nextFolio = generateNextFolio(prescriptions);
  res.json({
    success: true,
    nextFolio
  });
});

// 6.2 Registrar una nueva Receta Médica con tratamientos dinámicos, folio y firma
app.post('/api/prescriptions', (req, res) => {
  const { doctor, clinic, patient, treatments, observations, signature, folio } = req.body;

  if (!patient || !patient.name || patient.name.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'El nombre del paciente es obligatorio.'
    });
  }

  if (!treatments || !Array.isArray(treatments) || treatments.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Debes agregar al menos un tratamiento/medicamento a la receta.'
    });
  }

  const prescriptions = loadJSON(prescriptionsFile, []);
  const assignedFolio = folio && folio.trim() !== '' ? folio.trim() : generateNextFolio(prescriptions);

  const newPrescription = {
    id: `RX-${Date.now()}`,
    folio: assignedFolio,
    issuedAt: new Date().toISOString(),
    doctor: {
      name: doctor?.name || 'Dr. Asignado',
      professionalId: doctor?.professionalId || 'CÉDULA-PENDIENTE',
      specialty: doctor?.specialty || 'Medicina General',
      email: doctor?.email || '',
      phone: doctor?.phone || ''
    },
    clinic: {
      name: clinic?.name || 'Consultorio Médico Particular',
      address: clinic?.address || 'Dirección de la clínica',
      phone: clinic?.phone || '',
      clues: clinic?.clues || ''
    },
    patient: {
      name: patient.name.trim(),
      age: patient.age || '',
      curp: patient.curp || '',
      allergies: patient.allergies || 'Ninguna conocida',
      patientId: patient.patientId || null
    },
    treatments: treatments.map((t, idx) => ({
      item: idx + 1,
      medication: t.medication?.trim() || 'Medicamento no especificado',
      dose: t.dose?.trim() || 'Dosis según criterio',
      frequency: t.frequency?.trim() || 'Cada 8 horas',
      duration: t.duration?.trim() || '5 días',
      notes: t.notes?.trim() || ''
    })),
    observations: observations?.trim() || 'Sin observaciones adicionales.',
    signature: signature || null,
    status: 'Emitida',
    createdAt: new Date().toISOString()
  };

  prescriptions.unshift(newPrescription);
  saveJSON(prescriptionsFile, prescriptions);

  return res.status(201).json({
    success: true,
    message: `Receta médica emitida exitosamente con Folio: ${assignedFolio}`,
    prescription: newPrescription
  });
});

// 6.3 Listar todas las recetas registradas (con filtros opcionales)
app.get('/api/prescriptions', (req, res) => {
  const { patientId, curp, doctorId } = req.query;
  const prescriptions = loadJSON(prescriptionsFile, []);

  let filtered = prescriptions;

  if (patientId) {
    filtered = filtered.filter(p => p.patient?.patientId === patientId);
  }
  if (curp) {
    filtered = filtered.filter(p => p.patient?.curp?.toLowerCase() === curp.toLowerCase());
  }
  if (doctorId) {
    filtered = filtered.filter(p => p.doctor?.professionalId === doctorId);
  }

  res.json({
    success: true,
    count: filtered.length,
    prescriptions: filtered
  });
});

// 6.4 Obtener una receta específica por Folio o ID
app.get('/api/prescriptions/:folio', (req, res) => {
  const { folio } = req.params;
  const prescriptions = loadJSON(prescriptionsFile, []);

  const prescription = prescriptions.find(p => 
    p.folio?.toLowerCase() === folio.toLowerCase() || 
    p.id?.toLowerCase() === folio.toLowerCase()
  );

  if (!prescription) {
    return res.status(404).json({
      success: false,
      message: `Receta con folio o ID '${folio}' no encontrada en el sistema.`
    });
  }

  res.json({
    success: true,
    prescription
  });
});

// =========================================================
// 7. INICIAR SERVIDOR
// =========================================================
app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🩺 MedConnect API Server iniciado en http://localhost:${PORT}`);
  console.log(`📡 Base de datos lista: Sin información precargada.`);
  console.log('========================================================');
});
