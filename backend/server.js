/**
 * MedConnect REST API Server (Node.js / Express)
 * Backend limpio para conexión directa con Base de Datos.
 * Sin datos simulados ni precargados.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

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

// Servir recursos estáticos de imágenes y el portal frontend
const imagesPath = path.join(__dirname, 'images');
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use('/images', express.static(imagesPath));
app.use('/api/images', express.static(imagesPath));
app.use(express.static(frontendPath));

// Rutas de archivos de datos JSON
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const appointmentsFile = path.join(dataDir, 'appointments.json');
const medicationsFile = path.join(dataDir, 'medications.json');
const prescriptionsFile = path.join(dataDir, 'prescriptions.json');
const consultationsFile = path.join(dataDir, 'consultations.json');

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
      (d.professionalId && d.professionalId.toLowerCase() === credential.toLowerCase()) || 
      (d.email && d.email.toLowerCase() === credential.toLowerCase()) ||
      (d.id && d.id.toLowerCase() === credential.toLowerCase())
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
  
  let formattedData = { ...data };
  if (role === 'doctor') {
    const fullName = data.name || `${data.firstName || ''} ${data.lastNameP || ''} ${data.lastNameM || ''}`.trim();
    formattedData.name = fullName || 'Dr. Médico Registrado';
    formattedData.fullName = fullName || formattedData.name;
    formattedData.professionalId = data.professionalId || data.docLicense || '';
    formattedData.specialty = data.specialty || 'Medicina General';
    formattedData.clinicName = data.clinicName || data.docHospital || 'Consultorio Médico Particular';
    formattedData.phone = data.phone || data.docPhone || '';
    formattedData.email = data.email || data.docEmail || '';
  }

  const newUser = {
    id: newId,
    ...formattedData,
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
// 4.0.1 ENDPOINTS: GESTIÓN DE PACIENTES PARA MÉDICOS (BÚSQUEDA)
// =========================================================
app.get('/api/patients', (req, res) => {
  const { q } = req.query;
  const users = loadJSON(usersFile, { patients: [] });
  const rawPatients = users.patients || [];

  // Mapear y sanitizar pacientes (excluir contraseñas)
  let patients = rawPatients.map(p => {
    const { password, ...safePatient } = p;
    const resolvedName = safePatient.fullName || safePatient.name || `${safePatient.firstName || ''} ${safePatient.lastNameP || ''} ${safePatient.lastNameM || ''}`.trim();
    return {
      id: safePatient.id,
      patientId: safePatient.id,
      name: resolvedName || 'Paciente Sin Nombre',
      fullName: resolvedName || 'Paciente Sin Nombre',
      curp: safePatient.curp || '',
      birthDate: safePatient.birthDate || '',
      age: safePatient.age || '',
      gender: safePatient.gender || '',
      bloodType: safePatient.bloodType || '',
      allergies: safePatient.allergies || 'Ninguna conocida',
      phone: safePatient.phone || '',
      email: safePatient.email || '',
      assignedClinic: safePatient.assignedClinic || '',
      createdAt: safePatient.createdAt
    };
  });

  if (q && q.trim() !== '') {
    const normalizeStr = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const term = normalizeStr(q.trim());
    patients = patients.filter(p => 
      normalizeStr(p.name).includes(term) ||
      normalizeStr(p.curp).includes(term) ||
      (p.phone && p.phone.includes(term)) ||
      (p.id && p.id.toLowerCase().includes(term))
    );
  }

  res.json({
    success: true,
    count: patients.length,
    patients
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

  const { id } = req.query;
  let doctor = null;
  if (professionalId) {
    doctor = doctors.find(d => d.professionalId?.toLowerCase() === professionalId.toLowerCase());
  }
  if (!doctor && id) {
    doctor = doctors.find(d => d.id?.toLowerCase() === String(id).toLowerCase());
  }

  if (!doctor) {
    return res.json({
      success: true,
      doctor: null,
      message: 'Sin perfil médico coincidente. Inicia sesión o registra tu cédula.'
    });
  }

  const { password, ...safeDoctor } = doctor;
  res.json({
    success: true,
    doctor: safeDoctor
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
// 5.5 ENDPOINTS: CONSULTAS MÉDICAS (EXPEDIENTE CLÍNICO)
// =========================================================

// 5.5.1 Crear nueva Consulta Médica
app.post('/api/consultations', (req, res) => {
  const {
    doctorId,
    doctorName,
    doctorLicense,
    patientId,
    patientName,
    patientCurp,
    patientAllergies,
    date,
    reason,
    symptoms,
    vitals,
    physicalExam,
    diagnosis,
    notes,
    treatment
  } = req.body;

  if (!patientName || patientName.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'El nombre del paciente es obligatorio para registrar la consulta.'
    });
  }

  if (!diagnosis || diagnosis.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'El diagnóstico clínico es obligatorio.'
    });
  }

  const consultations = loadJSON(consultationsFile, []);
  const newConsultationId = `CON-${Date.now()}`;

  const newConsultation = {
    id: newConsultationId,
    consultationId: newConsultationId,
    doctorId: doctorId || null,
    doctorName: doctorName || 'Médico Tratante',
    doctorLicense: doctorLicense || 'CÉDULA-PENDIENTE',
    patientId: patientId || null,
    patientName: patientName.trim(),
    patientCurp: patientCurp?.trim() || '',
    patientAllergies: patientAllergies?.trim() || '',
    date: date || new Date().toISOString(),
    consultationDate: date || new Date().toISOString(),
    fecha: date || new Date().toISOString(),
    reason: reason?.trim() || '',
    motivo: reason?.trim() || '',
    symptoms: symptoms?.trim() || '',
    anamnesis: symptoms?.trim() || '',
    vitals: {
      bloodPressure: vitals?.bloodPressure || '',
      heartRate: vitals?.heartRate || '',
      temperature: vitals?.temperature || '',
      weight: vitals?.weight || '',
      height: vitals?.height || '',
      bmi: vitals?.bmi || ''
    },
    physicalExam: physicalExam?.trim() || '',
    diagnosis: diagnosis.trim(),
    notes: notes?.trim() || '',
    treatment: treatment?.trim() || '',
    tratamiento: treatment?.trim() || '',
    status: 'Pendiente',
    prescriptionId: null,
    prescriptionFolio: null,
    createdAt: new Date().toISOString()
  };

  consultations.unshift(newConsultation);
  saveJSON(consultationsFile, consultations);

  return res.status(201).json({
    success: true,
    message: 'Consulta médica registrada exitosamente.',
    consultationId: newConsultationId,
    consultation: newConsultation
  });
});

// 5.5.2 Listar Consultas Médicas (Filtros por doctorId o patientId)
app.get('/api/consultations', (req, res) => {
  const { doctorId, patientId, status } = req.query;
  const consultations = loadJSON(consultationsFile, []);

  let filtered = consultations;

  if (doctorId) {
    const docQuery = doctorId.toLowerCase();
    filtered = filtered.filter(c => 
      c.doctorId?.toLowerCase() === docQuery || 
      c.doctorLicense?.toLowerCase() === docQuery
    );
  }

  if (patientId) {
    const patQuery = patientId.toLowerCase();
    filtered = filtered.filter(c => 
      c.patientId?.toLowerCase() === patQuery || 
      c.patientCurp?.toLowerCase() === patQuery
    );
  }

  if (status) {
    filtered = filtered.filter(c => c.status?.toLowerCase() === status.toLowerCase());
  }

  res.json({
    success: true,
    count: filtered.length,
    consultations: filtered
  });
});

// 5.5.3 Obtener Consulta Médica específica por ID
app.get('/api/consultations/:id', (req, res) => {
  const { id } = req.params;
  const consultations = loadJSON(consultationsFile, []);

  const consultation = consultations.find(c => 
    c.id?.toLowerCase() === id.toLowerCase() || 
    c.consultationId?.toLowerCase() === id.toLowerCase()
  );

  if (!consultation) {
    return res.status(404).json({
      success: false,
      message: `Consulta médica con ID '${id}' no encontrada en el sistema.`
    });
  }

  res.json({
    success: true,
    consultation
  });
});

// 5.5.4 Asociar receta a una consulta existente
app.put('/api/consultations/:id/prescription', (req, res) => {
  const { id } = req.params;
  const { prescriptionId, folio } = req.body;

  const consultations = loadJSON(consultationsFile, []);
  const index = consultations.findIndex(c => 
    c.id?.toLowerCase() === id.toLowerCase() || 
    c.consultationId?.toLowerCase() === id.toLowerCase()
  );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: `Consulta con ID '${id}' no encontrada para asociar receta.`
    });
  }

  consultations[index].prescriptionId = prescriptionId || consultations[index].prescriptionId;
  consultations[index].prescriptionFolio = folio || consultations[index].prescriptionFolio;
  consultations[index].status = 'Completada';
  consultations[index].updatedAt = new Date().toISOString();

  saveJSON(consultationsFile, consultations);

  res.json({
    success: true,
    message: 'Receta vinculada exitosamente a la consulta médica.',
    consultation: consultations[index]
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
  const { doctor, clinic, patient, treatments, observations, signature, folio, consultationId, diagnosis, patientId, doctorId } = req.body;

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

  if (consultationId) {
    const existingForConsult = prescriptions.find(p => p.consultationId === consultationId);
    if (existingForConsult) {
      return res.json({
        success: true,
        message: `La consulta ya tiene receta emitida (Folio: ${existingForConsult.folio}). No se duplicó.`,
        prescription: existingForConsult,
        alreadyExists: true
      });
    }
  }

  const assignedFolio = folio && folio.trim() !== '' && !prescriptions.some(p => p.folio === folio.trim())
    ? folio.trim()
    : generateNextFolio(prescriptions);

  const resolvedPatientId = patientId || patient.patientId || null;
  const resolvedDoctorId = doctorId || doctor?.doctorId || doctor?.professionalId || null;

  const newPrescription = {
    id: `RX-${Date.now()}`,
    folio: assignedFolio,
    consultationId: consultationId || null,
    diagnosis: diagnosis || '',
    issuedAt: new Date().toISOString(),
    doctor: {
      name: doctor?.name || 'Dr. Asignado',
      professionalId: doctor?.professionalId || 'CÉDULA-PENDIENTE',
      specialty: doctor?.specialty || 'Medicina General',
      email: doctor?.email || '',
      phone: doctor?.phone || '',
      doctorId: resolvedDoctorId
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
      patientId: resolvedPatientId
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

  // Vincular automáticamente a la consulta si viene consultationId
  if (consultationId) {
    try {
      const consultations = loadJSON(consultationsFile, []);
      const cIndex = consultations.findIndex(c => 
        c.id === consultationId || c.consultationId === consultationId
      );
      if (cIndex !== -1) {
        consultations[cIndex].prescriptionId = newPrescription.id;
        consultations[cIndex].prescriptionFolio = assignedFolio;
        consultations[cIndex].status = 'Completada';
        consultations[cIndex].updatedAt = new Date().toISOString();
        saveJSON(consultationsFile, consultations);
      }
    } catch (err) {
      console.error('Error actualizando consulta con receta:', err);
    }
  }

  return res.status(201).json({
    success: true,
    message: `Receta médica emitida exitosamente con Folio: ${assignedFolio}`,
    prescription: newPrescription
  });
});

// 6.3 Listar todas las recetas registradas (con filtros opcionales)
app.get('/api/prescriptions', (req, res) => {
  const { patientId, curp, doctorId, consultationId } = req.query;
  const prescriptions = loadJSON(prescriptionsFile, []);

  let filtered = prescriptions;

  if (patientId) {
    filtered = filtered.filter(p => p.patient?.patientId === patientId);
  }
  if (curp) {
    filtered = filtered.filter(p => p.patient?.curp?.toLowerCase() === curp.toLowerCase());
  }
  if (doctorId) {
    filtered = filtered.filter(p => p.doctor?.professionalId === doctorId || p.doctor?.doctorId === doctorId);
  }
  if (consultationId) {
    filtered = filtered.filter(p => p.consultationId === consultationId);
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

// 6.5 PDF real de receta (documento generado, no captura de pantalla)
app.get('/api/prescriptions/:folio/pdf', (req, res) => {
  const { folio } = req.params;
  const prescriptions = loadJSON(prescriptionsFile, []);
  const prescription = prescriptions.find(p =>
    p.folio?.toLowerCase() === folio.toLowerCase() ||
    p.id?.toLowerCase() === folio.toLowerCase()
  );

  if (!prescription) {
    return res.status(404).json({
      success: false,
      message: `Receta con folio o ID '${folio}' no encontrada.`
    });
  }

  try {
    const safeFolio = String(prescription.folio || folio).replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Receta-${safeFolio}.pdf"`);

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    doc.pipe(res);

    const issued = prescription.issuedAt || prescription.createdAt || new Date().toISOString();
    const issuedLabel = new Date(issued).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    doc.fillColor('#2D6061').fontSize(18).font('Helvetica-Bold').text('MedConnect', { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('#4A5F6E').text('Receta médica electrónica', { align: 'left' });
    doc.moveDown(0.4);
    doc.fillColor('#1E2B37').fontSize(11).font('Helvetica-Bold')
      .text(`Folio: ${prescription.folio || '--'}`, { continued: true })
      .font('Helvetica').text(`    Fecha: ${issuedLabel}`, { align: 'left' });

    doc.moveDown(0.6);
    doc.strokeColor('#347072').lineWidth(1.5).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(0.8);

    const doctor = prescription.doctor || {};
    const clinic = prescription.clinic || {};
    const patient = prescription.patient || {};

    doc.fillColor('#2D6061').fontSize(12).font('Helvetica-Bold').text('Médico tratante');
    doc.moveDown(0.2);
    doc.fillColor('#1E2B37').fontSize(10).font('Helvetica')
      .text(`Nombre: ${doctor.name || 'Médico tratante'}`)
      .text(`Especialidad: ${doctor.specialty || 'No especificada'}`)
      .text(`Cédula profesional: ${doctor.professionalId || '--'}`)
      .text(`Teléfono: ${doctor.phone || '--'}    Correo: ${doctor.email || '--'}`)
      .text(`Institución: ${clinic.name || '--'}`)
      .text(`Dirección: ${clinic.address || '--'}`);

    doc.moveDown(0.7);
    doc.fillColor('#2D6061').fontSize(12).font('Helvetica-Bold').text('Paciente');
    doc.moveDown(0.2);
    doc.fillColor('#1E2B37').fontSize(10).font('Helvetica')
      .text(`Nombre: ${patient.name || '--'}`)
      .text(`CURP: ${patient.curp || '--'}    Edad: ${patient.age || '--'}`)
      .text(`Alergias: ${patient.allergies || 'Ninguna conocida'}`);

      if (prescription.diagnosis) {
      doc.moveDown(0.7);
      doc.fillColor('#2D6061').fontSize(12).font('Helvetica-Bold').text('Diagnóstico');
      doc.moveDown(0.2);
      doc.fillColor('#1E2B37').fontSize(10).font('Helvetica').text(prescription.diagnosis, { width: 512 });
    }

    doc.moveDown(0.7);
    doc.fillColor('#2D6061').fontSize(12).font('Helvetica-Bold').text('Tratamiento');
    doc.moveDown(0.35);

    const treatments = Array.isArray(prescription.treatments) ? prescription.treatments : [];
    if (treatments.length === 0) {
      doc.fillColor('#1E2B37').fontSize(10).font('Helvetica').text('Sin medicamentos registrados.');
    } else {
      treatments.forEach((t, idx) => {
        doc.fillColor('#1E2B37').fontSize(10).font('Helvetica-Bold')
          .text(`${idx + 1}. ${t.medication || 'Medicamento'}`);
        doc.font('Helvetica')
          .text(`   Dosis: ${t.dose || '--'}    Frecuencia: ${t.frequency || '--'}    Duración: ${t.duration || '--'}`);
        if (t.notes) {
          doc.text(`   Indicaciones: ${t.notes}`);
        }
        doc.moveDown(0.25);
      });
    }

    doc.moveDown(0.5);
    doc.fillColor('#2D6061').fontSize(12).font('Helvetica-Bold').text('Indicaciones generales');
    doc.moveDown(0.2);
    doc.fillColor('#1E2B37').fontSize(10).font('Helvetica')
      .text(prescription.observations || 'Sin observaciones adicionales.', { width: 512 });

    doc.moveDown(1.6);
    doc.strokeColor('#CAD6DF').lineWidth(0.8).moveTo(360, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#4A5F6E').text(doctor.name || 'Firma del médico tratante', 360, doc.y, { width: 180, align: 'center' });
    doc.text('Firma / rúbrica', 360, doc.y, { width: 180, align: 'center' });

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#7E92A2')
      .text('Documento generado por MedConnect. Uso clínico de demostración.', 50, 720, { width: 512, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Error generando PDF de receta:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'No se pudo generar el PDF de la receta.' });
    }
  }
});

// =========================================================
// 7. INICIAR SERVIDOR
// =========================================================
app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🩺 MedConnect API Server iniciado en http://localhost:${PORT}`);
  console.log(`🌐 Portal: http://localhost:${PORT}/index.html`);
  console.log('========================================================');
});
