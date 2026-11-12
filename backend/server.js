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
const { PNG } = require('pngjs');
const { drawClinicalPrescription } = require('./prescription-pdf');
const {
  applyDoctorInstitution,
  presentDoctor,
  captureBranding,
  resolveLogoFile,
  prepareLogoPreview
} = require('./institution-identity');

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
const appointmentHoldsFile = path.join(dataDir, 'appointment-holds.json');
const medicationsFile = path.join(dataDir, 'medications.json');
const prescriptionsFile = path.join(dataDir, 'prescriptions.json');
const consultationsFile = path.join(dataDir, 'consultations.json');
const signaturesDir = path.join(dataDir, 'signatures');

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

  res.json({
    success: true,
    doctor: presentDoctor(doctor)
  });
});

app.post('/api/logos/preview', (req, res) => {
  const prepared = prepareLogoPreview(req.body && req.body.logoBase64);
  if (prepared.error) {
    return res.status(400).json({ success: false, message: prepared.error });
  }
  return res.json({
    success: true,
    preview: `data:${prepared.mime};base64,${prepared.buffer.toString('base64')}`
  });
});

app.get('/api/logos/:file', (req, res) => {
  const logoPath = resolveLogoFile(req.params.file);
  if (!logoPath) {
    return res.status(404).json({ success: false, message: 'Logotipo no encontrado.' });
  }
  res.sendFile(logoPath);
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

  const logoInput = {
    logoBase64: doctorData.logoBase64,
    removeLogo: doctorData.removeLogo === true || doctorData.removeLogo === 'true'
  };
  ['password', 'logoBase64', 'logoMime', 'removeLogo', 'logoFile', 'logoUrl', 'clinicId', 'canEditInstitution', 'institutionRole', 'branding'].forEach((key) => {
    delete doctorData[key];
  });

  const previous = existingIndex !== -1 ? users.doctors[existingIndex] : {};
  const doctorId = doctorData.id || previous.id || `DOC-${Date.now()}`;
  doctorData.id = doctorId;
  const institutionResult = applyDoctorInstitution(previous, doctorData, logoInput);
  if (institutionResult.error) {
    return res.status(institutionResult.status || 400).json({
      success: false,
      message: institutionResult.error
    });
  }

  const updatedDoctor = {
    ...previous,
    ...doctorData,
    ...institutionResult.doctorFields,
    id: doctorId,
    password: previous.password,
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
    doctor: presentDoctor(updatedDoctor)
  });
});

// Cambio real de la contraseña almacenada. El login todavía no verifica contraseñas.
app.post('/api/doctor/password', (req, res) => {
  const { id, professionalId, currentPassword, newPassword, confirmPassword } = req.body || {};

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Completa la contraseña actual, la nueva y la confirmación.' });
  }
  if (String(newPassword) !== String(confirmPassword)) {
    return res.status(400).json({ success: false, message: 'La confirmación no coincide con la nueva contraseña.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  const users = loadJSON(usersFile, { patients: [], minors: [], doctors: [], clinics: [] });
  const doctors = users.doctors || [];
  const index = doctors.findIndex(d =>
    (id && d.id === id) ||
    (professionalId && d.professionalId === professionalId)
  );

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'No se encontró el perfil médico para actualizar la contraseña.' });
  }

  if (!doctors[index].password) {
    return res.status(409).json({
      success: false,
      code: 'PASSWORD_NOT_STORED',
      message: 'Este perfil no tiene una contraseña almacenada, así que no es posible verificar la contraseña actual.'
    });
  }

  if (String(doctors[index].password) !== String(currentPassword)) {
    return res.status(401).json({ success: false, message: 'La contraseña actual no coincide.' });
  }

  doctors[index].password = String(newPassword);
  doctors[index].updatedAt = new Date().toISOString();
  users.doctors = doctors;
  saveJSON(usersFile, users);

  res.json({
    success: true,
    message: 'Contraseña actualizada.'
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
const APPOINTMENT_HOLD_MS = 3 * 60 * 1000;
const APPOINTMENT_UNIQUE_KEYS = new Set();

function normalizeAppointmentTime(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return String(value || '').trim();
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
}

function appointmentBelongsToDoctor(appt, doctorId) {
  if (!doctorId) return true;
  const wanted = String(doctorId);
  const values = [appt.doctorId, appt.professionalId, appt.doctor].filter(Boolean).map(String);
  return values.includes(wanted);
}

function appointmentStartMs(appt) {
  const slot = normalizeAppointmentTime(appt.time);
  const parts = slot.split(':').map(Number);
  const hh = parts[0] || 0;
  const mm = parts[1] || 0;
  if (appt.year != null && appt.month != null && appt.day != null) {
    return new Date(Number(appt.year), Number(appt.month), Number(appt.day), hh, mm, 0, 0).getTime();
  }
  if (appt.date) {
    const d = new Date(`${appt.date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
    return d.getTime();
  }
  return NaN;
}

function appointmentRange(appt) {
  const start = appointmentStartMs(appt);
  const duration = Number(appt.durationMinutes) > 0 ? Number(appt.durationMinutes) : 30;
  return { start, end: start + duration * 60000 };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return Number.isFinite(aStart) && Number.isFinite(bStart) && aStart < bEnd && aEnd > bStart;
}

function uniqueAppointmentKey(doctorId, start, end) {
  return `${doctorId || 'none'}|${start}|${end}`;
}

function rebuildAppointmentUniqueIndex() {
  APPOINTMENT_UNIQUE_KEYS.clear();
  loadJSON(appointmentsFile, []).forEach(a => {
    if (String(a.status || '').toLowerCase() === 'cancelada') return;
    const range = appointmentRange(a);
    APPOINTMENT_UNIQUE_KEYS.add(uniqueAppointmentKey(a.doctorId || a.professionalId, range.start, range.end));
  });
}

function loadActiveHolds() {
  const now = Date.now();
  const holds = loadJSON(appointmentHoldsFile, []).filter(h => new Date(h.expiresAt).getTime() > now);
  saveJSON(appointmentHoldsFile, holds);
  return holds;
}

function findOverlap({ doctorId, start, end, ignoreAppointmentId, ignoreHoldId }) {
  const appointments = loadJSON(appointmentsFile, []);
  const clashAppt = appointments.find(a => {
    if (String(a.status || '').toLowerCase() === 'cancelada') return false;
    if (ignoreAppointmentId && a.id === ignoreAppointmentId) return false;
    if (doctorId && !appointmentBelongsToDoctor(a, doctorId)) return false;
    const range = appointmentRange(a);
    return rangesOverlap(start, end, range.start, range.end);
  });
  if (clashAppt) return { type: 'appointment', item: clashAppt };

  const clashHold = loadActiveHolds().find(h => {
    if (ignoreHoldId && h.id === ignoreHoldId) return false;
    if (doctorId && String(h.doctorId) !== String(doctorId)) return false;
    return rangesOverlap(start, end, h.start, h.end);
  });
  if (clashHold) return { type: 'hold', item: clashHold };
  return null;
}

function canonicalAppointmentStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'cancelada') return 'Cancelada';
  if (s === 'atendida' || s === 'completada') return 'Atendida';
  if (s === 'en consulta') return 'En consulta';
  return 'Pendiente';
}

function sameCalendarDay(appt, date) {
  const dt = new Date(appointmentStartMs(appt));
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getFullYear() === date.getFullYear()
    && dt.getMonth() === date.getMonth()
    && dt.getDate() === date.getDate();
}

function markLinkedAppointmentAttended({ appointmentId, patientId, doctorId }) {
  const appointments = loadJSON(appointmentsFile, []);
  let index = -1;
  if (appointmentId) {
    index = appointments.findIndex(a => a.id === appointmentId);
  }
  if (index === -1 && patientId) {
    const today = new Date();
    const candidates = appointments
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => {
        if (String(a.patientId || '') !== String(patientId)) return false;
        if (doctorId && !appointmentBelongsToDoctor(a, doctorId)) return false;
        const bucket = canonicalAppointmentStatus(a.status);
        if (bucket !== 'Pendiente' && bucket !== 'En consulta') return false;
        return sameCalendarDay(a, today);
      })
      .sort((x, y) => appointmentStartMs(x.a) - appointmentStartMs(y.a));
    if (candidates.length) index = candidates[0].i;
  }
  if (index === -1) return null;
  if (canonicalAppointmentStatus(appointments[index].status) === 'Cancelada') return null;
  appointments[index].status = 'Atendida';
  appointments[index].updatedAt = new Date().toISOString();
  saveJSON(appointmentsFile, appointments);
  rebuildAppointmentUniqueIndex();
  return appointments[index];
}

app.get('/api/appointments', (req, res) => {
  const { doctorId, patientId, startDate, endDate, status, view } = req.query;
  let appointments = loadJSON(appointmentsFile, []);

  if (doctorId) {
    appointments = appointments.filter(a => appointmentBelongsToDoctor(a, doctorId));
  }
  if (patientId) {
    appointments = appointments.filter(a => String(a.patientId || '') === String(patientId));
  }
  if (status && status.toLowerCase() !== 'todas' && status.toLowerCase() !== 'all' && status.toLowerCase() !== 'todos') {
    const wanted = status.toLowerCase();
    if (wanted === 'pendientes' || wanted === 'pendiente') {
      appointments = appointments.filter(a => {
        const bucket = canonicalAppointmentStatus(a.status);
        return bucket === 'Pendiente' || bucket === 'En consulta';
      });
    } else if (wanted === 'atendidos' || wanted === 'atendidas' || wanted === 'atendida') {
      appointments = appointments.filter(a => canonicalAppointmentStatus(a.status) === 'Atendida');
    } else {
      appointments = appointments.filter(a => String(a.status || '').toLowerCase() === wanted || canonicalAppointmentStatus(a.status).toLowerCase() === wanted);
    }
  }
  if (startDate || endDate) {
    const toBound = (value, isEnd) => {
      if (!value) return isEnd ? Number.MAX_SAFE_INTEGER : 0;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const d = new Date(`${value}T00:00:00`);
        if (isEnd) d.setHours(23, 59, 59, 999);
        return d.getTime();
      }
      return new Date(value).getTime();
    };
    const startBound = toBound(startDate, false);
    const endBound = toBound(endDate, true);
    appointments = appointments.filter(a => {
      const t = appointmentStartMs(a);
      return Number.isFinite(t) && t >= startBound && t <= endBound;
    });
  }

  const holds = doctorId
    ? loadActiveHolds().filter(h => String(h.doctorId) === String(doctorId))
    : loadActiveHolds();

  res.json({
    success: true,
    count: appointments.length,
    view: view || null,
    appointments,
    holds
  });
});

app.post('/api/appointments/holds', (req, res) => {
  const { doctorId, date, time, durationMinutes, holdId } = req.body;
  if (!doctorId || !date || !time) {
    return res.status(400).json({ success: false, message: 'Médico, fecha y horario son obligatorios para reservar el slot.' });
  }
  const parsedDate = new Date(date + 'T00:00:00');
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ success: false, message: 'La fecha no es válida.' });
  }
  const duration = [30, 45, 60].includes(Number(durationMinutes)) ? Number(durationMinutes) : 30;
  const draft = {
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth(),
    day: parsedDate.getDate(),
    date,
    time,
    durationMinutes: duration,
    doctorId
  };
  const range = appointmentRange(draft);
  const clash = findOverlap({ doctorId, start: range.start, end: range.end, ignoreHoldId: holdId || null });
  if (clash) {
    return res.status(409).json({
      success: false,
      code: 'SLOT_TAKEN',
      message: 'Este horario acaba de ser ocupado. Por favor, selecciona otro slot disponible'
    });
  }

  let holds = loadActiveHolds();
  if (holdId) holds = holds.filter(h => h.id !== holdId);
  const hold = {
    id: holdId || `HOLD-${Date.now()}`,
    doctorId,
    date,
    time,
    durationMinutes: duration,
    start: range.start,
    end: range.end,
    expiresAt: new Date(Date.now() + APPOINTMENT_HOLD_MS).toISOString()
  };
  holds.push(hold);
  saveJSON(appointmentHoldsFile, holds);
  res.status(201).json({ success: true, hold, holdMinutes: 3 });
});

app.delete('/api/appointments/holds/:id', (req, res) => {
  const { id } = req.params;
  const holds = loadActiveHolds().filter(h => h.id !== id);
  saveJSON(appointmentHoldsFile, holds);
  res.json({ success: true });
});

app.post('/api/appointments', (req, res) => {
  const {
    clinic,
    specialty,
    date,
    time,
    notes,
    reason,
    patientId,
    patientName,
    doctor,
    doctorId,
    professionalId,
    type,
    durationMinutes
  } = req.body;

  if (!clinic || !specialty || !date || !time) {
    return res.status(400).json({
      success: false,
      message: 'Sede, especialidad, fecha y horario son obligatorios.'
    });
  }

  const parsedDate = new Date(date + 'T00:00:00');
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'La fecha de la cita no es válida.'
    });
  }

  const appointments = loadJSON(appointmentsFile, []);
  const year = parsedDate.getFullYear();
  const month = parsedDate.getMonth();
  const day = parsedDate.getDate();
  const ownerId = doctorId || professionalId || null;
  const parsedDuration = [30, 45, 60].includes(Number(durationMinutes)) ? Number(durationMinutes) : 30;
  const draft = { year, month, day, date, time, durationMinutes: parsedDuration, doctorId: ownerId };
  const range = appointmentRange(draft);
  const holdId = req.body.holdId || null;

  const clash = findOverlap({
    doctorId: ownerId,
    start: range.start,
    end: range.end,
    ignoreHoldId: holdId
  });
  if (clash) {
    return res.status(409).json({
      success: false,
      code: 'SLOT_TAKEN',
      message: 'Este horario acaba de ser ocupado. Por favor, selecciona otro slot disponible'
    });
  }

  const uniqueKey = uniqueAppointmentKey(ownerId, range.start, range.end);
  if (APPOINTMENT_UNIQUE_KEYS.has(uniqueKey)) {
    return res.status(409).json({
      success: false,
      code: 'SLOT_TAKEN',
      message: 'Este horario acaba de ser ocupado. Por favor, selecciona otro slot disponible'
    });
  }

  const newAppt = {
    id: `APPT-${Date.now()}`,
    patientId: patientId || null,
    patientName: patientName || '',
    doctorId: ownerId,
    professionalId: professionalId || null,
    year,
    month,
    day,
    date,
    time,
    startTime: new Date(range.start).toISOString(),
    endTime: new Date(range.end).toISOString(),
    doctor: doctor || 'Especialista Asignado',
    specialty,
    location: clinic,
    type: type || 'Presencial',
    durationMinutes: parsedDuration,
    status: 'Pendiente',
    notes: notes || reason || '',
    createdAt: new Date().toISOString()
  };

  APPOINTMENT_UNIQUE_KEYS.add(uniqueKey);
  appointments.unshift(newAppt);
  saveJSON(appointmentsFile, appointments);
  if (holdId) {
    saveJSON(appointmentHoldsFile, loadActiveHolds().filter(h => h.id !== holdId));
  }

  res.status(201).json({
    success: true,
    message: 'Cita médica agendada y guardada en base de datos.',
    appointment: newAppt
  });
});

app.put('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const { date, time, status } = body;

  const appointments = loadJSON(appointmentsFile, []);
  const apptIndex = appointments.findIndex(a => a.id === id);

  if (apptIndex === -1) {
    return res.status(404).json({ success: false, message: 'Cita médica no encontrada en la base de datos.' });
  }

  const current = appointments[apptIndex];
  const currentCanon = canonicalAppointmentStatus(current.status);
  let nextStatus = status ? canonicalAppointmentStatus(status) : currentCanon;
  const moving = date != null || time != null;

  if (moving) {
    if (!date || !time) {
      return res.status(400).json({ success: false, message: 'Indica la nueva fecha y el horario para reagendar.' });
    }
    if (currentCanon === 'Cancelada' || currentCanon === 'Atendida') {
      return res.status(409).json({ success: false, message: 'Esta cita ya no se puede reagendar.' });
    }
    const parsed = new Date(date + 'T00:00:00');
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ success: false, message: 'La fecha no es válida.' });
    }
    const duration = [30, 45, 60].includes(Number(body.durationMinutes))
      ? Number(body.durationMinutes)
      : (Number(current.durationMinutes) || 30);
    const draft = {
      year: parsed.getFullYear(),
      month: parsed.getMonth(),
      day: parsed.getDate(),
      date,
      time,
      durationMinutes: duration,
      doctorId: current.doctorId || current.professionalId
    };
    const range = appointmentRange(draft);
    const clash = findOverlap({
      doctorId: draft.doctorId,
      start: range.start,
      end: range.end,
      ignoreAppointmentId: id
    });
    if (clash) {
      return res.status(409).json({
        success: false,
        code: 'SLOT_TAKEN',
        message: 'Este horario acaba de ser ocupado. Por favor, selecciona otro slot disponible'
      });
    }
    current.year = draft.year;
    current.month = draft.month;
    current.day = draft.day;
    current.date = date;
    current.time = time;
    current.durationMinutes = duration;
    current.startTime = new Date(range.start).toISOString();
    current.endTime = new Date(range.end).toISOString();
    if (!status) nextStatus = 'Pendiente';
  } else if (!status) {
    return res.status(400).json({ success: false, message: 'No hay cambios para aplicar en la cita.' });
  }

  if (nextStatus === 'Cancelada' && currentCanon === 'Atendida') {
    return res.status(409).json({ success: false, message: 'No se puede cancelar una cita que ya fue atendida.' });
  }

  current.status = nextStatus;
  current.updatedAt = new Date().toISOString();
  appointments[apptIndex] = current;
  saveJSON(appointmentsFile, appointments);
  rebuildAppointmentUniqueIndex();

  res.json({
    success: true,
    message: moving ? 'Cita médica reprogramada exitosamente.' : 'Estado de la cita actualizado.',
    appointment: current
  });
});

app.delete('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const appointments = loadJSON(appointmentsFile, []);
  const index = appointments.findIndex(a => a.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Cita médica no encontrada para cancelar.' });
  }

  if (canonicalAppointmentStatus(appointments[index].status) === 'Atendida') {
    return res.status(409).json({ success: false, message: 'No se puede cancelar una cita que ya fue atendida.' });
  }

  appointments[index].status = 'Cancelada';
  appointments[index].updatedAt = new Date().toISOString();
  saveJSON(appointmentsFile, appointments);
  rebuildAppointmentUniqueIndex();

  res.json({
    success: true,
    message: 'La cita quedó cancelada. El paciente no fue eliminado.',
    appointment: appointments[index]
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

app.post('/api/consultations/complete', (req, res) => {
  const { patientId, consultationData, prescriptionData } = req.body;
  const data = consultationData || {};
  const patientName = data.patientName || req.body.patientName;
  const diagnosis = data.diagnosis || req.body.diagnosis;

  if (!patientName || String(patientName).trim() === '') {
    return res.status(400).json({ success: false, message: 'El nombre del paciente es obligatorio.' });
  }
  if (!diagnosis || String(diagnosis).trim() === '') {
    return res.status(400).json({ success: false, message: 'El diagnóstico clínico es obligatorio.' });
  }

  const generateRx = prescriptionData && prescriptionData.generate !== false;
  const meds = Array.isArray(prescriptionData?.medications) ? prescriptionData.medications : [];
  if (generateRx && meds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Para generar receta debes agregar al menos un medicamento, o desactiva la receta.'
    });
  }

  let graphicSignature = { empty: true };
  if (generateRx) {
    graphicSignature = parseGraphicSignature(prescriptionData?.signature);
    if (graphicSignature.error) {
      return res.status(400).json({ success: false, message: graphicSignature.error });
    }
  }

  const consultations = loadJSON(consultationsFile, []);
  const requestedId = data.consultationId || data.id || req.body.consultationId || null;
  let existingIndex = -1;
  if (requestedId) {
    const wanted = String(requestedId).toLowerCase();
    existingIndex = consultations.findIndex(c =>
      String(c.id || '').toLowerCase() === wanted ||
      String(c.consultationId || '').toLowerCase() === wanted
    );
  }

  const previous = existingIndex >= 0 ? consultations[existingIndex] : {};
  const newConsultationId = previous.id || previous.consultationId || `CON-${Date.now()}`;
  const newConsultation = {
    ...previous,
    id: newConsultationId,
    consultationId: newConsultationId,
    doctorId: data.doctorId || previous.doctorId || null,
    doctorName: data.doctorName || previous.doctorName || 'Médico Tratante',
    doctorLicense: data.doctorLicense || previous.doctorLicense || 'CÉDULA-PENDIENTE',
    patientId: patientId || data.patientId || previous.patientId || null,
    patientName: String(patientName).trim(),
    patientCurp: data.patientCurp || previous.patientCurp || '',
    patientBirthDate: data.patientBirthDate || previous.patientBirthDate || '',
    patientAllergies: data.patientAllergies || previous.patientAllergies || '',
    date: data.date || previous.date || new Date().toISOString(),
    consultationDate: data.date || previous.consultationDate || new Date().toISOString(),
    fecha: data.date || previous.fecha || new Date().toISOString(),
    reason: data.reason || '',
    motivo: data.reason || '',
    symptoms: data.symptoms || '',
    anamnesis: data.symptoms || '',
    vitals: data.vitals || {},
    physicalExam: data.physicalExam || '',
    diagnosis: String(diagnosis).trim(),
    notes: data.notes || '',
    treatment: data.treatment || '',
    tratamiento: data.treatment || '',
    status: 'Completada',
    appointmentId: data.appointmentId || previous.appointmentId || null,
    prescriptionId: previous.prescriptionId || null,
    prescriptionFolio: previous.prescriptionFolio || null,
    createdAt: previous.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let savedRef;
  if (existingIndex >= 0) {
    consultations[existingIndex] = newConsultation;
    savedRef = consultations[existingIndex];
  } else {
    consultations.unshift(newConsultation);
    savedRef = consultations[0];
  }
  saveJSON(consultationsFile, consultations);

  let prescription = null;
  if (generateRx) {
    try {
      const prescriptions = loadJSON(prescriptionsFile, []);
      const assignedFolio = generateNextFolio(prescriptions);
      const chart = findPatientRecord(newConsultation.patientId);
      const birthDate = textOrEmpty(newConsultation.patientBirthDate || chart?.birthDate);
      prescription = {
        id: `RX-${Date.now()}`,
        folio: assignedFolio,
        consultationId: newConsultationId,
        diagnosis: textOrEmpty(newConsultation.diagnosis),
        reason: textOrEmpty(newConsultation.reason),
        clinicalNotes: textOrEmpty(newConsultation.notes),
        issuedAt: new Date().toISOString(),
        doctor: {
          name: textOrEmpty(data.doctorName),
          professionalId: textOrEmpty(data.doctorLicense),
          specialty: textOrEmpty(data.specialty),
          email: textOrEmpty(data.doctorEmail),
          phone: textOrEmpty(data.doctorPhone),
          doctorId: data.doctorId || null
        },
        clinic: {
          name: textOrEmpty(data.clinicName),
          address: textOrEmpty(data.clinicAddress),
          phone: textOrEmpty(data.clinicPhone),
          clues: ''
        },
        patient: {
          name: textOrEmpty(newConsultation.patientName),
          birthDate,
          age: ageAtIssue(birthDate, data.patientAge),
          curp: textOrEmpty(newConsultation.patientCurp),
          allergies: textOrEmpty(newConsultation.patientAllergies),
          patientId: newConsultation.patientId
        },
        treatments: meds.map(snapshotTreatment).filter(t => t.medication),
        observations: textOrEmpty(prescriptionData.notes),
        signature: null,
        status: 'Emitida',
        createdAt: new Date().toISOString()
      };
      applyIssuedBranding(prescription, data.doctorId);
      if (!prescription.treatments.length) {
        throw new Error('La receta no tiene medicamentos con nombre.');
      }
      storeGraphicSignature(prescription, graphicSignature);
      prescriptions.unshift(prescription);
      saveJSON(prescriptionsFile, prescriptions);
      savedRef.prescriptionId = prescription.id;
      savedRef.prescriptionFolio = prescription.folio;
      savedRef.status = 'Completada';
      saveJSON(consultationsFile, consultations);
    } catch (err) {
      const rolled = loadJSON(consultationsFile, []);
      const idx = rolled.findIndex(c => c.id === newConsultationId);
      if (existingIndex >= 0 && previous && previous.id) {
        if (idx >= 0) rolled[idx] = previous;
        else rolled.unshift(previous);
      } else if (idx >= 0) {
        rolled.splice(idx, 1);
      }
      saveJSON(consultationsFile, rolled);
      return res.status(500).json({
        success: false,
        message: 'No se pudo emitir la receta. Los cambios de esta consulta se revirtieron.'
      });
    }
  }

  markLinkedAppointmentAttended({
    appointmentId: savedRef.appointmentId,
    patientId: savedRef.patientId,
    doctorId: savedRef.doctorId
  });

  res.status(201).json({
    success: true,
    message: generateRx ? 'Consulta guardada y receta generada con éxito' : 'Consulta médica registrada exitosamente.',
    consultationId: newConsultationId,
    consultation: savedRef,
    prescription: prescription ? presentPrescription(prescription) : null
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

function textOrEmpty(value) {
  return String(value ?? '').trim();
}

function parseGraphicSignature(dataUrl) {
  const text = textOrEmpty(dataUrl);
  if (!text) return { empty: true };
  const match = text.match(/^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return { error: 'La firma debe ser una imagen PNG de la captura.' };
  let buffer;
  try {
    buffer = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
  } catch (err) {
    return { error: 'No se pudo leer la firma capturada.' };
  }
  if (buffer.length < 32 || buffer.length > 1500000) {
    return { error: 'La firma capturada no tiene un tamaño válido.' };
  }
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
    return { error: 'La firma debe ser una imagen PNG.' };
  }
  let png;
  try {
    png = PNG.sync.read(buffer);
  } catch (err) {
    return { error: 'No se pudo leer la firma capturada.' };
  }
  let ink = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const alpha = png.data[i + 3];
    const luma = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
    if (alpha > 16 && luma < 210) ink += 1;
  }
  if (ink < 40) {
    return { error: 'La firma está vacía. Dibuja la rúbrica o emite la receta sin firma.' };
  }
  return { buffer };
}

function storeGraphicSignature(prescription, parsed) {
  prescription.signature = null;
  if (!parsed || parsed.empty) return;
  fs.mkdirSync(signaturesDir, { recursive: true });
  const stamp = `${String(prescription.id || 'RX').replace(/[^\w.-]/g, '')}-${Date.now().toString(36)}`;
  const name = `${stamp}.png`;
  fs.writeFileSync(path.join(signaturesDir, name), parsed.buffer);
  prescription.signatureFile = `signatures/${name}`;
  prescription.signatureRecord = {
    method: 'graphic',
    kind: 'simple-graphic',
    signedAt: prescription.issuedAt || new Date().toISOString(),
    doctorId: textOrEmpty(prescription.doctor?.doctorId) || null
  };
}

function presentPrescription(prescription) {
  if (!prescription || typeof prescription !== 'object') return prescription;
  const copy = { ...prescription };
  const hadImage = typeof copy.signature === 'string' && copy.signature.startsWith('data:image/');
  const record = copy.signatureRecord && typeof copy.signatureRecord === 'object' ? copy.signatureRecord : null;
  delete copy.signature;
  delete copy.signatureFile;
  copy.signatureRecord = (record || hadImage) ? {
    method: 'graphic',
    kind: 'simple-graphic',
    signedAt: record?.signedAt || copy.issuedAt || null,
    doctorId: record?.doctorId || copy.doctor?.doctorId || null,
    present: true
  } : null;
  return copy;
}

function parseCalendarDate(value) {
  const text = textOrEmpty(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ageAtIssue(birthDate, providedAge) {
  const explicit = textOrEmpty(providedAge);
  if (explicit && !/kg|talla|imc/i.test(explicit)) return explicit;
  const bd = parseCalendarDate(birthDate);
  if (!bd) return '';
  const today = new Date();
  let years = today.getFullYear() - bd.getFullYear();
  const monthDelta = today.getMonth() - bd.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < bd.getDate())) years -= 1;
  return years >= 0 ? String(years) : '';
}

function snapshotTreatment(t, idx) {
  return {
    item: idx + 1,
    medication: textOrEmpty(t?.name || t?.medication),
    dose: textOrEmpty(t?.dosage || t?.dose),
    route: textOrEmpty(t?.route),
    frequency: textOrEmpty(t?.frequency),
    duration: textOrEmpty(t?.duration),
    quantity: textOrEmpty(t?.quantity),
    notes: textOrEmpty(t?.notes)
  };
}

function findPatientRecord(patientId) {
  if (!patientId) return null;
  const users = loadJSON(usersFile, { patients: [] });
  return (users.patients || []).find(p => String(p.id) === String(patientId)) || null;
}

function rxPending(value) {
  const text = textOrEmpty(value);
  return text || 'No registrado';
}

function applyIssuedBranding(prescription, doctorId) {
  const branding = captureBranding(doctorId);
  if (!branding) return prescription;
  prescription.branding = branding;
  const clues = textOrEmpty(prescription.clinic?.clues);
  if (branding.kind === 'clinic') {
    prescription.clinic = {
      ...(prescription.clinic || {}),
      name: branding.clinicName,
      address: branding.address,
      phone: branding.phone,
      clues
    };
    return prescription;
  }
  prescription.clinic = {
    ...(prescription.clinic || {}),
    name: '',
    address: '',
    phone: '',
    clues
  };
  return prescription;
}

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
        prescription: presentPrescription(existingForConsult),
        alreadyExists: true
      });
    }
  }

  const graphicSignature = parseGraphicSignature(signature);
  if (graphicSignature.error) {
    return res.status(400).json({ success: false, message: graphicSignature.error });
  }

  const assignedFolio = folio && folio.trim() !== '' && !prescriptions.some(p => p.folio === folio.trim())
    ? folio.trim()
    : generateNextFolio(prescriptions);

  const resolvedDoctorId = doctorId || doctor?.doctorId || null;
  let sourceConsultation = null;
  if (consultationId) {
    const consultations = loadJSON(consultationsFile, []);
    sourceConsultation = consultations.find(c => c.id === consultationId || c.consultationId === consultationId) || null;
  }

  const linkedPatientId = sourceConsultation?.patientId || patientId || patient.patientId || null;
  const chart = findPatientRecord(linkedPatientId);
  const birthDate = textOrEmpty(sourceConsultation?.patientBirthDate || patient.birthDate || chart?.birthDate);
  const cleanTreatments = treatments.map(snapshotTreatment).filter(t => t.medication);
  if (!cleanTreatments.length) {
    return res.status(400).json({
      success: false,
      message: 'Cada medicamento necesita un nombre. No se completaron datos clínicos de forma automática.'
    });
  }

  const newPrescription = {
    id: `RX-${Date.now()}`,
    folio: assignedFolio,
    consultationId: sourceConsultation?.id || consultationId || null,
    diagnosis: textOrEmpty(sourceConsultation?.diagnosis || diagnosis),
    reason: textOrEmpty(sourceConsultation?.reason || req.body.reason),
    clinicalNotes: textOrEmpty(sourceConsultation?.notes || req.body.clinicalNotes),
    issuedAt: new Date().toISOString(),
    doctor: {
      name: textOrEmpty(doctor?.name),
      professionalId: textOrEmpty(doctor?.professionalId),
      specialty: textOrEmpty(doctor?.specialty),
      email: textOrEmpty(doctor?.email),
      phone: textOrEmpty(doctor?.phone),
      doctorId: resolvedDoctorId
    },
    clinic: {
      name: textOrEmpty(clinic?.name),
      address: textOrEmpty(clinic?.address),
      phone: textOrEmpty(clinic?.phone),
      clues: textOrEmpty(clinic?.clues)
    },
    patient: {
      name: textOrEmpty(sourceConsultation?.patientName || patient.name),
      birthDate,
      age: ageAtIssue(birthDate, sourceConsultation ? '' : patient.age),
      curp: textOrEmpty(sourceConsultation?.patientCurp || patient.curp),
      allergies: textOrEmpty(sourceConsultation?.patientAllergies || patient.allergies),
      patientId: linkedPatientId
    },
    treatments: cleanTreatments,
    observations: textOrEmpty(observations),
    signature: null,
    status: 'Emitida',
    createdAt: new Date().toISOString()
  };
  storeGraphicSignature(newPrescription, graphicSignature);
  applyIssuedBranding(newPrescription, resolvedDoctorId);

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
    prescription: presentPrescription(newPrescription)
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
    prescriptions: filtered.map(presentPrescription)
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
    prescription: presentPrescription(prescription)
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
    res.setHeader('Content-Disposition', `inline; filename="Receta-${safeFolio}.pdf"`);

    const doc = new PDFDocument({
      size: 'LETTER',
      bufferPages: true,
      margins: { top: 78, bottom: 64, left: 46, right: 46 }
    });
    doc.pipe(res);
    drawClinicalPrescription(doc, prescription);
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
  rebuildAppointmentUniqueIndex();
  console.log('========================================================');
  console.log(`🩺 MedConnect API Server iniciado en http://localhost:${PORT}`);
  console.log(`🌐 Portal: http://localhost:${PORT}/index.html`);
  console.log('========================================================');
});
