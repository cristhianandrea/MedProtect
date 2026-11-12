/**
 * Identidad institucional compartida por clínica.
 * El logotipo vive como archivo. La receta solo guarda la referencia vigente al emitirse.
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const dataDir = path.join(__dirname, 'data');
const institutionsFile = path.join(dataDir, 'institutions.json');
const usersFile = path.join(dataDir, 'users.json');
const logosDir = path.join(dataDir, 'logos');
const MAX_LOGO_BYTES = 1024 * 1024;

function textOrEmpty(value) {
  return String(value ?? '').trim();
}

function normalizeClinicName(value) {
  return textOrEmpty(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function loadJSON(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error leyendo ${filePath}:`, err);
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function loadInstitutions() {
  const data = loadJSON(institutionsFile, []);
  return Array.isArray(data) ? data : [];
}

function saveInstitutions(list) {
  saveJSON(institutionsFile, list);
}

function sniffImage(buffer) {
  if (!buffer || buffer.length < 3) return '';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  return '';
}

function decodeLogo(logoBase64) {
  const raw = textOrEmpty(logoBase64);
  if (!raw) return null;
  const payload = raw.includes(',') ? raw.split(',').pop() : raw;
  const buffer = Buffer.from(payload || '', 'base64');
  if (!buffer.length || buffer.length > MAX_LOGO_BYTES) {
    return { error: 'El logotipo debe ser PNG o JPG de hasta 1 MB.' };
  }
  const ext = sniffImage(buffer);
  if (!ext) return { error: 'El logotipo debe ser una imagen PNG o JPG.' };
  return { buffer, ext };
}

const LOGO_ALPHA_MARGIN = 16;

function colorSat(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function colorClose(r, g, b, target) {
  return colorSat(r, g, b) < 30
    && Math.abs(r - target[0]) < 24
    && Math.abs(g - target[1]) < 24
    && Math.abs(b - target[2]) < 24;
}

function detectCheckerboard(png) {
  const { width, height, data } = png;
  if (width < 48 || height < 48) return null;
  const sample = Math.min(width, 220);
  const row = [];
  for (let x = 0; x < sample; x += 1) {
    const r = data[x * 4];
    const g = data[(x * 4) + 1];
    const b = data[(x * 4) + 2];
    if (colorSat(r, g, b) > 28 || (r + g + b) / 3 < 170) return null;
    row.push(r > 242 ? 1 : 0);
  }
  let period = 1;
  while (period < row.length && row[period] === row[0]) period += 1;
  if (period < 8 || period > 48 || period >= row.length) return null;
  const other = row[period];
  if (other === row[0]) return null;
  for (let i = 0; i < period * 4 && i < row.length; i += 1) {
    const expected = Math.floor(i / period) % 2 === 0 ? row[0] : other;
    if (row[i] !== expected) return null;
  }
  const even = [data[0], data[1], data[2]];
  const oddAt = period * 4;
  const odd = [data[oddAt], data[oddAt + 1], data[oddAt + 2]];
  return { tile: period, even, odd };
}

function restoreCheckerboard(png, board) {
  const { width, height, data } = png;
  const { tile, even, odd } = board;
  const ink = new Uint8Array(width * height);
  const parity = (x, y) => (Math.floor(x / tile) + Math.floor(y / tile)) % 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = ((y * width) + x) * 4;
      const target = parity(x, y) === 0 ? even : odd;
      if (!colorClose(data[i], data[i + 1], data[i + 2], target)) ink[(y * width) + x] = 1;
    }
  }
  const out = new PNG({ width, height });
  const radius = Math.max(8, Math.round(tile * 0.8));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = (y * width) + x;
      const i = p * 4;
      if (ink[p]) {
        out.data[i] = data[i];
        out.data[i + 1] = data[i + 1];
        out.data[i + 2] = data[i + 2];
        out.data[i + 3] = 255;
        continue;
      }
      let count = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (let dy = -radius; dy <= radius; dy += 2) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx += 2) {
          const xx = x + dx;
          if (xx < 0 || xx >= width || !ink[(yy * width) + xx]) continue;
          const j = ((yy * width) + xx) * 4;
          count += 1;
          sumR += data[j];
          sumG += data[j + 1];
          sumB += data[j + 2];
        }
      }
      if (count < 28) continue;
      const avgR = sumR / count;
      const avgG = sumG / count;
      const avgB = sumB / count;
      if (colorSat(avgR, avgG, avgB) < 40 && (avgR + avgG + avgB) / 3 > 180) {
        out.data[i] = 255;
        out.data[i + 1] = 255;
        out.data[i + 2] = 255;
        out.data[i + 3] = 255;
      }
    }
  }
  return out;
}

function trimVisiblePng(png) {
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(((y * width) + x) * 4) + 3];
      if (alpha <= LOGO_ALPHA_MARGIN) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  if (cropW < 8 || cropH < 8) return null;
  const pad = Math.max(2, Math.round(Math.max(cropW, cropH) * 0.06));
  const outW = cropW + (pad * 2);
  const outH = cropH + (pad * 2);
  const out = new PNG({ width: outW, height: outH });
  for (let y = 0; y < cropH; y += 1) {
    for (let x = 0; x < cropW; x += 1) {
      const src = (((y + minY) * width) + (x + minX)) * 4;
      const dst = (((y + pad) * outW) + (x + pad)) * 4;
      out.data[dst] = data[src];
      out.data[dst + 1] = data[src + 1];
      out.data[dst + 2] = data[src + 2];
      out.data[dst + 3] = data[src + 3];
    }
  }
  return PNG.sync.write(out);
}

function fitTransparentPng(buffer) {
  let png;
  try {
    png = PNG.sync.read(buffer);
  } catch (err) {
    return null;
  }
  let transparent = false;
  for (let i = 3; i < png.data.length; i += 4) {
    if (png.data[i] < 255) {
      transparent = true;
      break;
    }
  }
  if (transparent) return trimVisiblePng(png);
  const board = detectCheckerboard(png);
  if (!board) return null;
  return trimVisiblePng(restoreCheckerboard(png, board));
}

function logoIsLight(absPath) {
  let png;
  try {
    png = PNG.sync.read(fs.readFileSync(absPath));
  } catch (err) {
    return false;
  }
  let sum = 0;
  let count = 0;
  const { data } = png;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= LOGO_ALPHA_MARGIN) continue;
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    count += 1;
  }
  return count > 0 && (sum / count) >= 175;
}

function prepareStoredLogo(logoFile) {
  const relative = textOrEmpty(logoFile).replace(/\\/g, '/');
  if (!relative.startsWith('logos/')) return { path: '', darkPlate: false };
  const base = path.basename(relative);
  const originalAbs = resolveLogoFile(base);
  if (!originalAbs) return { path: '', darkPlate: false };
  const ext = path.extname(originalAbs).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return { path: originalAbs, darkPlate: false };
  if (base.endsWith('.fit.png')) return { path: originalAbs, darkPlate: logoIsLight(originalAbs) };
  const fittedName = `${path.basename(originalAbs, ext)}.fit.png`;
  const fittedAbs = path.join(logosDir, fittedName);
  if (!fs.existsSync(fittedAbs)) {
    try {
      const fitted = fitTransparentPng(fs.readFileSync(originalAbs));
      if (fitted) fs.writeFileSync(fittedAbs, fitted);
    } catch (err) {
      return { path: originalAbs, darkPlate: false };
    }
  }
  const useAbs = fs.existsSync(fittedAbs) ? fittedAbs : originalAbs;
  return { path: useAbs, darkPlate: logoIsLight(useAbs) };
}

function prescriptionLogo(decoded) {
  if (decoded.ext === 'png') {
    const fitted = fitTransparentPng(decoded.buffer);
    if (fitted) return { buffer: fitted, ext: 'png', mime: 'image/png', keepOriginal: true };
  }
  return {
    buffer: decoded.buffer,
    ext: decoded.ext,
    mime: decoded.ext === 'png' ? 'image/png' : 'image/jpeg',
    keepOriginal: false
  };
}

function storeLogo(institutionId, decoded) {
  fs.mkdirSync(logosDir, { recursive: true });
  const stamp = `${institutionId}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const prepared = prescriptionLogo(decoded);
  if (prepared.keepOriginal) {
    const originalName = `${stamp}.png`;
    const fittedName = `${stamp}.fit.png`;
    fs.writeFileSync(path.join(logosDir, originalName), decoded.buffer);
    fs.writeFileSync(path.join(logosDir, fittedName), prepared.buffer);
    return { logoFile: `logos/${fittedName}`, logoOriginal: `logos/${originalName}` };
  }
  const fileName = `${stamp}.${prepared.ext}`;
  fs.writeFileSync(path.join(logosDir, fileName), prepared.buffer);
  return { logoFile: `logos/${fileName}`, logoOriginal: '' };
}

function assignStoredLogo(institution, decoded) {
  const stored = storeLogo(institution.id, decoded);
  institution.logoFile = stored.logoFile;
  institution.logoOriginal = stored.logoOriginal;
}

function clearStoredLogo(institution) {
  institution.logoFile = '';
  institution.logoOriginal = '';
}

function prepareLogoPreview(logoBase64) {
  const decoded = decodeLogo(logoBase64);
  if (!decoded) return { error: 'El logotipo debe ser una imagen PNG o JPG.' };
  if (decoded.error) return { error: decoded.error };
  const prepared = prescriptionLogo(decoded);
  return { mime: prepared.mime, buffer: prepared.buffer };
}

function filledDiff(current, incoming) {
  const next = textOrEmpty(incoming);
  if (!next) return false;
  return next !== textOrEmpty(current);
}

function proposesInstitutionChange(institution, doctorData, logo) {
  if (logo.buffer || logo.removeLogo) return true;
  if (filledDiff(institution.address, doctorData.clinicAddress)) return true;
  if (filledDiff(institution.phone, doctorData.clinicPhone)) return true;
  if (filledDiff(institution.email, doctorData.clinicEmail)) return true;
  return false;
}

function detachDoctor(institutions, institution, doctorId) {
  if (!institution || !doctorId) return;
  institution.memberIds = (institution.memberIds || []).filter(id => id !== doctorId);
  if (institution.ownerDoctorId !== doctorId) return;
  if (institution.memberIds.length) {
    institution.ownerDoctorId = institution.memberIds[0];
    return;
  }
  const index = institutions.findIndex(item => item.id === institution.id);
  if (index >= 0) institutions.splice(index, 1);
}

function fieldsFromInstitution(institution) {
  return {
    clinicId: institution.id,
    clinicName: institution.name || '',
    clinicAddress: institution.address || '',
    clinicPhone: institution.phone || '',
    clinicEmail: institution.email || ''
  };
}

function applyDoctorInstitution(previous, doctorData, logoInput) {
  const doctorId = textOrEmpty(doctorData.id || previous.id);
  if (!doctorId) return { error: 'No se identificó al médico para guardar la identidad institucional.', status: 400 };

  const logo = { buffer: null, ext: '', removeLogo: !!(logoInput && logoInput.removeLogo) };
  if (logoInput && logoInput.logoBase64) {
    const decoded = decodeLogo(logoInput.logoBase64);
    if (decoded && decoded.error) return { error: decoded.error, status: 400 };
    if (decoded) {
      logo.buffer = decoded.buffer;
      logo.ext = decoded.ext;
      logo.removeLogo = false;
    }
  }

  const institutions = loadInstitutions();
  const previousInstitution = previous.clinicId
    ? institutions.find(item => item.id === previous.clinicId)
    : null;
  const clinicName = textOrEmpty(doctorData.clinicName);

  if (!clinicName) {
    detachDoctor(institutions, previousInstitution, doctorId);
    saveInstitutions(institutions);
    return {
      doctorFields: {
        clinicId: '',
        clinicName: '',
        clinicAddress: '',
        clinicPhone: '',
        clinicEmail: ''
      }
    };
  }

  const nameKey = normalizeClinicName(clinicName);
  let institution = institutions.find(item => item.nameKey === nameKey);
  if (!institution && previousInstitution && previousInstitution.ownerDoctorId === doctorId) {
    previousInstitution.name = clinicName;
    previousInstitution.nameKey = nameKey;
    institution = previousInstitution;
  }

  if (!institution) {
    institution = {
      id: `INS-${Date.now()}`,
      nameKey,
      name: clinicName,
      address: textOrEmpty(doctorData.clinicAddress),
      phone: textOrEmpty(doctorData.clinicPhone),
      email: textOrEmpty(doctorData.clinicEmail),
      logoFile: '',
      logoOriginal: '',
      ownerDoctorId: doctorId,
      memberIds: [doctorId]
    };
    if (logo.buffer) assignStoredLogo(institution, logo);
    institutions.push(institution);
    if (previousInstitution && previousInstitution.id !== institution.id) {
      detachDoctor(institutions, previousInstitution, doctorId);
    }
    saveInstitutions(institutions);
    return { doctorFields: fieldsFromInstitution(institution) };
  }

  const isOwner = institution.ownerDoctorId === doctorId;
  const isMember = isOwner || (institution.memberIds || []).includes(doctorId);
  if (!isOwner && proposesInstitutionChange(institution, doctorData, logo)) {
    return {
      error: 'Esta clínica ya tiene identidad institucional. Solo el médico responsable puede modificarla.',
      status: 403
    };
  }

  if (!isMember) institution.memberIds = [...(institution.memberIds || []), doctorId];

  if (isOwner) {
    institution.name = clinicName;
    institution.nameKey = nameKey;
    institution.address = textOrEmpty(doctorData.clinicAddress);
    institution.phone = textOrEmpty(doctorData.clinicPhone);
    institution.email = textOrEmpty(doctorData.clinicEmail);
    if (logo.removeLogo) clearStoredLogo(institution);
    if (logo.buffer) assignStoredLogo(institution, logo);
  }

  if (previousInstitution && previousInstitution.id !== institution.id) {
    detachDoctor(institutions, previousInstitution, doctorId);
  }
  saveInstitutions(institutions);
  return { doctorFields: fieldsFromInstitution(institution) };
}

function findDoctor(doctorId) {
  const key = textOrEmpty(doctorId).toLowerCase();
  if (!key) return null;
  const users = loadJSON(usersFile, { doctors: [] });
  return (users.doctors || []).find(doctor =>
    textOrEmpty(doctor.id).toLowerCase() === key ||
    textOrEmpty(doctor.professionalId).toLowerCase() === key
  ) || null;
}

function presentDoctor(doctor) {
  if (!doctor) return null;
  const { password, ...safe } = doctor;
  const institution = doctor.clinicId
    ? loadInstitutions().find(item => item.id === doctor.clinicId)
    : null;
  if (!institution) {
    safe.clinicEmail = safe.clinicEmail || '';
    safe.logoUrl = '';
    safe.canEditInstitution = true;
    safe.institutionRole = textOrEmpty(safe.clinicName) ? 'owner' : 'independent';
    return safe;
  }
  safe.clinicName = institution.name || '';
  safe.clinicAddress = institution.address || '';
  safe.clinicPhone = institution.phone || '';
  safe.clinicEmail = institution.email || '';
  safe.logoFile = institution.logoFile || '';
  safe.logoUrl = institution.logoFile ? `/api/logos/${path.basename(institution.logoFile)}` : '';
  safe.canEditInstitution = institution.ownerDoctorId === doctor.id;
  safe.institutionRole = safe.canEditInstitution ? 'owner' : 'member';
  return safe;
}

function captureBranding(doctorId) {
  const doctor = findDoctor(doctorId);
  if (!doctor) return null;
  const institution = doctor.clinicId
    ? loadInstitutions().find(item => item.id === doctor.clinicId)
    : null;
  if (institution && textOrEmpty(institution.name)) {
    return {
      kind: 'clinic',
      clinicName: textOrEmpty(institution.name),
      address: textOrEmpty(institution.address),
      phone: textOrEmpty(institution.phone),
      email: textOrEmpty(institution.email),
      logoFile: textOrEmpty(institution.logoFile)
    };
  }
  if (textOrEmpty(doctor.clinicName)) {
    return {
      kind: 'clinic',
      clinicName: textOrEmpty(doctor.clinicName),
      address: textOrEmpty(doctor.clinicAddress),
      phone: textOrEmpty(doctor.clinicPhone),
      email: textOrEmpty(doctor.clinicEmail),
      logoFile: ''
    };
  }
  return {
    kind: 'independent',
    clinicName: '',
    address: '',
    phone: '',
    email: '',
    logoFile: ''
  };
}

function resolveLogoFile(fileName) {
  const base = path.basename(textOrEmpty(fileName));
  if (!/^[\w.-]+$/.test(base)) return '';
  const full = path.resolve(logosDir, base);
  const root = path.resolve(logosDir);
  if (full !== root && !full.startsWith(root + path.sep)) return '';
  if (!fs.existsSync(full)) return '';
  return full;
}

module.exports = {
  applyDoctorInstitution,
  presentDoctor,
  captureBranding,
  resolveLogoFile,
  prepareLogoPreview,
  prepareStoredLogo,
  MAX_LOGO_BYTES
};
