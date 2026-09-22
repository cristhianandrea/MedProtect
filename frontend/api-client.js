/**
 * MedConnect API Client (Conector HTTP Frontend-Backend)
 * Proporciona métodos unificados para comunicar el Portal Médico con MedConnectApi.
 * Si la API no está disponible en localhost:5000, opera en modo local con fallback transparente.
 */

const MedConnectAPI = (() => {
  const API_BASE_URL = window.MEDCONNECT_API_URL || 'http://localhost:5000';
  let isApiOnline = null;

  const AUTH_TOKEN_KEY = 'medconnect_auth_token';
  const AUTH_ROLE_KEY = 'medconnect_user_role';
  const AUTH_USER_KEY = 'medconnect_active_user';
  const AUTH_PATIENT_KEY = 'medconnect_active_patient';
  const PUBLIC_HOME = 'index.html';
  const ROLE_HOME = {
    doctor: 'medico-dashboard.html#inicio',
    patient: 'paciente-dashboard.html',
    minor: 'paciente-dashboard.html'
    // clinic: no dedicated dashboard exists — do not invent one
  };

  function readStoredUser() {
    try {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function currentPageName() {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    const name = path.split('/').filter(Boolean).pop() || PUBLIC_HOME;
    return String(name).toLowerCase();
  }

  function isPublicLandingPage() {
    const name = currentPageName();
    return name === PUBLIC_HOME || name === 'index' || name === '';
  }

  function homePageName(url) {
    return String(url || PUBLIC_HOME).split('#')[0].split('?')[0].toLowerCase() || PUBLIC_HOME;
  }

  function isLogoutControl(el) {
    if (!el) return true;
    const id = String(el.id || '').toLowerCase();
    if (id.includes('logout')) return true;
    if (el.classList && (el.classList.contains('btn-header-logout') || el.classList.contains('btn-logout'))) return true;
    if (typeof el.closest === 'function' && el.closest('#btnLogoutPatient, #btnLogoutDoctor, #btnLogoutDoctorRx, .btn-header-logout')) {
      return true;
    }
    return false;
  }

  function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
  }

  function roleMatches(currentRole, expected) {
    if (!expected) return true;
    const current = normalizeRole(currentRole);
    const want = normalizeRole(expected);
    if (want === 'patient') return current === 'patient' || current === 'minor';
    return current === want;
  }

  /**
   * Verifica la conectividad con el backend
   */
  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        isApiOnline = true;
        return true;
      }
    } catch (e) {
      isApiOnline = false;
    }
    return false;
  }

  /**
   * Helper genérico para peticiones HTTP
   */
  async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });

      const data = await response.json();
      return {
        ok: response.ok,
        status: response.status,
        data
      };
    } catch (error) {
      console.warn(`[MedConnectAPI] Error de conexión con ${url}:`, error.message);
      return {
        ok: false,
        status: 0,
        error: error.message,
        isOffline: true
      };
    }
  }

  return {
    getBaseUrl: () => API_BASE_URL,
    checkHealth,

    // =========================================================
    // 1. AUTENTICACIÓN (login, session, logout)
    //     NAVIGATION never calls these except getAuthenticatedHomeUrl / requireAuth.
    //     logout() is the ONLY function that clears token/role/user.
    // =========================================================
    async login(role, credential, password) {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ role, credential, password })
      });

      if (res.ok && res.data?.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, res.data.token);
        localStorage.setItem(AUTH_ROLE_KEY, role);
        if (res.data.user) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.data.user));
        }
      }
      return res;
    },

    async register(role, userData) {
      return await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ role, data: userData })
      });
    },

    logout() {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_ROLE_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_PATIENT_KEY);
    },

    getActiveUser() {
      return readStoredUser();
    },

    getSessionUser() {
      return this.getActiveUser();
    },

    isAuthenticated() {
      return !!(localStorage.getItem(AUTH_TOKEN_KEY) && this.getSessionUser());
    },

    getUserRole() {
      const stored = normalizeRole(localStorage.getItem(AUTH_ROLE_KEY));
      const user = this.getSessionUser();
      return stored || normalizeRole(user && user.role) || null;
    },

    getAuthenticatedHomeUrl() {
      if (!this.isAuthenticated()) return PUBLIC_HOME;
      const role = this.getUserRole();
      return ROLE_HOME[role] || PUBLIC_HOME;
    },

    requireAuth(role) {
      if (!this.isAuthenticated()) return false;
      if (!role) return true;
      return roleMatches(this.getUserRole(), role);
    },

    applyAuthenticatedNavigation() {
      const home = this.isAuthenticated() ? this.getAuthenticatedHomeUrl() : PUBLIC_HOME;
      const bound = document.querySelectorAll('#brandHomeLink, #publicBrandLink, a[data-nav-home]');
      bound.forEach((el) => {
        if (isLogoutControl(el)) return;
        el.setAttribute('href', home);
      });

      document.querySelectorAll('a.nav-link').forEach((el) => {
        if (isLogoutControl(el)) return;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (text === 'inicio' || text.endsWith(' inicio')) {
          el.setAttribute('href', home);
        }
      });

      const portal = document.getElementById('portalMedicoLink');
      if (portal && this.isAuthenticated()) {
        portal.setAttribute('href', home);
      }
    },

    redirectIfAuthenticatedOnPublicLanding() {
      if (!this.isAuthenticated() || !isPublicLandingPage()) return false;
      const home = this.getAuthenticatedHomeUrl();
      const destPage = homePageName(home);
      if (!destPage || destPage === PUBLIC_HOME || destPage === 'index') return false;
      window.location.replace(home);
      return true;
    },

    isDoctorSession() {
      return this.requireAuth('doctor');
    },

    getDoctorHomeUrl() {
      return ROLE_HOME.doctor;
    },

    // =========================================================
    // 2. PERFIL DEL PACIENTE
    // =========================================================
    async getPatientProfile() {
      return await request('/api/patient/profile');
    },

    // =========================================================
    // 2.1 GESTIÓN DE PACIENTES PARA MÉDICOS
    // =========================================================
    async getPatients(query = '') {
      const qStr = query ? `?q=${encodeURIComponent(query)}` : '';
      return await request(`/api/patients${qStr}`);
    },

    // =========================================================
    // 2.2 PERFIL Y GESTIÓN DE MÉDICOS
    // =========================================================
    async getDoctorProfile(professionalId = '', id = '') {
      const params = new URLSearchParams();
      if (professionalId) params.set('professionalId', professionalId);
      if (id) params.set('id', id);
      const qStr = params.toString() ? `?${params.toString()}` : '';
      return await request(`/api/doctor/profile${qStr}`);
    },

    async updateDoctorProfile(doctorData) {
      return await request('/api/doctor/profile', {
        method: 'PUT',
        body: JSON.stringify(doctorData)
      });
    },

    // =========================================================
    // 2.3 CONSULTAS MÉDICAS (EXPEDIENTE CLÍNICO)
    // =========================================================
    async createConsultation(consultationData) {
      const res = await request('/api/consultations', {
        method: 'POST',
        body: JSON.stringify(consultationData)
      });

      // Guardado de respaldo local
      try {
        const stored = JSON.parse(localStorage.getItem('medconnect_consultations') || '[]');
        const savedCon = (res.ok && res.data?.consultation)
          ? res.data.consultation
          : {
              ...consultationData,
              id: `CON-${Date.now()}`,
              consultationId: `CON-${Date.now()}`,
              status: 'Pendiente',
              createdAt: new Date().toISOString()
            };
        stored.unshift(savedCon);
        localStorage.setItem('medconnect_consultations', JSON.stringify(stored));
        if (!res.ok) {
          return {
            ok: true,
            status: 201,
            data: {
              success: true,
              message: 'Consulta guardada localmente.',
              consultationId: savedCon.id,
              consultation: savedCon,
              isOffline: true
            }
          };
        }
      } catch (err) {
        console.warn('Error en respaldo de consultas:', err);
      }
      return res;
    },

    async getConsultations(filters = {}) {
      const query = new URLSearchParams(filters).toString();
      const endpoint = `/api/consultations${query ? `?${query}` : ''}`;
      const res = await request(endpoint);
      if (res.ok && res.data?.consultations) {
        return res;
      }
      const stored = JSON.parse(localStorage.getItem('medconnect_consultations') || '[]');
      let list = stored;
      if (filters.doctorId) {
        list = list.filter(c => c.doctorId === filters.doctorId || c.doctorLicense === filters.doctorId);
      }
      if (filters.patientId) {
        list = list.filter(c => c.patientId === filters.patientId || c.patientCurp === filters.patientId);
      }
      return {
        ok: true,
        status: 200,
        data: {
          success: true,
          count: list.length,
          consultations: list,
          isOffline: true
        }
      };
    },

    async getConsultationById(id) {
      const res = await request(`/api/consultations/${encodeURIComponent(id)}`);
      if (res.ok && res.data?.consultation) {
        return res;
      }
      const stored = JSON.parse(localStorage.getItem('medconnect_consultations') || '[]');
      const found = stored.find(c => c.id === id || c.consultationId === id);
      return {
        ok: !!found,
        status: found ? 200 : 404,
        data: {
          success: !!found,
          consultation: found || null,
          isOffline: true
        }
      };
    },

    async linkPrescriptionToConsultation(id, prescriptionId, folio) {
      const res = await request(`/api/consultations/${encodeURIComponent(id)}/prescription`, {
        method: 'PUT',
        body: JSON.stringify({ prescriptionId, folio })
      });

      // Actualizar respaldo local
      try {
        const stored = JSON.parse(localStorage.getItem('medconnect_consultations') || '[]');
        const idx = stored.findIndex(c => c.id === id || c.consultationId === id);
        if (idx !== -1) {
          stored[idx].prescriptionId = prescriptionId;
          stored[idx].prescriptionFolio = folio;
          stored[idx].status = 'Completada';
          localStorage.setItem('medconnect_consultations', JSON.stringify(stored));
        }
      } catch (e) {}

      return res;
    },

    // =========================================================
    // 3. CITAS MÉDICAS (AGENDA)
    // =========================================================
    async getAppointments() {
      return await request('/api/appointments');
    },

    async createAppointment(appointmentData) {
      return await request('/api/appointments', {
        method: 'POST',
        body: JSON.stringify(appointmentData)
      });
    },

    async rescheduleAppointment(id, newDate, newTime) {
      return await request(`/api/appointments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ date: newDate, time: newTime })
      });
    },

    async cancelAppointment(id) {
      return await request(`/api/appointments/${id}`, {
        method: 'DELETE'
      });
    },

    // =========================================================
    // 4. MEDICAMENTOS Y RECETAS MÉDICAS
    // =========================================================
    async getMedications(type = 'all') {
      const query = type && type !== 'all' ? `?type=${encodeURIComponent(type)}` : '';
      return await request(`/api/medications${query}`);
    },

    async getNextFolio() {
      const res = await request('/api/prescriptions/next-folio');
      if (res.ok && res.data?.nextFolio) {
        return res.data.nextFolio;
      }
      // Fallback local en caso de estar offline
      const stored = JSON.parse(localStorage.getItem('medconnect_prescriptions') || '[]');
      const year = new Date().getFullYear();
      const num = stored.length + 1;
      return `FOL-${year}-${String(num).padStart(4, '0')}`;
    },

    async createPrescription(prescriptionData) {
      const res = await request('/api/prescriptions', {
        method: 'POST',
        body: JSON.stringify(prescriptionData)
      });

      // Guardado redundante en localStorage para respaldo offline e historial
      try {
        const stored = JSON.parse(localStorage.getItem('medconnect_prescriptions') || '[]');
        const savedRx = (res.ok && res.data?.prescription) 
          ? res.data.prescription 
          : {
              ...prescriptionData,
              id: `RX-${Date.now()}`,
              folio: prescriptionData.folio || `FOL-${new Date().getFullYear()}-${String(stored.length + 1).padStart(4, '0')}`,
              issuedAt: new Date().toISOString()
            };
        if (res.ok && res.data?.alreadyExists) {
          return res;
        }
        const alreadyStored = stored.some(p => p.id === savedRx.id || p.folio === savedRx.folio);
        if (!alreadyStored) {
          stored.unshift(savedRx);
          localStorage.setItem('medconnect_prescriptions', JSON.stringify(stored));
        }
        if (!res.ok) {
          return {
            ok: true,
            status: 201,
            data: {
              success: true,
              message: `Receta guardada localmente con Folio: ${savedRx.folio}`,
              prescription: savedRx,
              isOffline: true
            }
          };
        }
      } catch (err) {
        console.warn('Error guardando en localStorage:', err);
      }

      return res;
    },

    async getPrescriptions(filters = {}) {
      const query = new URLSearchParams(filters).toString();
      const endpoint = `/api/prescriptions${query ? `?${query}` : ''}`;
      const res = await request(endpoint);
      if (res.ok && res.data?.prescriptions) {
        return res;
      }
      // Fallback local
      const stored = JSON.parse(localStorage.getItem('medconnect_prescriptions') || '[]');
      return {
        ok: true,
        status: 200,
        data: {
          success: true,
          count: stored.length,
          prescriptions: stored,
          isOffline: true
        }
      };
    },

    async getPrescriptionByFolio(folio) {
      const res = await request(`/api/prescriptions/${encodeURIComponent(folio)}`);
      if (res.ok && res.data?.prescription) {
        return res;
      }
      const stored = JSON.parse(localStorage.getItem('medconnect_prescriptions') || '[]');
      const found = stored.find(p => p.folio?.toLowerCase() === folio?.toLowerCase() || p.id === folio);
      return {
        ok: !!found,
        status: found ? 200 : 404,
        data: {
          success: !!found,
          prescription: found || null,
          isOffline: true
        }
      };
    },

    getPrescriptionPdfUrl(folio) {
      return `${API_BASE_URL}/api/prescriptions/${encodeURIComponent(folio)}/pdf`;
    },

    async downloadPrescriptionPdf(folio) {
      const url = this.getPrescriptionPdfUrl(folio);
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error('No se pudo generar el PDF de la receta.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `Receta-${String(folio).replace(/[^\w.-]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      return true;
    },

    // =========================================================
    // 5. CARRUSEL Y RECURSOS
    // =========================================================
    async getCarouselSlides() {
      return await request('/api/carousel');
    }
  };
})();

window.MedConnectAPI = MedConnectAPI;

(function bootAuthNavigationContract() {
  function run() {
    const api = window.MedConnectAPI;
    if (!api) return;
    if (typeof api.redirectIfAuthenticatedOnPublicLanding === 'function' && api.redirectIfAuthenticatedOnPublicLanding()) {
      return;
    }
    if (typeof api.applyAuthenticatedNavigation === 'function') {
      api.applyAuthenticatedNavigation();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
