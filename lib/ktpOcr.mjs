const FIELD_LABELS = [
  'N\\.?\\s*I\\.?\\s*K',
  'NAMA(?:\\s+LENGKAP)?',
  'N4MA(?:\\s+LENGKAP)?',
  'TEMPAT\\s*/?\\s*TGL?\\.?\\s*LAHIR',
  'TEMPAT\\s+LAHIR',
  'JENIS\\s*KELAMIN',
  'GOL(?:ONGAN)?\\s*\\.?\\s*DARAH',
  'ALAMAT',
  'RT\\s*/?\\s*RW',
  '(?:KEL(?:URAHAN)?\\s*/\\s*DESA|DESA\\s*/\\s*KEL(?:URAHAN)?)',
  'KEL(?:URAHAN)?',
  'DESA',
  'KECAMATAN',
  'KAB(?:UPATEN)?(?:\\s*/\\s*KOTA|\\s+KOTA)?',
  'KOTA',
  'PROVINSI',
  'AGAMA',
  'STATUS\\s+PERKAWINAN',
  'PEKERJAAN',
  'KEWARGANEGARAAN',
  'BERLAKU\\s+HINGGA',
];

const FIELD_START_RE = new RegExp(`^(?:${FIELD_LABELS.join('|')})(?:\\b|\\s|[:=])`, 'i');
const INLINE_LABEL_RE = new RegExp(`\\s+(?=(?:${FIELD_LABELS.join('|')})\\s*[:=])`, 'i');
const NIK_LABEL_RE = /\bN\s*\.?\s*[I1l|!]\s*\.?\s*K\b/i;
const FIELD_KEYS = [
  'nik', 'name', 'placeOfBirth', 'birthDate', 'gender', 'bloodType', 'address', 'rtRw',
  'village', 'district', 'city', 'province', 'religion', 'maritalStatus', 'occupation',
  'citizenship', 'validUntil',
];

function cleanLine(value) {
  return String(value || '')
    .replace(/[\u00a0\t\f]+/g, ' ')
    .replace(/[¦]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanValue(value) {
  return cleanLine(value)
    .replace(/^[\s:;=|.,–—-]+/, '')
    .replace(/[\s:;|,–—-]+$/, '')
    .trim();
}

function valueBeforeNextLabel(value) {
  return cleanValue(String(value || '').split(INLINE_LABEL_RE)[0]);
}

function extractLabeledValue(lines, labelPattern) {
  const matcher = new RegExp(`^\\s*(?:${labelPattern})\\s*(?::|=)?\\s*(.*?)\\s*$`, 'i');
  const inlineMatcher = new RegExp(`(?:^|\\s)(?:${labelPattern})\\s*[:=]\\s*(.*?)\\s*$`, 'i');

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(matcher);
    if (!match) continue;

    const inlineValue = valueBeforeNextLabel(match[1]);
    if (inlineValue && !FIELD_START_RE.test(inlineValue)) return inlineValue;

    for (let next = index + 1; next < Math.min(lines.length, index + 3); next += 1) {
      const candidate = cleanValue(lines[next]);
      if (!candidate) continue;
      if (FIELD_START_RE.test(candidate)) break;
      return valueBeforeNextLabel(candidate);
    }
  }

  // Pada banyak foto KTP, OCR menggabungkan label dari dua kolom dalam satu baris.
  for (const line of lines) {
    const match = line.match(inlineMatcher);
    if (!match) continue;
    const value = valueBeforeNextLabel(match[1]);
    if (value && !FIELD_START_RE.test(value)) return value;
  }

  return '';
}

function normalizeNikCharacters(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[OQD]/g, '0')
    .replace(/[IL|!]/g, '1')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/G/g, '6')
    .replace(/T/g, '7');
}

function hasPlausibleNikDate(nik) {
  if (!/^\d{16}$/.test(nik)) return false;
  const dayCode = Number(nik.slice(6, 8));
  const day = dayCode > 40 ? dayCode - 40 : dayCode;
  const month = Number(nik.slice(8, 10));
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

function findNikInText(value) {
  const numericLikeRuns = String(value || '').match(/[0-9OQIL|!ZSBGT](?:[0-9OQIL|!ZSBGT\s.,-]{12,}[0-9OQIL|!ZSBGT])/gi) || [];
  const matches = [];
  for (const run of numericLikeRuns) {
    const compact = run.replace(/[\s.,-]/g, '');
    // Require a contiguous OCR run made of digits or common digit confusions;
    // never concatenate arbitrary letters from a sentence into a fake NIK.
    if (compact.length < 16 || compact.length > 22) continue;
    const normalized = normalizeNikCharacters(compact).replace(/[^\d]/g, '');
    for (let start = 0; start <= normalized.length - 16; start += 1) {
      const digits = normalized.slice(start, start + 16);
      if (/^\d{16}$/.test(digits)) matches.push(digits);
    }
  }
  matches.sort((left, right) => Number(hasPlausibleNikDate(right)) - Number(hasPlausibleNikDate(left)));
  return matches[0] || '';
}

function extractNik(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const label = line.match(NIK_LABEL_RE);
    if (!label) continue;

    const remainder = line.slice(label.index + label[0].length);
    const scope = [valueBeforeNextLabel(remainder)];
    for (let next = index + 1; next < Math.min(lines.length, index + 3); next += 1) {
      const candidate = cleanValue(lines[next]);
      if (!candidate) continue;
      if (FIELD_START_RE.test(candidate)) break;
      scope.push(valueBeforeNextLabel(candidate));
    }
    const nik = findNikInText(scope.join(' '));
    if (nik) return nik;
  }

  // Cadangan untuk hasil OCR yang melewatkan label NIK tetapi menangkap blok 16 digit.
  for (const line of lines) {
    const nik = findNikInText(line);
    if (nik) return nik;
  }
  return '';
}

function normalizeDateDigits(value) {
  return String(value || '')
    .replace(/[OoQq]/g, '0')
    .replace(/[Il|!]/g, '1');
}

function normalizeYear(yearText) {
  if (yearText.length !== 2) return yearText.padStart(4, '0');
  const year = Number(yearText);
  return year <= 30 ? `20${yearText}` : `19${yearText}`;
}

function formatDate(dayText, monthText, yearText) {
  const day = Number(dayText);
  const month = Number(monthText);
  const year = normalizeYear(normalizeDateDigits(yearText));
  if (!Number.isFinite(day) || !Number.isFinite(month) || day < 1 || day > 31 || month < 1 || month > 12) return '';
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
}

const MONTHS = {
  JAN: 1, JANUARI: 1, FEB: 2, FEBRUARI: 2, MAR: 3, MARET: 3, APR: 4, APRIL: 4,
  MEI: 5, MAY: 5, JUN: 6, JUNI: 6, JUL: 7, JULI: 7, AGU: 8, AGUSTUS: 8,
  SEP: 9, SEPT: 9, SEPTEMBER: 9, OKT: 10, OKTOBER: 10, NOV: 11, NOVEMBER: 11,
  DES: 12, DESEMBER: 12,
};

function parsePlaceAndDate(value) {
  const text = cleanValue(value);
  const numericText = normalizeDateDigits(text);
  const numericMatch = numericText.match(/(?<!\d)(\d{1,2})\s*[./\-\s]\s*(\d{1,2})\s*[./\-\s]\s*(\d{2,4})(?!\d)/);
  if (numericMatch) {
    const birthDate = formatDate(numericMatch[1], numericMatch[2], numericMatch[3]);
    if (birthDate) {
      const place = cleanValue(text.slice(0, numericMatch.index));
      return { placeOfBirth: place.replace(/[,/\s]+$/, ''), birthDate };
    }
  }

  const monthNames = Object.keys(MONTHS).sort((left, right) => right.length - left.length).join('|');
  const monthFirst = new RegExp(`(?<![A-Z])(${monthNames})\\s+(\\d{1,2})(?:,)?\\s+(\\d{2,4})(?!\\d)`, 'i');
  const dayFirst = new RegExp(`(?<!\\d)(\\d{1,2})\\s+(${monthNames})\\s+(\\d{2,4})(?!\\d)`, 'i');
  const monthMatch = text.match(dayFirst) || text.match(monthFirst);
  if (monthMatch) {
    const isDayFirst = Boolean(text.match(dayFirst));
    const day = isDayFirst ? monthMatch[1] : monthMatch[2];
    const monthName = isDayFirst ? monthMatch[2] : monthMatch[1];
    const year = monthMatch[3];
    const birthDate = formatDate(day, MONTHS[monthName.toUpperCase()], year);
    const place = cleanValue(text.slice(0, monthMatch.index));
    return { placeOfBirth: place.replace(/[,/\s]+$/, ''), birthDate };
  }

  return { placeOfBirth: text, birthDate: '' };
}

function findHeaderValue(lines, prefix) {
  const matcher = new RegExp(`^\\s*${prefix}\\s*[:=]?\\s*(.*?)\\s*$`, 'i');
  for (const line of lines.slice(0, 8)) {
    const match = line.match(matcher);
    if (match?.[1]) return cleanValue(valueBeforeNextLabel(match[1]));
  }
  return '';
}

function extractFallbackName(lines) {
  const nikIndex = lines.findIndex((line) => NIK_LABEL_RE.test(line));
  const birthIndex = lines.findIndex((line) => /TEMPAT\s*\/?\s*TGL?\.?\s*LAHIR|TEMPAT\s+LAHIR/i.test(line));
  const start = nikIndex >= 0 ? nikIndex + 1 : 0;
  const end = birthIndex > start ? birthIndex : Math.min(lines.length, start + 5);

  for (let index = start; index < end; index += 1) {
    let candidate = cleanValue(lines[index]);
    if (NIK_LABEL_RE.test(candidate)) candidate = candidate.replace(NIK_LABEL_RE, '').trim();
    candidate = valueBeforeNextLabel(candidate);
    if (!candidate || FIELD_START_RE.test(candidate) || /\d/.test(candidate)) continue;
    if (!/[A-ZÀ-ÖØ-Þ]{2}/i.test(candidate)) continue;
    const words = candidate.split(/\s+/).filter(Boolean);
    if (words.length > 6 || candidate.length > 60) continue;
    if (/^(?:PROVINSI|KABUPATEN|KOTA|INDONESIA|REPUBLIK|NIK|NAMA)$/i.test(candidate)) continue;
    return candidate;
  }
  return '';
}

/** Parse common Indonesian KTP fields. OCR values remain suggestions and must be checked. */
export function extractKtpFields(rawText) {
  const text = String(rawText || '').replace(/\r/g, '\n').replace(/[\u00a0\t]+/g, ' ');
  const lines = text.split('\n').map(cleanLine).filter(Boolean);
  const joined = lines.join('\n');
  const birthValue = extractLabeledValue(lines, 'TEMPAT\\s*/?\\s*TGL?\\.?\\s*LAHIR|TEMPAT\\s+LAHIR');
  const birth = parsePlaceAndDate(birthValue);

  const genderMatch = joined.match(/JENIS\s*KELAMIN\s*[:=]?\s*(LAKI\s*[-–—]?\s*LAKI|PEREMPUAN|WANITA|PRIA)/i);
  const genderValue = genderMatch?.[1] || '';
  const gender = /PEREMPUAN|WANITA/i.test(genderValue)
    ? 'PEREMPUAN'
    : /LAKI|PRIA/i.test(genderValue)
      ? 'LAKI-LAKI'
      : '';

  const bloodMatch = joined.match(/GOL(?:ONGAN)?\s*\.?\s*DARAH\s*[:=]?\s*(AB|A|B|O|\-)(?![A-Z])/i);
  const rtRwMatch = joined.match(/RT\s*[/|]?\s*RW\s*[:=]?\s*(\d{1,3}\s*[/|]\s*\d{1,3})/i)
    || joined.match(/\b(\d{1,3}\s*[/]\s*\d{1,3})\b/);

  const cityHeader = findHeaderValue(lines, '(?:KAB(?:UPATEN)?(?:\\s*/\\s*KOTA|\\s+KOTA)?|KOTA)');
  const province = findHeaderValue(lines, 'PROVINSI');
  const city = cityHeader.replace(/^(?:KABUPATEN|KAB\.?|KOTA)\s*/i, '');
  const name = extractLabeledValue(lines, 'NAMA(?:\\s+LENGKAP)?|N4MA(?:\\s+LENGKAP)?');

  return {
    nik: extractNik(lines),
    name: name || extractFallbackName(lines),
    placeOfBirth: birth.placeOfBirth,
    birthDate: birth.birthDate,
    gender,
    bloodType: bloodMatch?.[1]?.toUpperCase() || '',
    address: extractLabeledValue(lines, 'ALAMAT').replace(/\s+RT\s*[/|]?\s*RW\b.*$/i, '').trim(),
    rtRw: rtRwMatch?.[1]?.replace(/\s+/g, '')?.replace('|', '/') || '',
    village: extractLabeledValue(lines, '(?:KEL(?:URAHAN)?\\s*/\\s*DESA|DESA\\s*/\\s*KEL(?:URAHAN)?|KEL(?:URAHAN)?|DESA)'),
    district: extractLabeledValue(lines, 'KECAMATAN'),
    city,
    province,
    religion: extractLabeledValue(lines, 'AGAMA'),
    maritalStatus: extractLabeledValue(lines, 'STATUS\\s+PERKAWINAN'),
    occupation: extractLabeledValue(lines, 'PEKERJAAN'),
    citizenship: extractLabeledValue(lines, 'KEWARGANEGARAAN'),
    validUntil: extractLabeledValue(lines, 'BERLAKU\\s+HINGGA'),
  };
}

const FIELD_WEIGHTS = {
  nik: 3.0,
  name: 3.0,
  birthDate: 1.7,
  address: 1.7,
  placeOfBirth: 1.3,
  gender: 1.1,
  rtRw: 1.0,
  village: 1.0,
  district: 1.0,
  city: 1.0,
  province: 1.0,
  bloodType: 0.6,
  religion: 0.6,
  maritalStatus: 0.6,
  occupation: 0.6,
  citizenship: 0.5,
  validUntil: 0.3,
};

function qualityForField(key, value) {
  const text = cleanValue(value);
  if (!text) return 0;
  if (key === 'nik') return /^\d{16}$/.test(text) ? (hasPlausibleNikDate(text) ? 1 : 0.78) : 0.1;
  if (key === 'name') {
    if (text.length < 3 || text.length > 60 || /\d/.test(text) || FIELD_START_RE.test(text)) return 0.15;
    return /[A-ZÀ-ÖØ-Þ]{2}/i.test(text) ? 1 : 0.3;
  }
  if (key === 'birthDate') return /^\d{2}-\d{2}-\d{4}$/.test(text) ? 1 : 0.25;
  if (key === 'gender') return /^(?:LAKI-LAKI|PEREMPUAN)$/i.test(text) ? 1 : 0.6;
  return Math.min(1, text.length / (key === 'address' ? 10 : 4));
}

/** Rank OCR output by field completeness and structural plausibility; this is not an accuracy guarantee. */
export function scoreKtpFields(fields = {}, ocrConfidence = 0) {
  const totalWeight = Object.values(FIELD_WEIGHTS).reduce((total, weight) => total + weight, 0);
  const contentScore = FIELD_KEYS.reduce((score, key) => score + FIELD_WEIGHTS[key] * qualityForField(key, fields[key]), 0) / totalWeight;
  const normalizedConfidence = Math.max(0, Math.min(100, Number(ocrConfidence) || 0)) / 100;
  return Math.round((contentScore * 0.78 + normalizedConfidence * 0.22) * 100);
}

/** Combine a few OCR passes, preferring complete/valid values without discarding useful fields. */
export function mergeKtpCandidates(candidates = []) {
  const ranked = (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => {
      const fields = candidate.fields || extractKtpFields(candidate.text || '');
      const confidence = Math.max(0, Math.min(100, Number(candidate.confidence) || 0));
      return { fields, confidence, score: scoreKtpFields(fields, confidence) };
    })
    .sort((left, right) => right.score - left.score);

  if (!ranked.length) {
    return { fields: extractKtpFields(''), confidence: 0, score: 0, fieldsFound: 0, conflicts: [] };
  }

  const merged = {};
  const conflicts = [];
  for (const key of FIELD_KEYS) {
    const options = ranked
      .filter((candidate) => cleanValue(candidate.fields[key]))
      .map((candidate) => ({
        value: cleanValue(candidate.fields[key]),
        score: qualityForField(key, candidate.fields[key]) * 72 + candidate.confidence * 0.18 + candidate.score * 0.1,
      }))
      .sort((left, right) => right.score - left.score);
    if (!options.length) {
      merged[key] = '';
      continue;
    }
    merged[key] = options[0].value;
    if (options.length > 1 && options[0].value.toLocaleUpperCase('id') !== options[1].value.toLocaleUpperCase('id')) {
      conflicts.push(key);
    }
  }

  const top = ranked[0];
  const fieldsFound = FIELD_KEYS.filter((key) => cleanValue(merged[key])).length;
  return {
    fields: merged,
    confidence: Math.round(ranked.reduce((sum, item) => sum + item.confidence, 0) / ranked.length),
    score: scoreKtpFields(merged, top.confidence),
    fieldsFound,
    conflicts,
  };
}
