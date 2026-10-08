const FIELD_LABELS = [
  'NIK',
  'NAMA(?:\\s+LENGKAP)?',
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

function cleanLine(value) {
  return String(value || '')
    .replace(/[\u00a0\t]+/g, ' ')
    .replace(/[|¦]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanValue(value) {
  return cleanLine(value)
    .replace(/^[\s:;=|.,–—-]+/, '')
    .replace(/[\s:;|,–—-]+$/, '')
    .trim();
}

function extractLabeledValue(lines, labelPattern) {
  const matcher = new RegExp(`^\\s*(?:${labelPattern})\\s*(?::|=)?\\s*(.*?)\\s*$`, 'i');
  const inlineMatcher = new RegExp(`(?:^|\\s)(?:${labelPattern})\\s*[:=]\\s*(.*?)\\s*$`, 'i');

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(matcher);
    if (!match) continue;

    const inlineValue = cleanValue((match[1] || '').split(INLINE_LABEL_RE)[0]);
    if (inlineValue && !FIELD_START_RE.test(inlineValue)) return inlineValue;

    for (let next = i + 1; next < Math.min(lines.length, i + 3); next += 1) {
      const candidate = cleanValue(lines[next]);
      if (!candidate) continue;
      if (FIELD_START_RE.test(candidate)) break;
      return cleanValue(candidate.split(INLINE_LABEL_RE)[0]);
    }
  }

  // KTP sering mencetak dua kolom yang OCR-nya menyatukan beberapa label dalam satu baris.
  for (const line of lines) {
    const match = line.match(inlineMatcher);
    if (!match) continue;
    const value = cleanValue((match[1] || '').split(INLINE_LABEL_RE)[0]);
    if (value && !FIELD_START_RE.test(value)) return value;
  }

  return '';
}

function normalizeDigitText(value) {
  return String(value || '')
    .replace(/[OoQq]/g, '0')
    .replace(/[Il|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');
}

function extractNik(lines) {
  const nikLabel = /\bN\s*\.?\s*[I1l|]\s*\.?\s*K\b/i;

  for (let i = 0; i < lines.length; i += 1) {
    if (!nikLabel.test(lines[i])) continue;

    const scope = [lines[i].replace(nikLabel, ' ' )];
    for (let next = i + 1; next < Math.min(lines.length, i + 3); next += 1) {
      if (FIELD_START_RE.test(cleanLine(lines[next]))) break;
      scope.push(lines[next]);
    }

    const digits = normalizeDigitText(scope.join(' ')).replace(/\D/g, '');
    if (digits.length >= 16) return digits.slice(0, 16);
  }

  // Fallback untuk OCR yang tidak mengenali label NIK, tetapi menemukan blok 16 digit.
  for (const line of lines) {
    const runs = normalizeDigitText(line).match(/\d[\d\s.-]{14,}\d/g) || [];
    for (const run of runs) {
      const digits = run.replace(/\D/g, '');
      if (digits.length === 16) return digits;
      if (digits.length > 16) return digits.slice(0, 16);
    }
  }

  return '';
}

function parsePlaceAndDate(value) {
  const text = cleanValue(value);
  const dateMatch = text.match(/(?:^|[^\d])(\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4})(?:$|[^\d])/);
  if (!dateMatch) return { placeOfBirth: text, birthDate: '' };

  const dateText = dateMatch[1].replace(/\s+/g, '').replace(/[./]/g, '-');
  const start = dateMatch.index + (dateMatch[0].length - dateMatch[1].length) / 2;
  const place = cleanValue(text.slice(0, start));

  return {
    placeOfBirth: place.replace(/[,/\s]+$/, ''),
    birthDate: dateText,
  };
}

function findHeaderValue(lines, prefix) {
  const matcher = new RegExp(`^\\s*${prefix}\\s*[:=]?\\s*(.*?)\\s*$`, 'i');
  for (const line of lines.slice(0, 6)) {
    const match = line.match(matcher);
    if (match?.[1]) return cleanValue(match[1]);
  }
  return '';
}

/** Parse the common Indonesian KTP fields from OCR text. Values are suggestions and must be reviewed. */
export function extractKtpFields(rawText) {
  const lines = String(rawText || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);
  const joined = lines.join('\n');
  const birth = parsePlaceAndDate(
    extractLabeledValue(lines, 'TEMPAT\\s*/?\\s*TGL?\\.?\\s*LAHIR|TEMPAT\\s+LAHIR')
  );

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

  return {
    nik: extractNik(lines),
    name: extractLabeledValue(lines, 'NAMA(?:\\s+LENGKAP)?'),
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
