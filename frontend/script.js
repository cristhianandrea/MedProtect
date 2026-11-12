/**
 * MedConnect: Portal de Acceso Universal y Red de Salud
 * Lógica Interactiva para Gestión de Perfiles (Pacientes Adultos, Menores, Médicos, Clínicas),
 * Validación Estricta de CURP, Alergias, Cédula Profesional y Modales de Acceso y Registro.
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================
  // 1. MODAL 0: INICIO DE SESIÓN MULTI-ROL (#loginModal)
  // =========================================================
  const loginModal = document.getElementById('loginModal');
  const btnHeaderLogin = document.getElementById('btnHeaderLogin');
  const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
  const btnSwitchToAffiliationFromLogin = document.getElementById('btnSwitchToAffiliationFromLogin');
  const loginRoleTabs = document.querySelectorAll('.login-role-tab');
  const loginRolePanels = {
    patient: document.getElementById('loginPanelPatient'),
    minor: document.getElementById('loginPanelMinor'),
    doctor: document.getElementById('loginPanelDoctor'),
    clinic: document.getElementById('loginPanelClinic')
  };
  const loginModalAlert = document.getElementById('loginModalAlert');

  let currentLoginRole = 'patient';

  function switchLoginRole(targetRole) {
    if (!loginRolePanels[targetRole]) return;
    currentLoginRole = targetRole;

    // Actualizar tabs del modal de login
    loginRoleTabs.forEach(tab => {
      const isSelected = tab.getAttribute('data-login-role') === targetRole;
      tab.classList.toggle('active', isSelected);
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    // Mostrar el panel de login correspondiente
    Object.keys(loginRolePanels).forEach(role => {
      if (role === targetRole) {
        loginRolePanels[role].classList.remove('hidden');
        loginRolePanels[role].classList.add('active');
      } else {
        loginRolePanels[role].classList.add('hidden');
        loginRolePanels[role].classList.remove('active');
      }
    });

    // Limpiar alertas dentro del modal de login
    if (loginModalAlert) loginModalAlert.classList.add('hidden');
  }

  function openLoginModal(role = 'patient') {
    closeAffiliationChooser();
    closeMinorGuide();
    if (loginModal) {
      loginModal.classList.remove('hidden');
      switchLoginRole(role);
    }
  }

  function closeLoginModal() {
    if (loginModal) {
      loginModal.classList.add('hidden');
      if (loginModalAlert) loginModalAlert.classList.add('hidden');
    }
  }

  if (btnHeaderLogin) btnHeaderLogin.addEventListener('click', () => openLoginModal('patient'));
  if (closeLoginModalBtn) closeLoginModalBtn.addEventListener('click', closeLoginModal);
  
  if (btnSwitchToAffiliationFromLogin) {
    btnSwitchToAffiliationFromLogin.addEventListener('click', () => {
      closeLoginModal();
      openAffiliationChooser();
    });
  }

  // Eventos de click en pestañas del modal de login
  loginRoleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const role = tab.getAttribute('data-login-role');
      switchLoginRole(role);
    });
  });

  // Eventos de click en enlaces del footer para abrir login con perfil específico
  const footerRoleLinks = document.querySelectorAll('.footer-link-action');
  footerRoleLinks.forEach(link => {
    link.addEventListener('click', () => {
      const role = link.getAttribute('data-target-role') || 'patient';
      openLoginModal(role);
    });
  });

  // =========================================================
  // 2. CARRUSEL VISUAL CLÍNICO DEL HERO
  // =========================================================
  const heroCarousel = document.getElementById('heroCarousel');
  const carouselSlides = document.querySelectorAll('.carousel-slide');
  const carouselDots = document.querySelectorAll('.carousel-dot');
  const carouselPrevBtn = document.getElementById('carouselPrevBtn');
  const carouselNextBtn = document.getElementById('carouselNextBtn');

  let currentSlideIndex = 0;
  let carouselAutoplayInterval = null;

  function showSlide(index) {
    if (!carouselSlides || carouselSlides.length === 0) return;
    
    if (index >= carouselSlides.length) currentSlideIndex = 0;
    else if (index < 0) currentSlideIndex = carouselSlides.length - 1;
    else currentSlideIndex = index;

    carouselSlides.forEach((slide, i) => {
      slide.classList.toggle('active', i === currentSlideIndex);
    });

    carouselDots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlideIndex);
    });
  }

  function nextSlide() {
    showSlide(currentSlideIndex + 1);
  }

  function prevSlide() {
    showSlide(currentSlideIndex - 1);
  }

  function startCarouselAutoplay() {
    stopCarouselAutoplay();
    carouselAutoplayInterval = setInterval(nextSlide, 4500);
  }

  function stopCarouselAutoplay() {
    if (carouselAutoplayInterval) {
      clearInterval(carouselAutoplayInterval);
      carouselAutoplayInterval = null;
    }
  }

  if (carouselNextBtn) {
    carouselNextBtn.addEventListener('click', () => {
      nextSlide();
      startCarouselAutoplay();
    });
  }

  if (carouselPrevBtn) {
    carouselPrevBtn.addEventListener('click', () => {
      prevSlide();
      startCarouselAutoplay();
    });
  }

  carouselDots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      showSlide(idx);
      startCarouselAutoplay();
    });
  });

  if (heroCarousel) {
    heroCarousel.addEventListener('mouseenter', stopCarouselAutoplay);
    heroCarousel.addEventListener('mouseleave', startCarouselAutoplay);
    startCarouselAutoplay();

    // Sincronizar imágenes del carrusel con MedConnectApi si está disponible
    if (window.MedConnectAPI) {
      window.MedConnectAPI.getCarouselSlides().then(res => {
        if (res.ok && res.data?.slides) {
          carouselSlides.forEach((slide, idx) => {
            const slideData = res.data.slides[idx];
            if (slideData && slideData.image) {
              const img = slide.querySelector('img');
              if (img) {
                const apiImgUrl = `${window.MedConnectAPI.getBaseUrl()}${slideData.image}`;
                const testImg = new Image();
                testImg.onload = () => {
                  img.src = apiImgUrl;
                  img.style.display = 'block';
                  const ph = slide.querySelector('.carousel-placeholder-box');
                  if (ph) ph.style.display = 'none';
                };
                testImg.src = apiImgUrl;
              }
            }
          });
        }
      }).catch(() => {});
    }
  }

  // =========================================================
  // 3. MODAL 0.5: SELECTOR DE AFILIACIÓN (#modalAffiliationChooser)
  // =========================================================
  const modalAffiliationChooser = document.getElementById('modalAffiliationChooser');
  const btnHeaderAffiliate = document.getElementById('btnHeaderAffiliate');
  const bannerRegisterBtn = document.getElementById('bannerRegisterBtn');
  const closeAffiliateChooserBtn = document.getElementById('closeAffiliateChooserBtn');
  const choosePatientRegisterBtn = document.getElementById('choosePatientRegisterBtn');
  const chooseMinorRegisterBtn = document.getElementById('chooseMinorRegisterBtn');
  const chooseDoctorRegisterBtn = document.getElementById('chooseDoctorRegisterBtn');
  const chooseClinicRegisterBtn = document.getElementById('chooseClinicRegisterBtn');
  const linkLoginFromChooser = document.getElementById('linkLoginFromChooser');

  const openAffiliationChooser = () => {
    closeLoginModal();
    if (modalAffiliationChooser) modalAffiliationChooser.classList.remove('hidden');
  };

  const closeAffiliationChooser = () => {
    if (modalAffiliationChooser) modalAffiliationChooser.classList.add('hidden');
  };

  if (btnHeaderAffiliate) btnHeaderAffiliate.addEventListener('click', openAffiliationChooser);
  if (bannerRegisterBtn) bannerRegisterBtn.addEventListener('click', openAffiliationChooser);
  if (closeAffiliateChooserBtn) closeAffiliateChooserBtn.addEventListener('click', closeAffiliationChooser);

  if (linkLoginFromChooser) {
    linkLoginFromChooser.addEventListener('click', (e) => {
      e.preventDefault();
      closeAffiliationChooser();
      openLoginModal('patient');
    });
  }

  // =========================================================
  // 3.1 MODAL GUÍA DE REGISTRO DE MENORES DE EDAD
  // =========================================================
  const minorGuideModal = document.getElementById('minorGuideModal');
  const btnOpenMinorGuideModal = document.getElementById('btnOpenMinorGuideModal');
  const closeMinorGuideModalBtn = document.getElementById('closeMinorGuideModalBtn');

  const openMinorGuide = () => {
    closeLoginModal();
    if (minorGuideModal) minorGuideModal.classList.remove('hidden');
  };

  const closeMinorGuide = () => {
    if (minorGuideModal) minorGuideModal.classList.add('hidden');
  };

  if (btnOpenMinorGuideModal) btnOpenMinorGuideModal.addEventListener('click', openMinorGuide);
  if (closeMinorGuideModalBtn) closeMinorGuideModalBtn.addEventListener('click', closeMinorGuide);

  // =========================================================
  // 4. TOGGLE PARA MOSTRAR / OCULTAR CONTRASEÑA (GENÉRICO)
  // =========================================================
  const passwordToggles = document.querySelectorAll('.password-toggle');
  passwordToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const targetId = toggle.getAttribute('data-toggle-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');

      const eyeOpen = toggle.querySelector('.eye-open');
      const eyeClosed = toggle.querySelector('.eye-closed');

      if (isPassword) {
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClosed) eyeClosed.classList.remove('hidden');
        toggle.setAttribute('aria-label', 'Ocultar contraseña');
      } else {
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClosed) eyeClosed.classList.add('hidden');
        toggle.setAttribute('aria-label', 'Mostrar contraseña');
      }
    });
  });

  // =========================================================
  // 5. ENVÍO Y VALIDACIÓN DE FORMULARIOS DE LOGIN (4 PERFILES)
  // =========================================================
  
  // 5.1 Login Paciente Adulto (Redirección directa a la vista de paciente)
  const patientLoginForm = document.getElementById('patientLoginForm');
  const patientCredential = document.getElementById('patientCredential');
  const patientPassword = document.getElementById('patientPassword');
  const patientLoginBtn = document.getElementById('patientLoginBtn');

  if (patientLoginForm) {
    const handlePatientLogin = async (e) => {
      if (e) e.preventDefault();
      const cred = (patientCredential && patientCredential.value || '').trim();
      const pass = patientPassword ? patientPassword.value : '';
      const patientUserError = document.getElementById('patientUserError');
      const patientPasswordError = document.getElementById('patientPasswordError');

      if (!cred) {
        showFieldError(patientCredential, patientUserError, 'Ingresa tu CURP, teléfono o correo.');
        return;
      }
      if (!pass) {
        showFieldError(patientPassword, patientPasswordError, 'Ingresa tu contraseña.');
        return;
      }

      setButtonLoading(patientLoginBtn, true, 'Accediendo al Portal del Paciente...');

      if (!window.MedConnectAPI) {
        setButtonLoading(patientLoginBtn, false, 'Iniciar Sesión en Portal Paciente');
        showAlert(loginModalAlert, 'error', 'Cliente de API no disponible. Recarga la página.');
        return;
      }

      try {
        const loginRes = await window.MedConnectAPI.login('patient', cred, pass);
        if (!loginRes.ok) {
          setButtonLoading(patientLoginBtn, false, 'Iniciar Sesión en Portal Paciente');
          showAlert(loginModalAlert, 'error', loginRes.data?.message || 'Paciente no encontrado. Verifica tus datos.');
          return;
        }
      } catch (err) {
        setButtonLoading(patientLoginBtn, false, 'Iniciar Sesión en Portal Paciente');
        showAlert(loginModalAlert, 'error', 'No se pudo conectar con el servidor. Inicia el backend en el puerto 5000.');
        return;
      }

      showAlert(loginModalAlert, 'success', '¡Acceso concedido! Abriendo Portal del Paciente...');
      setTimeout(() => {
        window.location.href = window.MedConnectAPI.getAuthenticatedHomeUrl();
      }, 200);
    };

    patientLoginForm.addEventListener('submit', handlePatientLogin);
  }

  // 5.2 Login Menor de Edad / Tutor (Redirección directa a la vista de paciente)
  const minorLoginForm = document.getElementById('minorLoginForm');
  const minorLoginBtn = document.getElementById('minorLoginBtn');

  if (minorLoginForm) {
    minorLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const codeInput = document.getElementById('minorLoginCode');
      const passInput = document.getElementById('minorLoginPassword');
      const cred = (codeInput && codeInput.value || '').trim();
      const pass = passInput ? passInput.value : '';

      if (!cred) {
        showAlert(loginModalAlert, 'error', 'Ingresa el código de expediente o CURP del menor.');
        return;
      }

      setButtonLoading(minorLoginBtn, true, 'Accediendo al expediente pediátrico...');

      if (!window.MedConnectAPI) {
        setButtonLoading(minorLoginBtn, false, 'Iniciar Sesión');
        showAlert(loginModalAlert, 'error', 'Cliente de API no disponible. Recarga la página.');
        return;
      }

      try {
        const loginRes = await window.MedConnectAPI.login('minor', cred, pass);
        if (!loginRes.ok) {
          setButtonLoading(minorLoginBtn, false, 'Iniciar Sesión');
          showAlert(loginModalAlert, 'error', loginRes.data?.message || 'Expediente no encontrado.');
          return;
        }
      } catch (err) {
        setButtonLoading(minorLoginBtn, false, 'Iniciar Sesión');
        showAlert(loginModalAlert, 'error', 'No se pudo conectar con el servidor.');
        return;
      }

      showAlert(loginModalAlert, 'success', 'Acceso concedido. Abriendo Portal del Paciente...');
      setTimeout(() => {
        window.location.href = window.MedConnectAPI.getAuthenticatedHomeUrl();
      }, 200);
    });
  }

  // 5.3 Login Médico
  const doctorLoginForm = document.getElementById('doctorLoginForm');
  const doctorCredential = document.getElementById('doctorCredential');
  const doctorPassword = document.getElementById('doctorPassword');
  const doctorUserError = document.getElementById('doctorUserError');
  const doctorPasswordError = document.getElementById('doctorPasswordError');
  const doctorLoginBtn = document.getElementById('doctorLoginBtn');

  if (doctorLoginForm) {
    doctorLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldError(doctorCredential, doctorUserError);
      clearFieldError(doctorPassword, doctorPasswordError);

      const cred = doctorCredential.value.trim();
      const pass = doctorPassword.value;

      if (!cred) {
        showFieldError(doctorCredential, doctorUserError, 'Ingresa tu Cédula Profesional o correo institucional.');
        return;
      }
      if (!pass) {
        showFieldError(doctorPassword, doctorPasswordError, 'Ingresa tu contraseña profesional.');
        return;
      }

      setButtonLoading(doctorLoginBtn, true, 'Validando Cédula en Base de Datos...');

      if (!window.MedConnectAPI) {
        setButtonLoading(doctorLoginBtn, false, 'Iniciar Sesión Médica');
        showAlert(loginModalAlert, 'error', 'Cliente de API no disponible. Recarga la página.');
        return;
      }

      try {
        const loginRes = await window.MedConnectAPI.login('doctor', cred, pass);
        if (!loginRes.ok) {
          setButtonLoading(doctorLoginBtn, false, 'Iniciar Sesión Médica');
          showAlert(loginModalAlert, 'error', loginRes.data?.message || 'Médico no registrado. Solicita tu afiliación o verifica la cédula.');
          return;
        }
      } catch (err) {
        setButtonLoading(doctorLoginBtn, false, 'Iniciar Sesión Médica');
        showAlert(loginModalAlert, 'error', 'No se pudo conectar con el servidor. Inicia el backend en el puerto 5000.');
        return;
      }

      setButtonLoading(doctorLoginBtn, false, 'Iniciar Sesión Médica');
      showAlert(loginModalAlert, 'success', `¡Acceso concedido! Abriendo Portal Médico...`);

      setTimeout(() => {
        window.location.href = window.MedConnectAPI.getAuthenticatedHomeUrl();
      }, 300);
    });

    doctorCredential.addEventListener('input', () => clearFieldError(doctorCredential, doctorUserError));
    doctorPassword.addEventListener('input', () => clearFieldError(doctorPassword, doctorPasswordError));
  }

  // 5.4 Login Clínica / Sede
  const clinicLoginForm = document.getElementById('clinicLoginForm');
  const clinicCredential = document.getElementById('clinicCredential');
  const clinicPassword = document.getElementById('clinicPassword');
  const clinicUserError = document.getElementById('clinicUserError');
  const clinicPasswordError = document.getElementById('clinicPasswordError');
  const clinicLoginBtn = document.getElementById('clinicLoginBtn');

  if (clinicLoginForm) {
    clinicLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldError(clinicCredential, clinicUserError);
      clearFieldError(clinicPassword, clinicPasswordError);

      const cred = clinicCredential.value.trim();
      const pass = clinicPassword.value;

      if (!cred) {
        showFieldError(clinicCredential, clinicUserError, 'Ingresa el ID de la clínica o correo oficial.');
        return;
      }
      if (!pass) {
        showFieldError(clinicPassword, clinicPasswordError, 'Ingresa la clave de administración.');
        return;
      }

      setButtonLoading(clinicLoginBtn, true, 'Validando sede en Base de Datos...');

      if (window.MedConnectAPI) {
        try {
          const loginRes = await window.MedConnectAPI.login('clinic', cred, pass);
          if (!loginRes.ok) {
            setButtonLoading(clinicLoginBtn, false, 'Acceso al Panel de Sede');
            showAlert(loginModalAlert, 'error', 'Sede clínica no encontrada en la base de datos.');
            return;
          }
        } catch (err) {}
      }

      setButtonLoading(clinicLoginBtn, false, 'Acceso al Panel de Sede');
      showAlert(loginModalAlert, 'success', `Conexión establecida con la sede: ${cred}.`);
    });

    clinicCredential.addEventListener('input', () => clearFieldError(clinicCredential, clinicUserError));
    clinicPassword.addEventListener('input', () => clearFieldError(clinicPassword, clinicPasswordError));
  }

  // =========================================================
  // 6. MODAL 1: REGISTRO DE PACIENTE (NUEVAS REGLAS)
  // =========================================================
  const registerPatientModal = document.getElementById('registerPatientModal');
  const openRegisterPatientModalBtn = document.getElementById('openRegisterPatientModalBtn');
  const btnUsePatientCta = document.getElementById('btnUsePatientCta');
  const closeRegisterPatientModalBtn = document.getElementById('closeRegisterPatientModalBtn');
  const cancelRegisterPatientBtn = document.getElementById('cancelRegisterPatientBtn');
  const registerPatientForm = document.getElementById('registerPatientForm');
  const patientRegisterAlert = document.getElementById('patientRegisterAlert');

  // Elementos del formulario de paciente
  const patFirstName = document.getElementById('patFirstName');
  const patLastNameP = document.getElementById('patLastNameP');
  const patLastNameM = document.getElementById('patLastNameM');
  const patBirthDate = document.getElementById('patBirthDate');
  const patGender = document.getElementById('patGender');
  const patCurp = document.getElementById('patCurp');
  const curpCounter = document.getElementById('curpCounter');
  const patPhone = document.getElementById('patPhone');
  const patEmail = document.getElementById('patEmail');
  const patBloodType = document.getElementById('patBloodType');
  const patAssignedClinic = document.getElementById('patAssignedClinic');
  const patNeighborhood = document.getElementById('patNeighborhood');
  const patMunicipalityState = document.getElementById('patMunicipalityState');
  const patAllergiesText = document.getElementById('patAllergiesText');
  const patAllergiesHelper = document.getElementById('patAllergiesHelper');
  const patNewPassword = document.getElementById('patNewPassword');
  const patConfirmPassword = document.getElementById('patConfirmPassword');

  // Errores específicos
  const patFirstNameError = document.getElementById('patFirstNameError');
  const patLastNamePError = document.getElementById('patLastNamePError');
  const patLastNameMError = document.getElementById('patLastNameMError');
  const patBirthDateError = document.getElementById('patBirthDateError');
  const patGenderError = document.getElementById('patGenderError');
  const patCurpError = document.getElementById('patCurpError');
  const patPhoneError = document.getElementById('patPhoneError');
  const patEmailError = document.getElementById('patEmailError');
  const patBloodTypeError = document.getElementById('patBloodTypeError');
  const patClinicError = document.getElementById('patClinicError');
  const patAllergiesError = document.getElementById('patAllergiesError');
  const patNewPassError = document.getElementById('patNewPassError');
  const patConfirmPassError = document.getElementById('patConfirmPassError');

  // Selector de Alergias Frecuentes y Opción "Otros"
  const allergyCheckboxes = document.querySelectorAll('input[name="allergyTag"]');
  const tagNoAllergies = document.getElementById('tagNoAllergies');
  const tagAllergyOthers = document.getElementById('tagAllergyOthers');

  function updateAllergiesState() {
    const isOthersChecked = tagAllergyOthers ? tagAllergyOthers.checked : false;

    if (patAllergiesText) {
      if (isOthersChecked) {
        patAllergiesText.disabled = false;
        patAllergiesText.placeholder = 'Escribe aquí tus alergias específicas (ej. Sulfametoxazol, fresas, polvo...)...';
        if (patAllergiesHelper) {
          patAllergiesHelper.textContent = '✏️ Ingresa los detalles de tus alergias específicas en este campo.';
        }
        patAllergiesText.focus();
      } else {
        patAllergiesText.disabled = true;
        patAllergiesText.value = '';
        patAllergiesText.placeholder = 'Selecciona la opción \'Otros\' arriba para ingresar tus alergias específicas aquí...';
        if (patAllergiesHelper) {
          patAllergiesHelper.textContent = 'El recuadro de texto se activará automáticamente al seleccionar la opción \'Otros\'.';
        }
      }
    }

    // Actualizar clases visuales de los tags
    allergyCheckboxes.forEach(cb => {
      if (cb.checked) {
        cb.closest('.allergy-tag-pill')?.classList.add('active');
      } else {
        cb.closest('.allergy-tag-pill')?.classList.remove('active');
      }
    });

    clearFieldError(patAllergiesText, patAllergiesError);
  }

  allergyCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox === tagNoAllergies && tagNoAllergies.checked) {
        // Desmarcar todas las demás si marca "Sin alergias"
        allergyCheckboxes.forEach(cb => {
          if (cb !== tagNoAllergies) cb.checked = false;
        });
      } else if (checkbox.checked && checkbox !== tagNoAllergies) {
        // Desmarcar "Sin alergias" si marca alguna específica u Otros
        if (tagNoAllergies) tagNoAllergies.checked = false;
      }
      updateAllergiesState();
    });
  });

  // Contador en tiempo real y auto-mayúsculas para CURP (Opcional)
  if (patCurp && curpCounter) {
    patCurp.addEventListener('input', () => {
      patCurp.value = patCurp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const len = patCurp.value.length;
      curpCounter.textContent = `${len}/18`;
      if (len === 18) {
        curpCounter.classList.add('valid');
        clearFieldError(patCurp, patCurpError);
      } else {
        curpCounter.classList.remove('valid');
      }
    });
  }

  const openPatientModal = () => {
    closeAffiliationChooser();
    registerPatientModal.classList.remove('hidden');
    if (patFirstName) patFirstName.focus();
  };

  const closePatientModal = () => {
    registerPatientModal.classList.add('hidden');
    registerPatientForm.reset();
    if (curpCounter) {
      curpCounter.textContent = '0/18';
      curpCounter.classList.remove('valid');
    }
    allergyCheckboxes.forEach(cb => {
      cb.checked = false;
      cb.closest('.allergy-tag-pill')?.classList.remove('active');
    });
    if (patAllergiesText) {
      patAllergiesText.disabled = true;
      patAllergiesText.value = '';
    }
    patientRegisterAlert.classList.add('hidden');
    clearPatientErrors();
  };

  function clearPatientErrors() {
    clearFieldError(patFirstName, patFirstNameError);
    clearFieldError(patLastNameP, patLastNamePError);
    clearFieldError(patLastNameM, patLastNameMError);
    clearFieldError(patBirthDate, patBirthDateError);
    clearFieldError(patGender, patGenderError);
    clearFieldError(patCurp, patCurpError);
    clearFieldError(patPhone, patPhoneError);
    clearFieldError(patEmail, patEmailError);
    clearFieldError(patBloodType, patBloodTypeError);
    clearFieldError(patAssignedClinic, patClinicError);
    clearFieldError(patAllergiesText, patAllergiesError);
    clearFieldError(patNewPassword, patNewPassError);
    clearFieldError(patConfirmPassword, patConfirmPassError);
  }

  if (openRegisterPatientModalBtn) openRegisterPatientModalBtn.addEventListener('click', openPatientModal);
  if (btnUsePatientCta) btnUsePatientCta.addEventListener('click', openPatientModal);
  if (choosePatientRegisterBtn) choosePatientRegisterBtn.addEventListener('click', openPatientModal);
  if (closeRegisterPatientModalBtn) closeRegisterPatientModalBtn.addEventListener('click', closePatientModal);
  if (cancelRegisterPatientBtn) cancelRegisterPatientBtn.addEventListener('click', closePatientModal);

  // Validación y Envío del Formulario de Registro de Paciente (NUEVAS REGLAS)
  if (registerPatientForm) {
    registerPatientForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearPatientErrors();
      let hasError = false;

      // 1. Nombre(s) (Obligatorio)
      const firstName = patFirstName.value.trim();
      if (!firstName) {
        showFieldError(patFirstName, patFirstNameError, 'El nombre del paciente es obligatorio.');
        hasError = true;
      }

      // 2. Apellido Paterno (Obligatorio)
      const lastNameP = patLastNameP.value.trim();
      if (!lastNameP) {
        showFieldError(patLastNameP, patLastNamePError, 'El apellido paterno es obligatorio.');
        hasError = true;
      }

      // 3. Apellido Materno (Obligatorio)
      const lastNameM = patLastNameM.value.trim();
      if (!lastNameM) {
        showFieldError(patLastNameM, patLastNameMError, 'El apellido materno es obligatorio.');
        hasError = true;
      }

      // 4. Fecha de Nacimiento (OBLIGATORIA)
      const birthDateVal = patBirthDate.value;
      if (!birthDateVal) {
        showFieldError(patBirthDate, patBirthDateError, 'La fecha de nacimiento es obligatoria.');
        hasError = true;
      }

      // 5. Género (OBLIGATORIO)
      const genderVal = patGender.value;
      if (!genderVal) {
        showFieldError(patGender, patGenderError, 'Por favor selecciona un género.');
        hasError = true;
      }

      // 6. Teléfono Celular (OBLIGATORIO - 10 dígitos)
      const phoneVal = patPhone.value.trim().replace(/\D/g, '');
      if (!phoneVal) {
        showFieldError(patPhone, patPhoneError, 'El número de teléfono celular es obligatorio.');
        hasError = true;
      } else if (phoneVal.length < 10) {
        showFieldError(patPhone, patPhoneError, 'El teléfono debe contener al menos 10 dígitos.');
        hasError = true;
      }

      // 7. Tipo de Sangre (OBLIGATORIO)
      const bloodTypeVal = patBloodType.value;
      if (!bloodTypeVal) {
        showFieldError(patBloodType, patBloodTypeError, 'Selecciona tu tipo de sangre para emergencias y expediente.');
        hasError = true;
      }

      // 8. CURP (OPCIONAL - solo valida formato si se ingresó)
      const curpVal = patCurp.value.trim();
      if (curpVal) {
        const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;
        if (curpVal.length !== 18) {
          showFieldError(patCurp, patCurpError, `La CURP ingresada debe tener 18 caracteres (actualmente: ${curpVal.length}).`);
          hasError = true;
        } else if (!curpRegex.test(curpVal)) {
          showFieldError(patCurp, patCurpError, 'El formato de CURP no es válido.');
          hasError = true;
        }
      }

      // 9. Correo Electrónico (OPCIONAL - solo valida formato si se ingresó)
      const emailVal = patEmail.value.trim();
      if (emailVal && !validateEmail(emailVal)) {
        showFieldError(patEmail, patEmailError, 'Ingresa un correo electrónico con formato válido.');
        hasError = true;
      }

      // 10. Alergias Conocidas (OBLIGATORIO: al menos 1 tag o "Otros" con texto)
      const anyTagChecked = Array.from(allergyCheckboxes).some(cb => cb.checked);
      const isOthersChecked = tagAllergyOthers && tagAllergyOthers.checked;
      const customAllergyText = patAllergiesText ? patAllergiesText.value.trim() : '';

      if (!anyTagChecked) {
        showFieldError(patAllergiesText, patAllergiesError, 'Debes seleccionar tus alergias o marcar "Sin Alergias Conocidas".');
        hasError = true;
      } else if (isOthersChecked && !customAllergyText) {
        showFieldError(patAllergiesText, patAllergiesError, 'Has marcado la opción "Otros". Por favor escribe tus alergias en el recuadro.');
        hasError = true;
      }

      // 11. Contraseña y confirmación (Obligatorio)
      const newPass = patNewPassword.value;
      const confirmPass = patConfirmPassword.value;
      if (!newPass) {
        showFieldError(patNewPassword, patNewPassError, 'Crea una contraseña para tu portal.');
        hasError = true;
      } else if (newPass.length < 6) {
        showFieldError(patNewPassword, patNewPassError, 'La contraseña debe tener al menos 6 caracteres.');
        hasError = true;
      }

      if (newPass !== confirmPass) {
        showFieldError(patConfirmPassword, patConfirmPassError, 'Las contraseñas no coinciden.');
        hasError = true;
      }

      if (hasError) {
        showAlert(patientRegisterAlert, 'error', 'Por favor, revisa y completa los campos obligatorios señalados.');
        return;
      }

      // Proceso de Envío Exitoso
      const submitBtn = document.getElementById('registerPatientSubmitBtn');
      setButtonLoading(submitBtn, true, 'Creando expediente digital...');

      const selectedAllergySummary = Array.from(allergyCheckboxes)
        .filter(cb => cb.checked && cb.value !== 'Otros')
        .map(cb => cb.value);
      if (isOthersChecked && customAllergyText) {
        selectedAllergySummary.push(`Otros: ${customAllergyText}`);
      }

      const patientPayload = {
        firstName,
        lastNameP,
        lastNameM,
        name: `${firstName} ${lastNameP} ${lastNameM}`.trim(),
        fullName: `${firstName} ${lastNameP} ${lastNameM}`.trim(),
        birthDate: birthDateVal,
        gender: genderVal,
        phone: phoneVal,
        bloodType: bloodTypeVal,
        curp: curpVal,
        email: emailVal,
        allergies: selectedAllergySummary.join(', ') || 'Sin alergias conocidas',
        password: newPass
      };

      (async () => {
        try {
          if (!window.MedConnectAPI) {
            throw new Error('API no disponible');
          }
          const res = await window.MedConnectAPI.register('patient', patientPayload);
          setButtonLoading(submitBtn, false, 'Completar Registro de Paciente');
          if (!res.ok) {
            showAlert(patientRegisterAlert, 'error', res.data?.message || 'No se pudo registrar al paciente.');
            return;
          }
          const generatedPatientId = res.data?.user?.id || `PAT-${Date.now()}`;
          showAlert(
            patientRegisterAlert,
            'success',
            `✅ ¡Registro completado exitosamente!<br>
             <strong>Paciente:</strong> ${firstName} ${lastNameP} ${lastNameM}<br>
             <strong>Expediente:</strong> <span style="font-family:monospace;">${generatedPatientId}</span>`
          );
          if (patientCredential) patientCredential.value = curpVal || phoneVal || emailVal || firstName;
          setTimeout(() => {
            closePatientModal();
            openLoginModal('patient');
            showAlert(loginModalAlert, 'info', `Expediente ${generatedPatientId} registrado. Ingresa tu contraseña para entrar.`);
          }, 1800);
        } catch (err) {
          setButtonLoading(submitBtn, false, 'Completar Registro de Paciente');
          showAlert(patientRegisterAlert, 'error', 'Error de conexión con el servidor.');
        }
      })();
    });
  }

  // =========================================================
  // 6.5 MODAL 0.5: REGISTRO DE MENOR DE EDAD (VINCULADO A TUTOR)
  // =========================================================
  const registerMinorModal = document.getElementById('registerMinorModal');
  const btnTutorialOpenMinorRegister = document.getElementById('btnTutorialOpenMinorRegister');
  const btnTutorialDemoCode = document.getElementById('btnTutorialDemoCode');
  const closeRegisterMinorModalBtn = document.getElementById('closeRegisterMinorModalBtn');
  const cancelRegisterMinorBtn = document.getElementById('cancelRegisterMinorBtn');
  const registerMinorForm = document.getElementById('registerMinorForm');
  const minorRegisterAlert = document.getElementById('minorRegisterAlert');

  // Elementos de Tutor
  const minorTutorCode = document.getElementById('minorTutorCode');
  const btnVerifyTutorCode = document.getElementById('btnVerifyTutorCode');
  const minorTutorCodeError = document.getElementById('minorTutorCodeError');
  const minorRelationship = document.getElementById('minorRelationship');
  const minorRelationshipError = document.getElementById('minorRelationshipError');
  const tutorLinkedCard = document.getElementById('tutorLinkedCard');
  const tutorCardStatusText = document.getElementById('tutorCardStatusText');
  const tutorLinkedName = document.getElementById('tutorLinkedName');
  const tutorLinkedPhone = document.getElementById('tutorLinkedPhone');
  const tutorLinkedAddress = document.getElementById('tutorLinkedAddress');
  const tutorLinkedClinic = document.getElementById('tutorLinkedClinic');

  // Elementos del Menor
  const minorFirstName = document.getElementById('minorFirstName');
  const minorLastNameP = document.getElementById('minorLastNameP');
  const minorLastNameM = document.getElementById('minorLastNameM');
  const minorBirthDate = document.getElementById('minorBirthDate');
  const minorAgeCalcHelper = document.getElementById('minorAgeCalcHelper');
  const minorGender = document.getElementById('minorGender');
  const minorCurp = document.getElementById('minorCurp');
  const minorBloodType = document.getElementById('minorBloodType');
  const minorHeight = document.getElementById('minorHeight');
  const minorWeight = document.getElementById('minorWeight');

  // Alergias del Menor
  const minorAllergyCheckboxes = document.querySelectorAll('input[name="minorAllergyTag"]');
  const tagMinorNoAllergies = document.getElementById('tagMinorNoAllergies');
  const tagMinorAllergyOthers = document.getElementById('tagMinorAllergyOthers');
  const minorAllergiesText = document.getElementById('minorAllergiesText');
  const minorAllergiesHelper = document.getElementById('minorAllergiesHelper');
  const minorAllergiesError = document.getElementById('minorAllergiesError');

  // Errores del Menor
  const minorFirstNameError = document.getElementById('minorFirstNameError');
  const minorLastNamePError = document.getElementById('minorLastNamePError');
  const minorLastNameMError = document.getElementById('minorLastNameMError');
  const minorBirthDateError = document.getElementById('minorBirthDateError');
  const minorGenderError = document.getElementById('minorGenderError');
  const minorCurpError = document.getElementById('minorCurpError');
  const minorBloodTypeError = document.getElementById('minorBloodTypeError');
  const registerMinorSubmitBtn = document.getElementById('registerMinorSubmitBtn');

  // Base simulada de tutores registrados en la red
  const mockTutorsDatabase = {
    'MC-PAC-2026-8421': {
      name: 'María del Carmen González Rodríguez',
      phone: '55 1234 5678 (Heredado del Tutor)',
      address: 'Col. Del Valle Sur, Benito Juárez, CDMX',
      clinic: 'Clínica N° 9 IMSS (Medicina Familiar)'
    },
    'MC-PAC-2026-1001': {
      name: 'Roberto Carlos Mendoza Silva',
      phone: '55 9876 5432 (Heredado del Tutor)',
      address: 'Col. Roma Norte, Cuauhtémoc, CDMX',
      clinic: 'Centro de Salud T-III Dr. Galindo'
    }
  };

  function verifyTutor(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      showFieldError(minorTutorCode, minorTutorCodeError, 'Ingresa el código de expediente del tutor legal (ej. MC-PAC-2026-8421).');
      return false;
    }

    clearFieldError(minorTutorCode, minorTutorCodeError);

    const tutor = mockTutorsDatabase[cleanCode] || {
      name: 'Titular Adulto Registrado (' + cleanCode + ')',
      phone: '55 ' + Math.floor(10000000 + Math.random() * 90000000) + ' (Heredado del Tutor)',
      address: 'Zona Metropolitana, México',
      clinic: 'Clínica Familiar Asignada'
    };

    if (tutorCardStatusText) tutorCardStatusText.textContent = `Tutor Enlazado y Verificado (${cleanCode})`;
    if (tutorLinkedName) tutorLinkedName.textContent = tutor.name;
    if (tutorLinkedPhone) tutorLinkedPhone.textContent = tutor.phone;
    if (tutorLinkedAddress) tutorLinkedAddress.textContent = tutor.address;
    if (tutorLinkedClinic) tutorLinkedClinic.textContent = tutor.clinic;

    if (tutorLinkedCard) {
      tutorLinkedCard.style.borderColor = 'var(--state-success-border)';
      tutorLinkedCard.style.background = '#F0FDF4';
    }

    return true;
  }

  function updateMinorAllergiesState() {
    const isOthersChecked = tagMinorAllergyOthers ? tagMinorAllergyOthers.checked : false;

    if (minorAllergiesText) {
      if (isOthersChecked) {
        minorAllergiesText.disabled = false;
        minorAllergiesText.placeholder = 'Escribe aquí las alergias pediátricas específicas (ej. Amoxicilina, fresas, polvo...)...';
        if (minorAllergiesHelper) {
          minorAllergiesHelper.textContent = '✏️ Ingresa los detalles de las alergias del menor en este campo.';
        }
        minorAllergiesText.focus();
      } else {
        minorAllergiesText.disabled = true;
        minorAllergiesText.value = '';
        minorAllergiesText.placeholder = 'Selecciona la opción \'Otros\' arriba para ingresar alergias pediátricas específicas aquí...';
        if (minorAllergiesHelper) {
          minorAllergiesHelper.textContent = 'El recuadro de texto se activará automáticamente al seleccionar la opción \'Otros\'.';
        }
      }
    }

    minorAllergyCheckboxes.forEach(cb => {
      if (cb.checked) {
        cb.closest('.allergy-tag-pill')?.classList.add('active');
      } else {
        cb.closest('.allergy-tag-pill')?.classList.remove('active');
      }
    });

    clearFieldError(minorAllergiesText, minorAllergiesError);
  }

  minorAllergyCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox === tagMinorNoAllergies && tagMinorNoAllergies.checked) {
        minorAllergyCheckboxes.forEach(cb => {
          if (cb !== tagMinorNoAllergies) cb.checked = false;
        });
      } else if (checkbox.checked && checkbox !== tagMinorNoAllergies) {
        if (tagMinorNoAllergies) tagMinorNoAllergies.checked = false;
      }
      updateMinorAllergiesState();
    });
  });

  function calculateMinorAge(birthDateString) {
    if (!birthDateString) return null;
    const birthDate = new Date(birthDateString + 'T00:00:00');
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
      years--;
      months = (months + 12) % 12;
    }
    return { years, months, isMinor: years < 18 && years >= 0 };
  }

  if (minorBirthDate) {
    minorBirthDate.addEventListener('change', () => {
      const ageInfo = calculateMinorAge(minorBirthDate.value);
      if (!ageInfo) {
        if (minorAgeCalcHelper) minorAgeCalcHelper.textContent = 'Debe corresponder a un menor de 18 años.';
        return;
      }

      if (!ageInfo.isMinor) {
        showFieldError(minorBirthDate, minorBirthDateError, `La fecha ingresada indica ${ageInfo.years} años. Para mayores de 18 años, regístrate como Paciente Adulto Titular.`);
        if (minorAgeCalcHelper) minorAgeCalcHelper.textContent = `⚠️ Mayor de edad (${ageInfo.years} años).`;
      } else {
        clearFieldError(minorBirthDate, minorBirthDateError);
        if (minorAgeCalcHelper) {
          minorAgeCalcHelper.innerHTML = `🟢 <strong>Edad calculada:</strong> ${ageInfo.years} año(s) y ${ageInfo.months} mes(es) • Expediente Pediátrico.`;
        }
      }
    });
  }

  const openMinorModal = (prefillCode = 'MC-PAC-2026-8421') => {
    closeAffiliationChooser();
    if (registerMinorModal) {
      registerMinorModal.classList.remove('hidden');
      if (minorTutorCode) {
        minorTutorCode.value = prefillCode;
        verifyTutor(prefillCode);
      }
      if (minorFirstName) minorFirstName.focus();
    }
  };

  const closeMinorModal = () => {
    if (registerMinorModal) {
      registerMinorModal.classList.add('hidden');
      registerMinorForm?.reset();
      minorAllergyCheckboxes.forEach(cb => {
        cb.checked = false;
        cb.closest('.allergy-tag-pill')?.classList.remove('active');
      });
      if (minorAllergiesText) {
        minorAllergiesText.disabled = true;
        minorAllergiesText.value = '';
      }
      if (minorAgeCalcHelper) {
        minorAgeCalcHelper.textContent = 'Debe corresponder a un menor de 18 años.';
      }
      minorRegisterAlert?.classList.add('hidden');
      clearMinorErrors();
    }
  };

  function clearMinorErrors() {
    clearFieldError(minorTutorCode, minorTutorCodeError);
    clearFieldError(minorRelationship, minorRelationshipError);
    clearFieldError(minorFirstName, minorFirstNameError);
    clearFieldError(minorLastNameP, minorLastNamePError);
    clearFieldError(minorLastNameM, minorLastNameMError);
    clearFieldError(minorBirthDate, minorBirthDateError);
    clearFieldError(minorGender, minorGenderError);
    clearFieldError(minorCurp, minorCurpError);
    clearFieldError(minorBloodType, minorBloodTypeError);
    clearFieldError(minorAllergiesText, minorAllergiesError);
  }

  if (chooseMinorRegisterBtn) chooseMinorRegisterBtn.addEventListener('click', () => openMinorModal('MC-PAC-2026-8421'));
  if (btnTutorialOpenMinorRegister) btnTutorialOpenMinorRegister.addEventListener('click', () => openMinorModal('MC-PAC-2026-8421'));
  if (btnTutorialDemoCode) btnTutorialDemoCode.addEventListener('click', () => openMinorModal('MC-PAC-2026-8421'));
  if (closeRegisterMinorModalBtn) closeRegisterMinorModalBtn.addEventListener('click', closeMinorModal);
  if (cancelRegisterMinorBtn) cancelRegisterMinorBtn.addEventListener('click', closeMinorModal);

  if (btnVerifyTutorCode) {
    btnVerifyTutorCode.addEventListener('click', () => {
      verifyTutor(minorTutorCode?.value);
    });
  }

  // Validación y Envío del Formulario de Registro de Menor de Edad
  if (registerMinorForm) {
    registerMinorForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearMinorErrors();
      let hasError = false;

      // 1. Código de Tutor
      const tutorCodeVal = minorTutorCode ? minorTutorCode.value.trim().toUpperCase() : '';
      if (!tutorCodeVal) {
        showFieldError(minorTutorCode, minorTutorCodeError, 'El código de expediente del tutor es obligatorio.');
        hasError = true;
      } else {
        verifyTutor(tutorCodeVal);
      }

      // 2. Parentesco
      const relVal = minorRelationship ? minorRelationship.value : '';
      if (!relVal) {
        showFieldError(minorRelationship, minorRelationshipError, 'Selecciona el parentesco con el menor.');
        hasError = true;
      }

      // 3. Nombre(s)
      const firstName = minorFirstName ? minorFirstName.value.trim() : '';
      if (!firstName) {
        showFieldError(minorFirstName, minorFirstNameError, 'El nombre del menor es obligatorio.');
        hasError = true;
      }

      // 4. Apellidos
      const lastNameP = minorLastNameP ? minorLastNameP.value.trim() : '';
      if (!lastNameP) {
        showFieldError(minorLastNameP, minorLastNamePError, 'El apellido paterno es obligatorio.');
        hasError = true;
      }

      const lastNameM = minorLastNameM ? minorLastNameM.value.trim() : '';
      if (!lastNameM) {
        showFieldError(minorLastNameM, minorLastNameMError, 'El apellido materno es obligatorio.');
        hasError = true;
      }

      // 5. Fecha de Nacimiento (menor de 18 años)
      const birthDateVal = minorBirthDate ? minorBirthDate.value : '';
      if (!birthDateVal) {
        showFieldError(minorBirthDate, minorBirthDateError, 'La fecha de nacimiento del menor es obligatoria.');
        hasError = true;
      } else {
        const ageInfo = calculateMinorAge(birthDateVal);
        if (ageInfo && !ageInfo.isMinor) {
          showFieldError(minorBirthDate, minorBirthDateError, `Debe corresponder a un menor de 18 años (actualmente: ${ageInfo.years} años).`);
          hasError = true;
        }
      }

      // 6. Género
      const genderVal = minorGender ? minorGender.value : '';
      if (!genderVal) {
        showFieldError(minorGender, minorGenderError, 'Selecciona el género del menor.');
        hasError = true;
      }

      // 7. Tipo de Sangre
      const bloodTypeVal = minorBloodType ? minorBloodType.value : '';
      if (!bloodTypeVal) {
        showFieldError(minorBloodType, minorBloodTypeError, 'Selecciona el tipo de sangre pediátrico.');
        hasError = true;
      }

      // 8. CURP (Opcional)
      const curpVal = minorCurp ? minorCurp.value.trim() : '';
      if (curpVal && curpVal.length !== 18) {
        showFieldError(minorCurp, minorCurpError, `La CURP ingresada debe tener 18 caracteres (actualmente: ${curpVal.length}).`);
        hasError = true;
      }

      // 9. Alergias
      const anyTagChecked = Array.from(minorAllergyCheckboxes).some(cb => cb.checked);
      const isOthersChecked = tagMinorAllergyOthers && tagMinorAllergyOthers.checked;
      const customAllergyText = minorAllergiesText ? minorAllergiesText.value.trim() : '';

      if (!anyTagChecked) {
        showFieldError(minorAllergiesText, minorAllergiesError, 'Debes seleccionar las alergias del menor o marcar "Sin Alergias Conocidas".');
        hasError = true;
      } else if (isOthersChecked && !customAllergyText) {
        showFieldError(minorAllergiesText, minorAllergiesError, 'Has marcado "Otros". Por favor detalla las alergias pediátricas en el recuadro.');
        hasError = true;
      }

      if (hasError) {
        showAlert(minorRegisterAlert, 'error', 'Por favor, revisa y completa los campos obligatorios del registro pediátrico.');
        return;
      }

      setButtonLoading(registerMinorSubmitBtn, true, 'Vinculando expediente pediátrico...');

      const generatedPedId = `MC-PED-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const selectedAllergySummary = Array.from(minorAllergyCheckboxes)
        .filter(cb => cb.checked && cb.value !== 'Otros')
        .map(cb => cb.value);
      if (isOthersChecked && customAllergyText) {
        selectedAllergySummary.push(`Otros: ${customAllergyText}`);
      }

      const tutorName = tutorLinkedName ? tutorLinkedName.textContent : 'Tutor Registrado';
      const tutorPhone = tutorLinkedPhone ? tutorLinkedPhone.textContent : 'Teléfono del Tutor';
      const tutorClinic = tutorLinkedClinic ? tutorLinkedClinic.textContent : 'Clínica Familiar';

      setTimeout(() => {
        setButtonLoading(registerMinorSubmitBtn, false, 'Vincular y Registrar Menor de Edad');
        showAlert(
          minorRegisterAlert,
          'success',
          `✅ ¡Menor de edad registrado y vinculado exitosamente!<br>
           <strong>Paciente Pediátrico:</strong> ${firstName} ${lastNameP} ${lastNameM} (${genderVal})<br>
           <strong>Fecha Nacimiento:</strong> ${birthDateVal} | <strong>Tipo de Sangre:</strong> <span style="font-weight:700; color:var(--primary);">${bloodTypeVal}</span><br>
           <strong>Tutor Responsable:</strong> ${tutorName} (Parentesco: <em>${relVal}</em>, Código: ${tutorCodeVal})<br>
           <strong>Contacto de Emergencias Heredado:</strong> ${tutorPhone}<br>
           <strong>Clínica Familiar:</strong> ${tutorClinic}<br>
           <strong>Alergias Pediátricas:</strong> ${selectedAllergySummary.join(', ') || 'Sin alergias conocidas'}<br>
           <strong>Expediente Pediátrico Asignado:</strong> <span style="font-family:monospace; background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-weight:700;">${generatedPedId}</span><br>
           El menor ahora aparece administrable desde el portal del tutor registrado.`
        );

        if (minorLoginCode) minorLoginCode.value = tutorCodeVal;

        setTimeout(() => {
          closeMinorModal();
          openLoginModal('minor');
          showAlert(loginModalAlert, 'info', `Expediente pediátrico ${generatedPedId} (${firstName}) vinculado al tutor ${tutorCodeVal}.`);
        }, 2500);
      }, 1400);
    });
  }

  // =========================================================
  // 7. MODAL 2: REGISTRO DE MÉDICO / ESPECIALISTA (USO 2)
  // =========================================================
  const landingSelectClosers = [];
  let landingSelectDismissBound = false;

  function bindLandingSelect(rootId, menuId, placeholder) {
    const root = document.getElementById(rootId);
    const menu = document.getElementById(menuId);
    const trigger = root?.querySelector('.page-select-trigger');
    const label = root?.querySelector('.page-select-label');
    if (!root || !menu || !trigger || !label) return { close() {}, reset() {} };
    const slot = { parent: menu.parentElement, next: menu.nextSibling };

    const close = () => {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      menu.style.position = '';
      menu.style.left = '';
      menu.style.top = '';
      menu.style.width = '';
      menu.style.zIndex = '';
      if (menu.parentElement !== slot.parent) slot.parent.insertBefore(menu, slot.next);
    };
    landingSelectClosers.push(close);

    const place = () => {
      const rect = trigger.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.zIndex = '10050';
      menu.style.left = `${Math.round(rect.left)}px`;
      menu.style.width = `${Math.round(rect.width)}px`;
      const height = menu.offsetHeight;
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
      menu.style.top = `${Math.round(top)}px`;
    };

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      landingSelectClosers.forEach((fn) => fn());
      if (!willOpen) return;
      menu.hidden = false;
      document.body.appendChild(menu);
      place();
      trigger.setAttribute('aria-expanded', 'true');
    });

    menu.querySelectorAll('[role="option"]').forEach((option) => {
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        root.dataset.value = option.dataset.value || '';
        label.textContent = (option.childNodes[0]?.textContent || '').trim();
        trigger.classList.remove('is-empty');
        menu.querySelectorAll('[role="option"]').forEach((item) => {
          item.setAttribute('aria-selected', item === option ? 'true' : 'false');
        });
        close();
      });
    });

    if (!landingSelectDismissBound) {
      landingSelectDismissBound = true;
      document.addEventListener('click', (event) => {
        if (event.target.closest('.landing-select, .landing-select-menu')) return;
        landingSelectClosers.forEach((fn) => fn());
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') landingSelectClosers.forEach((fn) => fn());
      });
      window.addEventListener('resize', () => landingSelectClosers.forEach((fn) => fn()));
    }

    return {
      close,
      reset() {
        close();
        root.dataset.value = '';
        label.textContent = placeholder;
        trigger.classList.add('is-empty');
        menu.querySelectorAll('[role="option"]').forEach((item) => item.setAttribute('aria-selected', 'false'));
      }
    };
  }

  const specialtySelect = bindLandingSelect('docSpecialty', 'docSpecialtyMenu', 'Selecciona especialidad...');
  const registerDoctorModal = document.getElementById('registerDoctorModal');
  const openRegisterDoctorModalBtn = document.getElementById('openRegisterDoctorModalBtn');
  const btnUseDoctorCta = document.getElementById('btnUseDoctorCta');
  const closeRegisterDoctorModalBtn = document.getElementById('closeRegisterDoctorModalBtn');
  const cancelRegisterDoctorBtn = document.getElementById('cancelRegisterDoctorBtn');
  const registerDoctorForm = document.getElementById('registerDoctorForm');
  const doctorRegisterAlert = document.getElementById('doctorRegisterAlert');

  const openDoctorModal = () => {
    closeAffiliationChooser();
    registerDoctorModal.classList.remove('hidden');
    document.getElementById('docFirstName').focus();
  };

  const closeDoctorModal = () => {
    registerDoctorModal.classList.add('hidden');
    registerDoctorForm.reset();
    specialtySelect.reset();
    doctorRegisterAlert.classList.add('hidden');
  };

  if (openRegisterDoctorModalBtn) openRegisterDoctorModalBtn.addEventListener('click', openDoctorModal);
  if (btnUseDoctorCta) btnUseDoctorCta.addEventListener('click', openDoctorModal);
  if (chooseDoctorRegisterBtn) chooseDoctorRegisterBtn.addEventListener('click', openDoctorModal);
  if (closeRegisterDoctorModalBtn) closeRegisterDoctorModalBtn.addEventListener('click', closeDoctorModal);
  if (cancelRegisterDoctorBtn) cancelRegisterDoctorBtn.addEventListener('click', closeDoctorModal);

  if (registerDoctorForm) {
    registerDoctorForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const docName = document.getElementById('docFirstName').value.trim();
      const docLast = document.getElementById('docLastNameP').value.trim();
      const docLicense = document.getElementById('docLicense').value.trim();
      const docSpecialty = document.getElementById('docSpecialty')?.dataset.value || '';
      const docEmail = document.getElementById('docEmail').value.trim();
      const docPass = document.getElementById('docPassword').value;
      const docConfirm = document.getElementById('docConfirmPassword').value;

      if (!docName || !docLast || !docLicense || !docSpecialty || !docEmail || !docPass) {
        showAlert(doctorRegisterAlert, 'error', 'Por favor completa todos los campos obligatorios del registro médico.');
        return;
      }

      if (docPass !== docConfirm) {
        showAlert(doctorRegisterAlert, 'error', 'Las contraseñas profesionales no coinciden.');
        return;
      }

      const submitBtn = document.getElementById('registerDoctorSubmitBtn');
      setButtonLoading(submitBtn, true, 'Guardando en base de datos...');

      const doctorPayload = {
        name: `Dr(a). ${docName} ${docLast} ${document.getElementById('docLastNameM')?.value.trim() || ''}`.trim(),
        firstName: docName,
        lastNameP: docLast,
        lastNameM: document.getElementById('docLastNameM')?.value.trim() || '',
        curp: document.getElementById('docCurp')?.value.trim() || '',
        professionalId: docLicense,
        specialty: docSpecialty,
        clinicName: document.getElementById('docHospital')?.value.trim() || 'Consultorio Médico Particular',
        phone: document.getElementById('docPhone')?.value.trim() || '',
        email: docEmail,
        password: docPass
      };

      (async () => {
        try {
          if (window.MedConnectAPI) {
            const res = await window.MedConnectAPI.register('doctor', doctorPayload);
            setButtonLoading(submitBtn, false, 'Registrar Perfil Médico');

            if (res.ok) {
              showAlert(
                doctorRegisterAlert,
                'success',
                `✅ Perfil médico registrado exitosamente en la base de datos.<br>
                 <strong>Médico:</strong> Dr(a). ${docName} ${docLast}<br>
                 <strong>Cédula:</strong> ${docLicense} (${docSpecialty})`
              );

              if (doctorCredential) doctorCredential.value = docLicense;

              setTimeout(() => {
                closeDoctorModal();
                openLoginModal('doctor');
                showAlert(loginModalAlert, 'info', `Cédula ${docLicense} lista para autenticación médica.`);
              }, 1800);
            } else {
              showAlert(doctorRegisterAlert, 'error', res.data?.message || 'Error al registrar el perfil médico.');
            }
          }
        } catch (err) {
          setButtonLoading(submitBtn, false, 'Registrar Perfil Médico');
          showAlert(doctorRegisterAlert, 'error', 'Error de conexión con el servidor.');
        }
      })();
    });
  }

  // =========================================================
  // 8. MODAL 3: REGISTRO DE CLÍNICA / CONSULTORIO (USO 3)
  // =========================================================
  const registerClinicModal = document.getElementById('registerClinicModal');
  const openRegisterClinicModalBtn = document.getElementById('openRegisterClinicModalBtn');
  const btnUseClinicCta = document.getElementById('btnUseClinicCta');
  const closeRegisterClinicModalBtn = document.getElementById('closeRegisterClinicModalBtn');
  const cancelRegisterClinicBtn = document.getElementById('cancelRegisterClinicBtn');
  const registerClinicForm = document.getElementById('registerClinicForm');
  const clinicRegisterAlert = document.getElementById('clinicRegisterAlert');

  const clinicSelect = bindLandingSelect('clinicType', 'clinicTypeMenu', 'Selecciona categoría...');

  const openClinicModal = () => {
    closeAffiliationChooser();
    registerClinicModal.classList.remove('hidden');
    document.getElementById('clinicName').focus();
  };

  const closeClinicModal = () => {
    registerClinicModal.classList.add('hidden');
    registerClinicForm.reset();
    clinicSelect.reset();
    clinicRegisterAlert.classList.add('hidden');
  };

  if (openRegisterClinicModalBtn) openRegisterClinicModalBtn.addEventListener('click', openClinicModal);
  if (btnUseClinicCta) btnUseClinicCta.addEventListener('click', openClinicModal);
  if (chooseClinicRegisterBtn) chooseClinicRegisterBtn.addEventListener('click', openClinicModal);
  if (closeRegisterClinicModalBtn) closeRegisterClinicModalBtn.addEventListener('click', closeClinicModal);
  if (cancelRegisterClinicBtn) cancelRegisterClinicBtn.addEventListener('click', closeClinicModal);

  if (registerClinicForm) {
    registerClinicForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const clinicName = document.getElementById('clinicName').value.trim();
      const clinicType = document.getElementById('clinicType')?.dataset.value || '';
      const director = document.getElementById('contactDirector').value.trim();
      const directorLicense = document.getElementById('directorLicense').value.trim();
      const officialEmail = document.getElementById('officialEmail').value.trim();
      const branches = document.getElementById('clinicBranchesCount').value;

      if (!clinicName || !clinicType || !director || !directorLicense || !officialEmail) {
        showAlert(clinicRegisterAlert, 'error', 'Por favor llena todos los datos requeridos para la afiliación de la sede.');
        return;
      }

      const submitBtn = document.getElementById('registerClinicSubmitBtn');
      setButtonLoading(submitBtn, true, 'Registrando nodo institucional...');

      const generatedNodeId = `MC-CLI-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      setTimeout(() => {
        setButtonLoading(submitBtn, false, 'Enviar Solicitud de Afiliación');
        showAlert(
          clinicRegisterAlert,
          'success',
          `✅ Solicitud de afiliación registrada con éxito.<br>
           <strong>Establecimiento:</strong> ${clinicName} (${branches} sedes)<br>
           <strong>Responsable Sanitario:</strong> ${director} (Cédula: ${directorLicense})<br>
           <strong>ID de Nodo Asignado:</strong> ${generatedNodeId}<br>
           Se ha enviado el enlace de confirmación técnica a: ${officialEmail}`
        );

        if (clinicCredential) clinicCredential.value = generatedNodeId;

        setTimeout(() => {
          closeClinicModal();
          openLoginModal('clinic');
          showAlert(loginModalAlert, 'info', `Sede ${clinicName} registrada con ID: ${generatedNodeId}.`);
        }, 2400);
      }, 1400);
    });
  }

  // =========================================================
  // 9. MODAL 4: RECUPERACIÓN DE CONTRASEÑA
  // =========================================================
  const forgotModal = document.getElementById('forgotModal');
  const forgotTriggerBtns = document.querySelectorAll('.forgot-trigger-btn');
  const closeForgotModalBtn = document.getElementById('closeForgotModalBtn');
  const cancelForgotModalBtn = document.getElementById('cancelForgotModalBtn');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const recoveryEmail = document.getElementById('recoveryEmail');
  const recoveryError = document.getElementById('recoveryError');
  const recoveryAlert = document.getElementById('recoveryAlert');

  const openForgotModal = (roleHint) => {
    forgotModal.classList.remove('hidden');
    recoveryEmail.focus();
    if (roleHint === 'patient') {
      recoveryEmail.setAttribute('placeholder', 'CURP o correo de paciente registrado');
    } else if (roleHint === 'doctor') {
      recoveryEmail.setAttribute('placeholder', 'Cédula profesional o correo médico');
    } else {
      recoveryEmail.setAttribute('placeholder', 'ID de clínica o correo institucional');
    }
  };

  const closeForgotModal = () => {
    forgotModal.classList.add('hidden');
    forgotPasswordForm.reset();
    clearFieldError(recoveryEmail, recoveryError);
    recoveryAlert.classList.add('hidden');
  };

  forgotTriggerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const hint = btn.getAttribute('data-role-hint') || currentLoginRole;
      openForgotModal(hint);
    });
  });

  if (closeForgotModalBtn) closeForgotModalBtn.addEventListener('click', closeForgotModal);
  if (cancelForgotModalBtn) cancelForgotModalBtn.addEventListener('click', closeForgotModal);

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = recoveryEmail.value.trim();

      if (!val) {
        showFieldError(recoveryEmail, recoveryError, 'Por favor ingresa tu correo, CURP o identificador.');
        return;
      }

      const submitBtn = document.getElementById('recoverySubmitBtn');
      setButtonLoading(submitBtn, true, 'Verificando registro...');

      setTimeout(() => {
        setButtonLoading(submitBtn, false, 'Enviar Instrucciones');
        showAlert(recoveryAlert, 'success', `Se ha generado un token de recuperación para: <strong>${val}</strong>.`);
        setTimeout(() => closeForgotModal(), 2800);
      }, 1000);
    });

    recoveryEmail.addEventListener('input', () => clearFieldError(recoveryEmail, recoveryError));
  }

  // =========================================================
  // 10. CIERRE GLOBAL DE MODALES (TECLA ESC Y CLIC EN BACKDROP)
  // =========================================================
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLoginModal();
      closeAffiliationChooser();
      closeMinorGuide();
      closePatientModal();
      closeMinorModal();
      closeDoctorModal();
      closeClinicModal();
      closeForgotModal();
    }
  });

  [loginModal, modalAffiliationChooser, minorGuideModal, registerPatientModal, registerMinorModal, registerDoctorModal, registerClinicModal, forgotModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    }
  });

  // =========================================================
  // 9. FUNCIONES AUXILIARES DE UI Y VALIDACIÓN
  // =========================================================
  function showFieldError(inputElem, errorElem, message) {
    if (inputElem) inputElem.classList.add('input-error');
    if (errorElem) errorElem.textContent = message;
  }

  function clearFieldError(inputElem, errorElem) {
    if (inputElem) inputElem.classList.remove('input-error');
    if (errorElem) errorElem.textContent = '';
  }

  function setButtonLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    const textSpan = btn.querySelector('.btn-text') || btn.querySelector('span');
    if (textSpan) textSpan.textContent = text;
    btn.style.opacity = isLoading ? '0.75' : '1';
    btn.style.cursor = isLoading ? 'wait' : 'pointer';
  }

  function showAlert(alertElem, type, htmlMessage) {
    if (!alertElem) return;
    alertElem.className = `auth-alert ${type}`;
    alertElem.innerHTML = htmlMessage;
    alertElem.classList.remove('hidden');
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
});

// =========================================================
// ================= 10. DEDICADO: DASHBOARD PACIENTE =================
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  const dashboardContainer = document.getElementById('patientDashboardApp');
  if (!dashboardContainer) return;

  const api = window.MedConnectAPI;
  if (!api || !api.isAuthenticated()) {
    window.location.replace('index.html');
    return;
  }
  if (!api.requireAuth('patient')) {
    window.location.replace(api.getAuthenticatedHomeUrl());
    return;
  }
  if (typeof api.applyAuthenticatedNavigation === 'function') {
    api.applyAuthenticatedNavigation();
  }

  // ---------------------------------------------------------
  // A. ESTADO DE CITAS Y CALENDARIO (SINCRONIZADO CON API)
  // ---------------------------------------------------------
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Fecha base inicial del calendario (Mes y año actual)
  let currentCalDate = new Date();

  // Registro de citas (Sincronizado con MedConnectApi)
  let appointmentsData = [];

  // Cargar Perfil de Paciente desde MedConnectApi
  async function loadPatientProfile() {
    if (!window.MedConnectAPI) return;
    const res = await window.MedConnectAPI.getPatientProfile();
    const patient = res.ok && res.data?.patient ? res.data.patient : window.MedConnectAPI.getActiveUser();
    
    const nameElem = document.getElementById('patientHeaderName');
    const idElem = document.getElementById('patientHeaderId');
    const avatarElem = document.getElementById('patientAvatarBadge');
    const clinicElem = document.getElementById('welcomeClinicVal');

    if (patient) {
      if (nameElem) nameElem.textContent = patient.fullName || '--';
      if (idElem) idElem.textContent = `ID: ${patient.id || '--'} • CURP: ${patient.curp || '--'}`;
      if (clinicElem) clinicElem.textContent = patient.assignedClinic || 'Sede Central';
      if (avatarElem && patient.fullName) {
        const parts = patient.fullName.trim().split(' ');
        const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
        avatarElem.textContent = initials.toUpperCase();
      }
    } else {
      if (nameElem) nameElem.textContent = 'Sin Sesión Activa';
      if (idElem) idElem.textContent = 'Inicia sesión o regístrate en el portal';
      if (avatarElem) avatarElem.textContent = '--';
      if (clinicElem) clinicElem.textContent = '--';
    }
  }

  // Cargar Citas desde MedConnectApi
  async function loadAppointmentsFromApi() {
    if (!window.MedConnectAPI) return;
    try {
      const res = await window.MedConnectAPI.getAppointments();
      if (res.ok && Array.isArray(res.data?.appointments)) {
        appointmentsData = res.data.appointments;
        if (appointmentsData.length > 0) {
          currentCalDate = new Date(appointmentsData[0].year, appointmentsData[0].month, 1);
        }
        renderCalendar();
        renderFeaturedAppointmentCard();
      }
    } catch (e) {
      console.warn('Error cargando citas de API:', e);
    }
  }

  loadPatientProfile();
  loadAppointmentsFromApi();

  // Elementos del DOM del Calendario
  const calMonthTitle = document.getElementById('calendarMonthTitle');
  const calDaysGrid = document.getElementById('calendarDaysGrid');
  const calPrevBtn = document.getElementById('calPrevBtn');
  const calNextBtn = document.getElementById('calNextBtn');
  const calTodayBtn = document.getElementById('calTodayBtn');
  const calSelectionNotice = document.getElementById('calendarSelectionNotice');
  const calNoticeText = document.getElementById('calendarNoticeText');

  // Elementos de la Tarjeta de Próxima Cita
  const featuredApptCard = document.getElementById('featuredApptCard');

  // Modales del Dashboard
  const modalSchedule = document.getElementById('modalScheduleAppt');
  const modalReschedule = document.getElementById('modalRescheduleAppt');
  const modalCancelConfirm = document.getElementById('modalCancelAppt');

  // Botones de Apertura de Agendamiento
  const btnHeaderSchedule = document.getElementById('btnHeaderSchedule');
  const btnScheduleNewFromBanner = document.getElementById('btnScheduleNewFromBanner');

  // ---------------------------------------------------------
  // B. RENDERIZADO DEL CALENDARIO MENSUAL
  // ---------------------------------------------------------
  function renderCalendar() {
    if (!calMonthTitle || !calDaysGrid) return;

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    // Actualizar encabezado del mes
    calMonthTitle.textContent = `${monthNames[month]} ${year}`;

    // Limpiar grid previo
    calDaysGrid.innerHTML = '';

    // Primer día del mes (0: Domingo, 1: Lunes... adaptamos a Lunes como 1er día)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Ajuste para que la semana empiece en Lunes (0: Lun, 1: Mar, ..., 6: Dom)
    const startOffset = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;

    // Cantidad de días en el mes actual
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Cantidad de días en el mes anterior
    const prevMonthDays = new Date(year, month, 0).getDate();

    const today = new Date();
    const isCurrentActualMonth = (today.getFullYear() === year && today.getMonth() === month);

    // 1. Celdas del mes anterior para completar la primera semana
    for (let i = startOffset; i > 0; i--) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell other-month';
      cell.textContent = prevMonthDays - i + 1;
      calDaysGrid.appendChild(cell);
    }

    // 2. Celdas del mes en curso
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell';
      cell.textContent = day;

      const isTodayCell = isCurrentActualMonth && (today.getDate() === day);
      if (isTodayCell) {
        cell.classList.add('is-today');
      }

      // Comprobar si hay cita programada para este día
      const appt = appointmentsData.find(a => a.year === year && a.month === month && a.day === day);
      if (appt) {
        cell.classList.add('has-appointment');
        cell.title = `Cita con ${appt.doctor} (${appt.time})`;
      }

      // Evento de selección de día en el calendario
      cell.addEventListener('click', () => {
        document.querySelectorAll('.calendar-day-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');

        if (appt) {
          showToast(`Cita el ${day} de ${monthNames[month]}: ${appt.doctor} (${appt.time})`, 'info');
          if (calSelectionNotice && calNoticeText) {
            calNoticeText.innerHTML = `<strong>${day} de ${monthNames[month]}:</strong> ${appt.doctor} — ${appt.specialty} (${appt.time})`;
            calSelectionNotice.classList.remove('hidden');
          }
        } else {
          if (calSelectionNotice && calNoticeText) {
            calNoticeText.innerHTML = `<strong>${day} de ${monthNames[month]}:</strong> No hay citas programadas para este día.`;
            calSelectionNotice.classList.remove('hidden');
          }
        }
      });

      calDaysGrid.appendChild(cell);
    }

    // 3. Celdas del siguiente mes para completar las 35 o 42 celdas de cuadrícula
    const totalRendered = startOffset + daysInMonth;
    const remainingCells = (totalRendered <= 35) ? (35 - totalRendered) : (42 - totalRendered);

    for (let j = 1; j <= remainingCells; j++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell other-month';
      cell.textContent = j;
      calDaysGrid.appendChild(cell);
    }
  }

  // Controles de cambio de mes
  if (calPrevBtn) {
    calPrevBtn.addEventListener('click', () => {
      currentCalDate.setMonth(currentCalDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (calNextBtn) {
    calNextBtn.addEventListener('click', () => {
      currentCalDate.setMonth(currentCalDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (calTodayBtn) {
    calTodayBtn.addEventListener('click', () => {
      currentCalDate = new Date();
      renderCalendar();
    });
  }

  // Inicializar renderizado del calendario
  renderCalendar();

  // Función para actualizar la tarjeta de próxima cita
  function renderFeaturedAppointmentCard() {
    if (!featuredApptCard) return;

    if (appointmentsData.length === 0) {
      featuredApptCard.className = 'featured-appointment-card empty-appt-state';
      featuredApptCard.innerHTML = `
        <div class="empty-state-content">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <h3 class="empty-state-title" id="featuredApptTitle">Sin Citas Próximas</h3>
          <p class="empty-state-text">No tienes consultas médicas agendadas en este momento.</p>
          <button type="button" class="btn-primary btn-empty-schedule" id="btnEmptyScheduleAppt">
            + Agendar Cita
          </button>
        </div>
      `;
      document.getElementById('btnEmptyScheduleAppt')?.addEventListener('click', () => {
        openModal(modalSchedule);
      });
      return;
    }

    const appt = appointmentsData[0];
    featuredApptCard.className = 'featured-appointment-card';
    featuredApptCard.innerHTML = `
      <div class="featured-appt-header">
        <span class="featured-pill-status">
          <span class="status-indicator"></span>
          Próxima Cita Médica
        </span>
        <span class="featured-appt-countdown">${appt.day} de ${monthNames[appt.month]}</span>
      </div>

      <div class="featured-appt-body">
        <div class="appt-doctor-row">
          <div class="doctor-avatar-circle" aria-hidden="true">🩺</div>
          <div class="doctor-info-text">
            <h3 id="featuredDoctorName">${appt.doctor}</h3>
            <p id="featuredDoctorSpec">${appt.specialty}</p>
          </div>
        </div>

        <div class="appt-details-grid">
          <div class="appt-detail-item">
            <span class="appt-detail-label">Fecha y Horario</span>
            <span class="appt-detail-value" id="featuredApptDateTime">
              ${appt.day} de ${monthNames[appt.month]}, ${appt.year} • ${appt.time}
            </span>
          </div>
          <div class="appt-detail-item">
            <span class="appt-detail-label">Ubicación / Modalidad</span>
            <span class="appt-detail-value" id="featuredApptLocation">
              ${appt.location}
            </span>
          </div>
        </div>
      </div>

      <div class="featured-appt-actions">
        <button type="button" class="btn-action-reschedule" id="btnRescheduleAppt">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span>Reprogramar Cita</span>
        </button>
        <button type="button" class="btn-action-cancel" id="btnCancelAppt">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <span>Cancelar</span>
        </button>
      </div>
    `;

    document.getElementById('btnRescheduleAppt')?.addEventListener('click', () => {
      openModal(modalReschedule);
    });

    document.getElementById('btnCancelAppt')?.addEventListener('click', () => {
      openModal(modalCancelConfirm);
    });
  }

  // ---------------------------------------------------------
  // C. MODALES DE CITAS (AGENDAR, REPROGRAMAR, CANCELAR)
  // ---------------------------------------------------------
  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
  }

  // Configurar botones de cierre de modales específicos
  document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) closeModal(modal);
    });
  });

  // Modal Agendar Nueva Cita
  if (btnHeaderSchedule) {
    btnHeaderSchedule.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(modalSchedule);
    });
  }

  if (btnScheduleNewFromBanner) {
    btnScheduleNewFromBanner.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(modalSchedule);
    });
  }

  document.getElementById('btnEmptyScheduleAppt')?.addEventListener('click', () => {
    openModal(modalSchedule);
  });

  const formScheduleAppt = document.getElementById('formScheduleAppt');
  if (formScheduleAppt) {
    formScheduleAppt.addEventListener('submit', async (e) => {
      e.preventDefault();
      const clinic = document.getElementById('schedClinic')?.value;
      const spec = document.getElementById('schedSpecialty')?.value;
      const dateVal = document.getElementById('schedDate')?.value;
      const timeVal = document.getElementById('schedTime')?.value;

      if (!clinic || !spec || !dateVal || !timeVal) {
        showToast('Por favor completa los campos requeridos (Sede, Especialidad, Fecha y Horario).', 'error');
        return;
      }

      const parsedDate = new Date(dateVal + 'T00:00:00');
      const newAppt = {
        id: `APPT-${Date.now()}`,
        year: parsedDate.getFullYear(),
        month: parsedDate.getMonth(),
        day: parsedDate.getDate(),
        time: timeVal,
        doctor: 'Especialista por Asignar',
        specialty: spec,
        location: clinic,
        type: 'Presencial',
        status: 'Confirmada'
      };

      if (window.MedConnectAPI) {
        try {
          await window.MedConnectAPI.createAppointment({
            clinic,
            specialty: spec,
            date: dateVal,
            time: timeVal
          });
        } catch (err) {
          console.warn('API Offline, guardando en memoria local:', err);
        }
      }

      appointmentsData.unshift(newAppt);
      currentCalDate = new Date(newAppt.year, newAppt.month, 1);
      renderCalendar();
      renderFeaturedAppointmentCard();
      closeModal(modalSchedule);
      showToast(`¡Cita agendada con éxito para el ${newAppt.day} de ${monthNames[newAppt.month]} en ${clinic}!`, 'success');
      formScheduleAppt.reset();
    });
  }

  // Modal Reprogramar Cita
  const formRescheduleAppt = document.getElementById('formRescheduleAppt');
  if (formRescheduleAppt) {
    formRescheduleAppt.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newDateVal = document.getElementById('reschedDate')?.value;
      const newTimeVal = document.getElementById('reschedTime')?.value;

      if (!newDateVal || !newTimeVal) {
        showToast('Por favor selecciona la nueva fecha y horario.', 'error');
        return;
      }

      const parsed = new Date(newDateVal + 'T00:00:00');
      if (appointmentsData.length > 0) {
        const apptId = appointmentsData[0].id;
        appointmentsData[0].year = parsed.getFullYear();
        appointmentsData[0].month = parsed.getMonth();
        appointmentsData[0].day = parsed.getDate();
        appointmentsData[0].time = newTimeVal;

        if (window.MedConnectAPI) {
          try {
            await window.MedConnectAPI.rescheduleAppointment(apptId, newDateVal, newTimeVal);
          } catch (err) {}
        }
      }

      renderCalendar();
      renderFeaturedAppointmentCard();
      closeModal(modalReschedule);
      showToast(`Cita reprogramada para el ${parsed.getDate()} de ${monthNames[parsed.getMonth()]} (${newTimeVal}).`, 'success');
    });
  }

  // Modal Cancelar Cita
  const btnConfirmCancelAction = document.getElementById('btnConfirmCancelAction');
  if (btnConfirmCancelAction) {
    btnConfirmCancelAction.addEventListener('click', async () => {
      if (appointmentsData.length > 0) {
        const apptId = appointmentsData[0].id;
        appointmentsData.shift();

        if (window.MedConnectAPI) {
          try {
            await window.MedConnectAPI.cancelAppointment(apptId);
          } catch (err) {}
        }
      }
      renderCalendar();
      renderFeaturedAppointmentCard();
      closeModal(modalCancelConfirm);
      showToast('La cita médica ha sido cancelada.', 'info');
    });
  }

  // ---------------------------------------------------------
  // D. FILTRADO DE MEDICAMENTOS ACTIVOS
  // ---------------------------------------------------------
  const medFilterBtns = document.querySelectorAll('.med-filter-btn');
  const medicationCards = document.querySelectorAll('.medication-card-item');

  medFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      medFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-med-filter');

      medicationCards.forEach(card => {
        const cardType = card.getAttribute('data-med-type');
        if (filterValue === 'all' || cardType === filterValue) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // ---------------------------------------------------------
  // E. DESCARGA DE DOCUMENTOS / RECETAS (SIMULACIÓN CLÍNICA)
  // ---------------------------------------------------------
  const downloadDocBtns = document.querySelectorAll('.btn-doc-download-action');
  downloadDocBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const docName = btn.getAttribute('data-doc-name') || 'Documento Clínico';
      showToast(`Descargando ${docName} en formato PDF seguro...`, 'success');
    });
  });

  // ---------------------------------------------------------
  // F. BOTÓN DE CERRAR SESIÓN
  // ---------------------------------------------------------
  const btnLogoutPatient = document.getElementById('btnLogoutPatient');
  if (btnLogoutPatient) {
    btnLogoutPatient.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.MedConnectAPI) {
        window.MedConnectAPI.logout();
      }
      showToast('Cerrando sesión de forma segura...', 'info');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 600);
    });
  }

  // ---------------------------------------------------------
  // G. HELPER: NOTIFICACIONES TOAST CLÍNICAS
  // ---------------------------------------------------------
  function showToast(message, type = 'info') {
    let container = document.getElementById('clinicalToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'clinicalToastContainer';
      container.className = 'clinical-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `clinical-toast ${type}`;

    let iconText = 'ℹ️';
    if (type === 'success') iconText = '✓';
    if (type === 'error') iconText = '⚠️';

    toast.innerHTML = `
      <div class="toast-icon">${iconText}</div>
      <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Remoción automática tras 3.5 segundos
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }
});
