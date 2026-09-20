/**
 * MedConnect API Client (Conector HTTP Frontend-Backend)
 * Proporciona métodos unificados para comunicar el Portal Médico con MedConnectApi.
 * Si la API no está disponible en localhost:5000, opera en modo local con fallback transparente.
 */

const MedConnectAPI = (() => {
  const API_BASE_URL = window.MEDCONNECT_API_URL || 'http://localhost:5000';
  let isApiOnline = null;

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

    const token = localStorage.getItem('medconnect_auth_token');
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
    // 1. AUTENTICACIÓN Y SESIÓN
    // =========================================================
    async login(role, credential, password) {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ role, credential, password })
      });

      if (res.ok && res.data?.token) {
        localStorage.setItem('medconnect_auth_token', res.data.token);
        localStorage.setItem('medconnect_user_role', role);
        if (res.data.user) {
          localStorage.setItem('medconnect_active_user', JSON.stringify(res.data.user));
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
      localStorage.removeItem('medconnect_auth_token');
      localStorage.removeItem('medconnect_user_role');
      localStorage.removeItem('medconnect_active_user');
      localStorage.removeItem('medconnect_active_patient');
    },

    getActiveUser() {
      try {
        const raw = localStorage.getItem('medconnect_active_user');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    // =========================================================
    // 2. PERFIL DEL PACIENTE
    // =========================================================
    async getPatientProfile() {
      return await request('/api/patient/profile');
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
        stored.unshift(savedRx);
        localStorage.setItem('medconnect_prescriptions', JSON.stringify(stored));
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

    // =========================================================
    // 5. CARRUSEL Y RECURSOS
    // =========================================================
    async getCarouselSlides() {
      return await request('/api/carousel');
    }
  };
})();

// Exportar globalmente
window.MedConnectAPI = MedConnectAPI;
