/**
 * Presentación visual de la receta (MEDCONNECT CLINICAL).
 * Solo dibuja. No modifica el objeto de receta ni la persistencia.
 */

const fs = require('fs');
const path = require('path');
const { prepareStoredLogo } = require('./institution-identity');

const PETROL = '#286B68';
const NAVY = '#243746';
const MIST = '#F3F6F6';
const MUTED = '#667580';
const RULE = '#D5DEDE';

const LEFT = 46;
const RIGHT = 566;
const WIDTH = RIGHT - LEFT;
const TOP_FIRST = 118;
const TOP_NEXT = 78;
const BOTTOM = 728;

function textOrEmpty(value) {
  return String(value ?? '').trim();
}

function parseCalendarDate(value) {
  const text = textOrEmpty(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shown(value, feminine) {
  const text = textOrEmpty(value);
  if (text) return { text, missing: false };
  return { text: feminine ? 'No registrada' : 'No registrado', missing: true };
}

function formatBirth(value) {
  const raw = textOrEmpty(value);
  if (!raw) return shown('', true);
  const parsed = parseCalendarDate(raw);
  if (!parsed) return { text: raw, missing: false };
  return {
    text: parsed.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
    missing: false
  };
}

function formatAge(value) {
  const raw = textOrEmpty(value);
  if (!raw) return shown('', true);
  return { text: /^\d+$/.test(raw) ? `${raw} años` : raw, missing: false };
}

function formatIssued(prescription) {
  const raw = prescription.issuedAt || prescription.createdAt || new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return String(raw);
  return parsed.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

function resolveIssuedLogo(logoFile) {
  return prepareStoredLogo(logoFile);
}

function readBranding(prescription) {
  const source = prescription.branding;
  if (!source || typeof source !== 'object') return null;
  const kind = source.kind === 'clinic' ? 'clinic' : 'independent';
  const branding = {
    kind,
    clinicName: textOrEmpty(source.clinicName),
    address: textOrEmpty(source.address),
    phone: textOrEmpty(source.phone),
    email: textOrEmpty(source.email),
    logoPath: '',
    logoDark: false
  };
  if (kind !== 'clinic') return branding;
  const prepared = resolveIssuedLogo(source.logoFile);
  branding.logoPath = prepared.path;
  branding.logoDark = prepared.darkPlate;
  return branding;
}

function loadSignatureImage(prescription) {
  const rel = textOrEmpty(prescription.signatureFile).replace(/\\/g, '/');
  if (/^signatures\/[\w.-]+$/.test(rel)) {
    try {
      const abs = path.join(__dirname, 'data', rel);
      if (fs.existsSync(abs)) return fs.readFileSync(abs);
    } catch (err) {
      return null;
    }
  }
  const data = textOrEmpty(prescription.signature);
  const comma = data.indexOf(',');
  if (!data.startsWith('data:image/') || comma < 0) return null;
  try {
    const buffer = Buffer.from(data.slice(comma + 1), 'base64');
    return buffer.length ? buffer : null;
  } catch (err) {
    return null;
  }
}

function formatSignatureStamp(prescription) {
  const raw = prescription.signatureRecord?.signedAt || prescription.issuedAt || prescription.createdAt;
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) return '';
  const date = parsed.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const time = parsed.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

function adaptPrescriptionView(prescription) {
  const doctor = prescription.doctor || {};
  const clinic = prescription.clinic || {};
  const patient = prescription.patient || {};
  const treatments = Array.isArray(prescription.treatments) ? prescription.treatments : [];
  return {
    folio: textOrEmpty(prescription.folio),
    issuedLabel: formatIssued(prescription),
    consultationId: textOrEmpty(prescription.consultationId),
    doctorName: textOrEmpty(doctor.name),
    specialty: textOrEmpty(doctor.specialty),
    license: textOrEmpty(doctor.professionalId),
    clinicName: textOrEmpty(clinic.name),
    patientName: textOrEmpty(patient.name),
    birth: formatBirth(patient.birthDate),
    age: formatAge(patient.age),
    curp: textOrEmpty(patient.curp),
    diagnosis: textOrEmpty(prescription.diagnosis),
    reason: textOrEmpty(prescription.reason),
    clinicalNotes: textOrEmpty(prescription.clinicalNotes),
    observations: textOrEmpty(prescription.observations),
    signatureImage: loadSignatureImage(prescription),
    signatureSignedAt: formatSignatureStamp(prescription),
    branding: readBranding(prescription),
    treatments
  };
}

function ensure(doc, height) {
  if (doc.y + height > BOTTOM) doc.addPage();
}

function paintTracked(doc, value, x, y, size, color, font, gap) {
  doc.font(font).fontSize(size).fillColor(color);
  let cursor = x;
  for (const glyph of value) {
    doc.text(glyph, cursor, y, { lineBreak: false });
    cursor += doc.widthOfString(glyph) + gap;
  }
  return cursor;
}

function clipLine(doc, value, width) {
  const text = textOrEmpty(value);
  if (!text || doc.widthOfString(text) <= width) return text;
  let clipped = text;
  while (clipped.length > 1 && doc.widthOfString(`${clipped}…`) > width) clipped = clipped.slice(0, -1);
  return `${clipped}…`;
}

function paintRunningHeader(doc, view) {
  const y = doc.y;
  doc.save();
  doc.rect(0, 0, 612, 3.5).fill(PETROL);
  doc.restore();
  const wordEnd = paintTracked(doc, 'MEDCONNECT', LEFT, 20, 8, PETROL, 'Helvetica-Bold', 0.7);
  if (view.branding) {
    const identity = view.branding.kind === 'clinic' && view.branding.clinicName
      ? view.branding.clinicName
      : view.doctorName;
    if (identity) {
      const gapX = wordEnd + 10;
      doc.font('Helvetica').fontSize(8).fillColor(NAVY)
        .text(clipLine(doc, identity, 330 - gapX), gapX, 20, { lineBreak: false });
    }
  } else {
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text('RECETA MÉDICA', 148, 20, { lineBreak: false });
  }
  doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY)
    .text(view.folio || 'Sin folio', 340, 20, { width: 226, align: 'right', lineBreak: false });
  doc.strokeColor(RULE).lineWidth(0.6).moveTo(LEFT, 40).lineTo(RIGHT, 40).stroke();
  doc.x = LEFT;
  doc.y = y;
}

function paintFooter(doc, view) {
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 10;
  doc.save();
  doc.strokeColor(RULE).lineWidth(0.6).moveTo(LEFT, 738).lineTo(RIGHT, 738).stroke();
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PETROL)
    .text('MedConnect', LEFT, 748, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text('Receta médica', LEFT + 62, 748, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(NAVY)
    .text(view.folio || '', 250, 748, { width: 200, align: 'center', lineBreak: false });
  doc.page.margins.bottom = bottom;
  doc.x = LEFT;
}

function paintMasthead(doc, view) {
  if (view.branding) return paintInstitutionalMasthead(doc, view);
  doc.save();
  doc.rect(0, 0, 612, 5).fill(PETROL);
  doc.restore();
  doc.save();
  doc.rect(LEFT, 24, 7, 7).fill(PETROL);
  doc.restore();
  paintTracked(doc, 'MEDCONNECT', LEFT + 14, 22, 9, PETROL, 'Helvetica-Bold', 1.15);
  doc.strokeColor(PETROL).lineWidth(0.8).moveTo(LEFT, 40).lineTo(LEFT + 118, 40).stroke();
  doc.font('Helvetica-Bold').fontSize(20).fillColor(NAVY)
    .text('RECETA MÉDICA', LEFT, 48, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
    .text('Documento de prescripción clínica', LEFT, 74, { lineBreak: false });

  const plateX = 372;
  const plateY = 22;
  const plateW = 194;
  const plateH = 78;
  doc.save();
  doc.rect(plateX, plateY, plateW, plateH).fill(MIST);
  doc.rect(plateX, plateY, 3, plateH).fill(PETROL);
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED)
    .text('FOLIO', plateX + 14, plateY + 8, { lineBreak: false, characterSpacing: 0.8 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY)
    .text(view.folio || 'Sin folio', plateX + 14, plateY + 20, { width: plateW - 24, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text('Fecha de emisión', plateX + 14, plateY + 38, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor(NAVY)
    .text(view.issuedLabel, plateX + 14, plateY + 48, { width: plateW - 24, lineBreak: false });
  const consult = shown(view.consultationId, false);
  doc.font(consult.missing ? 'Helvetica-Oblique' : 'Helvetica').fontSize(7.5)
    .fillColor(consult.missing ? MUTED : MUTED)
    .text(`Consulta  ${consult.text}`, plateX + 14, plateY + 62, { width: plateW - 24, lineBreak: false });

  doc.strokeColor(RULE).lineWidth(0.7).moveTo(LEFT, 108).lineTo(RIGHT, 108).stroke();
  doc.x = LEFT;
  doc.y = TOP_FIRST;
  return TOP_FIRST;
}

function paintFolioPlate(doc, view) {
  const plateX = 372;
  const plateY = 22;
  const plateW = 194;
  const plateH = 78;
  doc.save();
  doc.rect(plateX, plateY, plateW, plateH).fill(MIST);
  doc.rect(plateX, plateY, 3, plateH).fill(PETROL);
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED)
    .text('FOLIO', plateX + 14, plateY + 8, { lineBreak: false, characterSpacing: 0.8 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY)
    .text(view.folio || 'Sin folio', plateX + 14, plateY + 20, { width: plateW - 24, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text('Fecha de emisión', plateX + 14, plateY + 38, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor(NAVY)
    .text(view.issuedLabel, plateX + 14, plateY + 48, { width: plateW - 24, lineBreak: false });
  const consult = shown(view.consultationId, false);
  doc.font(consult.missing ? 'Helvetica-Oblique' : 'Helvetica').fontSize(7.5)
    .fillColor(MUTED)
    .text(`Consulta  ${consult.text}`, plateX + 14, plateY + 62, { width: plateW - 24, lineBreak: false });
}

function paintInstitutionalMasthead(doc, view) {
  doc.save();
  doc.rect(0, 0, 612, 5).fill(PETROL);
  doc.restore();

  const brand = view.branding;
  const clinicMode = brand.kind === 'clinic' && brand.clinicName;
  let textX = LEFT;
  if (clinicMode && brand.logoPath) {
    try {
      doc.save();
      doc.rect(LEFT, 20, 40, 40).fill(brand.logoDark ? NAVY : MIST);
      doc.restore();
      doc.image(brand.logoPath, LEFT, 20, {
        fit: [40, 40],
        align: 'center',
        valign: 'center'
      });
      textX = LEFT + 50;
    } catch (err) {
      doc.save();
      doc.rect(LEFT, 20, 40, 40).fill(MIST);
      doc.restore();
    }
  }

  const textW = 356 - textX;
  const title = clinicMode ? brand.clinicName : (view.doctorName || 'Médico tratante');
  doc.font('Helvetica-Bold').fontSize(18).fillColor(NAVY);
  const titleH = doc.heightOfString(title, { width: textW, lineGap: -1 });
  doc.text(title, textX, 18, { width: textW, lineGap: -1 });
  let y = 18 + titleH + 5;
  doc.strokeColor(PETROL).lineWidth(1.6)
    .moveTo(textX, y).lineTo(Math.min(textX + 78, 356), y).stroke();
  y += 8;
  const metaParts = clinicMode
    ? [brand.address, brand.phone, brand.email].filter(Boolean)
    : [view.specialty, view.license ? `Cédula ${view.license}` : ''].filter(Boolean);
  if (metaParts.length) {
    const meta = metaParts.join('  ·  ');
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    const metaH = doc.heightOfString(meta, { width: textW });
    doc.text(meta, textX, y, { width: textW });
    y += metaH + 3;
  }
  doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    .text('Powered by ', textX, y, { lineBreak: false });
  const poweredW = doc.widthOfString('Powered by ');
  doc.font('Helvetica-Bold').fontSize(7).fillColor(PETROL)
    .text('MedConnect', textX + poweredW, y, { lineBreak: false });
  y += 12;

  const typeY = Math.max(y + 6, 76);
  paintTracked(doc, 'RECETA MÉDICA', LEFT, typeY, 9, PETROL, 'Helvetica-Bold', 1.15);
  const ruleY = Math.max(108, typeY + 20);
  paintFolioPlate(doc, view);
  doc.strokeColor(RULE).lineWidth(0.7).moveTo(LEFT, ruleY).lineTo(RIGHT, ruleY).stroke();
  doc.x = LEFT;
  doc.y = ruleY + 12;
  return doc.y;
}

function paintKicker(doc, label, emphasis) {
  ensure(doc, 26);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(emphasis ? 11 : 8).fillColor(PETROL)
    .text(label, LEFT, y, { lineBreak: false, characterSpacing: emphasis ? 0.6 : 1 });
  const ruleY = y + (emphasis ? 16 : 12);
  doc.strokeColor(PETROL).lineWidth(emphasis ? 1.35 : 0.75)
    .moveTo(LEFT, ruleY).lineTo(LEFT + (emphasis ? 132 : 42), ruleY).stroke();
  doc.x = LEFT;
  doc.y = ruleY + 10;
}

function valueHeight(doc, value, width, size) {
  const face = value.missing ? 'Helvetica-Oblique' : 'Helvetica';
  doc.font(face).fontSize(size);
  return doc.heightOfString(value.text, { width });
}

function paintValue(doc, value, x, y, width, size) {
  doc.font(value.missing ? 'Helvetica-Oblique' : 'Helvetica')
    .fontSize(size)
    .fillColor(value.missing ? MUTED : NAVY)
    .text(value.text, x, y, { width });
}

function paintField(doc, label, raw, x, y, width, feminine) {
  const value = typeof raw === 'object' && raw && 'missing' in raw ? raw : shown(raw, feminine);
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text(label, x, y, { width, lineBreak: false });
  paintValue(doc, value, x, y + 11, width, 9.5);
  return 11 + valueHeight(doc, value, width, 9.5);
}

function paintPairs(doc, rows) {
  const gap = 18;
  const colW = (WIDTH - gap) / 2;
  for (let i = 0; i < rows.length; i += 2) {
    const left = rows[i];
    const right = rows[i + 1];
    const leftValue = shown(left[1], left[2]);
    const rightValue = right ? shown(right[1], right[2]) : null;
    const h = Math.max(
      11 + valueHeight(doc, leftValue, colW, 9.5),
      rightValue ? 11 + valueHeight(doc, rightValue, colW, 9.5) : 0
    );
    ensure(doc, h + 8);
    const y = doc.y;
    paintField(doc, left[0], leftValue, LEFT, y, colW, left[2]);
    if (right) paintField(doc, right[0], rightValue, LEFT + colW + gap, y, colW, right[2]);
    doc.y = y + h + 8;
    doc.x = LEFT;
  }
}

function paintParagraph(doc, label, raw, feminine, size = 10.5) {
  const value = shown(raw, feminine);
  ensure(doc, 28);
  const y = doc.y;
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text(label, LEFT, y, { width: WIDTH, lineBreak: false });
  doc.font(value.missing ? 'Helvetica-Oblique' : 'Helvetica').fontSize(size)
    .fillColor(value.missing ? MUTED : NAVY)
    .text(value.text, LEFT, y + 12, { width: WIDTH, lineGap: 1.5 });
  doc.x = LEFT;
  doc.y += 8;
}

function paintIdentities(doc, view) {
  const gap = 22;
  const colW = (WIDTH - gap) / 2;
  const leftRows = [
    ['Nombre', view.doctorName],
    ['Especialidad', view.specialty],
    ['Cédula profesional', view.license],
    ['Institución', view.clinicName]
  ];
  const rightRows = [
    ['Nombre', view.patientName],
    ['Fecha de nacimiento', view.birth],
    ['Edad', view.age],
    ['CURP', view.curp, false]
  ];

  const rowHeight = (row, width) => {
    const value = typeof row[1] === 'object' ? row[1] : shown(row[1], row[2]);
    return 11 + valueHeight(doc, value, width, 9.5) + 8;
  };
  const rows = Math.max(leftRows.length, rightRows.length);
  let block = 22;
  for (let i = 0; i < rows; i += 1) {
    block += Math.max(
      leftRows[i] ? rowHeight(leftRows[i], colW) : 0,
      rightRows[i] ? rowHeight(rightRows[i], colW) : 0
    );
  }
  ensure(doc, block + 8);
  const top = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PETROL)
    .text('MÉDICO', LEFT, top, { lineBreak: false, characterSpacing: 0.9 });
  doc.text('PACIENTE', LEFT + colW + gap, top, { lineBreak: false, characterSpacing: 0.9 });
  let y = top + 16;
  for (let i = 0; i < rows; i += 1) {
    const left = leftRows[i];
    const right = rightRows[i];
    const leftValue = left ? (typeof left[1] === 'object' ? left[1] : shown(left[1], left[2])) : null;
    const rightValue = right ? (typeof right[1] === 'object' ? right[1] : shown(right[1], right[2])) : null;
    const h = Math.max(
      leftValue ? 11 + valueHeight(doc, leftValue, colW, 9.5) : 0,
      rightValue ? 11 + valueHeight(doc, rightValue, colW, 9.5) : 0
    );
    if (left) paintField(doc, left[0], leftValue, LEFT, y, colW);
    if (right) paintField(doc, right[0], rightValue, LEFT + colW + gap, y, colW, right[2]);
    y += h + 8;
  }
  doc.save();
  doc.strokeColor(RULE).lineWidth(0.6)
    .moveTo(LEFT + colW + gap / 2, top).lineTo(LEFT + colW + gap / 2, y - 6).stroke();
  doc.restore();
  doc.x = LEFT;
  doc.y = y + 4;
}

function medicationRows(treatment) {
  const rows = [
    ['Dosis / presentación', treatment.dose],
    ['Vía de administración', treatment.route],
    ['Frecuencia', treatment.frequency],
    ['Duración', treatment.duration],
    ['Cantidad', treatment.quantity]
  ];
  if (textOrEmpty(treatment.concentration)) rows.splice(1, 0, ['Concentración', treatment.concentration]);
  if (textOrEmpty(treatment.presentation)) {
    const doseAt = rows.findIndex(row => row[0] === 'Dosis / presentación');
    rows.splice(doseAt + 1, 0, ['Presentación', treatment.presentation]);
  }
  return rows;
}

function medicationHeight(doc, treatment) {
  const name = shown(treatment.medication, false);
  doc.font('Helvetica-Bold').fontSize(11);
  const bandH = Math.max(28, doc.heightOfString(name.text, { width: WIDTH - 56 }) + 14);
  let height = bandH + 8;
  const rows = medicationRows(treatment);
  const colW = (WIDTH - 18) / 2;
  for (let i = 0; i < rows.length; i += 2) {
    const left = shown(rows[i][1], rows[i][2]);
    const right = rows[i + 1] ? shown(rows[i + 1][1], rows[i + 1][2]) : null;
    height += Math.max(
      11 + valueHeight(doc, left, colW, 9.5),
      right ? 11 + valueHeight(doc, right, colW, 9.5) : 0
    ) + 8;
  }
  const notes = shown(treatment.notes, false);
  doc.font(notes.missing ? 'Helvetica-Oblique' : 'Helvetica').fontSize(10.5);
  height += 12 + doc.heightOfString(notes.text, { width: WIDTH, lineGap: 1.5 }) + 8;
  return height;
}

function paintMedication(doc, treatment, index) {
  const needed = medicationHeight(doc, treatment || {});
  const pageRoom = BOTTOM - TOP_NEXT;
  if (needed < pageRoom && doc.y + needed > BOTTOM) doc.addPage();

  const name = shown((treatment || {}).medication, false);
  doc.font('Helvetica-Bold').fontSize(11);
  const nameH = doc.heightOfString(name.text, { width: WIDTH - 56 });
  const bandH = Math.max(28, nameH + 14);
  const y = doc.y;
  doc.save();
  doc.rect(LEFT, y, WIDTH, bandH).fill(MIST);
  doc.rect(LEFT, y, 3, bandH).fill(PETROL);
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(PETROL)
    .text(String(index + 1).padStart(2, '0'), LEFT + 12, y + (bandH - 11) / 2, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(name.missing ? MUTED : NAVY)
    .text(name.text, LEFT + 38, y + 8, { width: WIDTH - 52 });
  doc.x = LEFT;
  doc.y = y + bandH + 8;
  paintPairs(doc, medicationRows(treatment));
  paintParagraph(doc, 'Indicaciones', treatment.notes, false);
}

function paintSignature(doc, view) {
  const image = view.signatureImage;
  ensure(doc, image ? 136 : 84);
  const x = RIGHT - 210;
  const start = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PETROL)
    .text('FIRMA', x, start, { lineBreak: false, characterSpacing: 0.8 });
  let y = start + 14;
  let drewImage = false;
  if (image) {
    try {
      doc.image(image, x, y, { fit: [180, 46], align: 'center', valign: 'center' });
      y += 50;
      drewImage = true;
    } catch (err) {
      y += 28;
    }
  } else {
    y += 28;
  }
  doc.strokeColor(NAVY).lineWidth(0.7).moveTo(x, y).lineTo(x + 200, y).stroke();
  const name = shown(view.doctorName, false);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(name.missing ? MUTED : NAVY)
    .text(name.text, x, y + 4, { width: 200, lineBreak: false });
  const license = shown(view.license, false);
  doc.font(license.missing ? 'Helvetica-Oblique' : 'Helvetica').fontSize(8).fillColor(MUTED)
    .text(`Cédula profesional  ${license.text}`, x, y + 16, { width: 200, lineBreak: false });
  if (drewImage) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(MUTED)
      .text('Firmado electrónicamente', x, y + 28, { width: 200, lineBreak: false });
    if (view.signatureSignedAt) {
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
        .text(view.signatureSignedAt, x, y + 38, { width: 200, lineBreak: false });
    }
  }
  doc.x = LEFT;
  doc.y = y + (drewImage ? 52 : 32);
}

function stampPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i += 1) {
    doc.switchToPage(range.start + i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 8;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(`${i + 1}  /  ${total}`, 470, 748, { width: 96, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
}

function drawClinicalPrescription(doc, prescription) {
  const view = adaptPrescriptionView(prescription || {});
  doc.on('pageAdded', () => {
    paintRunningHeader(doc, view);
    paintFooter(doc, view);
    doc.x = LEFT;
    doc.y = TOP_NEXT;
  });

  const contentTop = paintMasthead(doc, view);
  paintFooter(doc, view);
  doc.x = LEFT;
  doc.y = contentTop;

  paintIdentities(doc, view);
  doc.moveDown(0.4);
  paintKicker(doc, 'INFORMACIÓN CLÍNICA');
  paintParagraph(doc, 'Diagnóstico', view.diagnosis, false, 12);
  paintParagraph(doc, 'Motivo de consulta', view.reason, false);
  paintParagraph(doc, 'Observaciones clínicas', view.clinicalNotes, false);

  doc.moveDown(0.3);
  paintKicker(doc, 'PRESCRIPCIÓN', true);
  if (!view.treatments.length) {
    paintParagraph(doc, 'Medicamentos', '', false);
  } else {
    view.treatments.forEach((treatment, index) => {
      paintMedication(doc, treatment || {}, index);
      if (index < view.treatments.length - 1) doc.y += 6;
    });
  }

  doc.moveDown(0.2);
  paintKicker(doc, 'INDICACIONES ADICIONALES');
  paintParagraph(doc, 'Recomendaciones, cuidados y seguimiento', view.observations, false);

  doc.moveDown(0.6);
  paintSignature(doc, view);
  stampPageNumbers(doc);
}

module.exports = { drawClinicalPrescription };
