'use client';

import { useEffect, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { useToast } from '@/context/ToastContext';
import { extractKtpFields } from '@/lib/ktpOcr.mjs';

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

const SIM_TYPES = [
  ['SIM A', 'Mobil perseorangan'],
  ['SIM A Umum', 'Mobil umum'],
  ['SIM B I', 'Kendaraan bermotor berat'],
  ['SIM B I Umum', 'Kendaraan umum golongan B I'],
  ['SIM B II', 'Kendaraan penarik / dengan gandengan'],
  ['SIM B II Umum', 'Kendaraan umum golongan B II'],
  ['SIM C', 'Sepeda motor'],
  ['SIM C I', 'Sepeda motor golongan C I'],
  ['SIM C II', 'Sepeda motor golongan C II'],
  ['SIM D', 'Kendaraan khusus penyandang disabilitas'],
  ['SIM D I', 'Kendaraan khusus golongan D I'],
  ['SIM Internasional', 'Permohonan SIM Internasional'],
  ['Lainnya', 'Golongan lain (jelaskan di catatan)'],
];

const APPLICATION_TYPES = [
  'Pembuatan baru',
  'Perpanjangan',
  'Peningkatan golongan',
  'Penggantian hilang / rusak',
  'Perubahan data',
  'Lainnya',
];

const EMPTY_FORM = {
  name: '',
  nik: '',
  placeOfBirth: '',
  birthDate: '',
  gender: '',
  bloodType: '',
  address: '',
  rtRw: '',
  village: '',
  district: '',
  city: '',
  province: '',
  religion: '',
  maritalStatus: '',
  occupation: '',
  citizenship: '',
  validUntil: '',
  simType: '',
  otherSim: '',
  applicationType: 'Pembuatan baru',
  satpas: '',
  applicationDate: '',
  phone: '',
  email: '',
  notes: '',
};

const KTP_FIELDS = [
  'name', 'nik', 'placeOfBirth', 'birthDate', 'gender', 'bloodType', 'address', 'rtRw',
  'village', 'district', 'city', 'province', 'religion', 'maritalStatus', 'occupation',
  'citizenship', 'validUntil',
];

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return 'Belum diisi';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function maskNik(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : 'Belum diisi';
}

function getChecklist(applicationType) {
  const checklist = [
    'Cocokkan seluruh data dengan e-KTP asli dan koreksi kemungkinan salah baca OCR.',
    'Konfirmasi persyaratan, jadwal, alur, dan biaya terbaru kepada Satpas / layanan resmi.',
    'Bawa dokumen asli dan berkas pendukung yang diminta oleh layanan resmi.',
  ];

  if (applicationType === 'Perpanjangan') {
    checklist.push('Periksa masa berlaku SIM lama dan tanyakan prosedur jika masa berlaku sudah terlewat.');
  } else if (applicationType === 'Penggantian hilang / rusak') {
    checklist.push('Tanyakan dokumen pendukung penggantian kepada Satpas sebelum datang.');
  } else if (applicationType === 'Peningkatan golongan') {
    checklist.push('Pastikan syarat peningkatan golongan dan pengalaman mengemudi sesuai ketentuan terkini.');
  } else {
    checklist.push('Ikuti pemeriksaan dan tahapan ujian yang ditetapkan oleh petugas resmi.');
  }

  return checklist;
}

function displayValue(value) {
  return String(value || '').trim() || 'Belum diisi';
}

function FormField({ id, label, value, onChange, placeholder = '', type = 'text', inputMode, maxLength, hint, children, className = '' }) {
  return (
    <div className={`sim-field${className ? ` ${className}` : ''}`}>
      <label className="label" htmlFor={id}>{label}</label>
      {children || (
        <input
          id={id}
          className="input"
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
        />
      )}
      {hint ? <p id={`${id}-hint`} className="hint">{hint}</p> : null}
    </div>
  );
}

function DocumentField({ label, value, sensitive = false, revealSensitive = false, wide = false }) {
  return (
    <div className={`sim-doc-field${wide ? ' sim-doc-field-wide' : ''}`}>
      <span>{label}</span>
      <strong>
        {sensitive ? (
          <>
            <span className="sim-screen-only">{revealSensitive ? displayValue(value) : maskNik(value)}</span>
            <span className="sim-print-only">{displayValue(value)}</span>
          </>
        ) : displayValue(value)}
      </strong>
    </div>
  );
}

function statusText(status) {
  if (status.includes('core')) return 'Menyiapkan mesin OCR di perangkat…';
  if (status.includes('language') || status.includes('traineddata')) return 'Memuat model bahasa Indonesia…';
  if (status.includes('recogniz')) return 'Membaca tulisan pada KTP…';
  if (status.includes('initializ')) return 'Menyiapkan pemindaian…';
  return 'Memproses gambar secara lokal…';
}

export default function SimApplicationPage() {
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [previewUrl, setPreviewUrl] = useState('');
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [ocrMessage, setOcrMessage] = useState('');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [detectedFields, setDetectedFields] = useState([]);
  const [showNik, setShowNik] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef('');
  const recognitionRef = useRef({ id: 0, worker: null });

  useEffect(() => {
    setForm((current) => current.applicationDate ? current : { ...current, applicationDate: todayLocal() });
  }, []);

  useEffect(() => () => {
    recognitionRef.current.id += 1;
    const worker = recognitionRef.current.worker;
    recognitionRef.current.worker = null;
    if (worker) Promise.resolve(worker.terminate()).catch(() => {});
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const stopRecognition = () => {
    recognitionRef.current.id += 1;
    const worker = recognitionRef.current.worker;
    recognitionRef.current.worker = null;
    if (worker) Promise.resolve(worker.terminate()).catch(() => {});
  };

  const recognizeKtp = async (file) => {
    const jobId = ++recognitionRef.current.id;
    setOcrStatus('working');
    setOcrMessage('Menyiapkan pemindaian di perangkat…');
    setOcrProgress(0);
    setOcrConfidence(null);
    setDetectedFields([]);

    let worker;
    try {
      const { createWorker, OEM } = await import('tesseract.js');
      worker = await createWorker('ind', OEM.LSTM_ONLY, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr',
        langPath: '/ocr',
        gzip: true,
        cacheMethod: 'write',
        workerBlobURL: false,
        logger: (message) => {
          if (recognitionRef.current.id !== jobId) return;
          setOcrMessage(statusText(String(message.status || '')));
          setOcrProgress(Math.max(0, Math.min(100, Math.round((message.progress || 0) * 100))));
        },
      });

      if (recognitionRef.current.id !== jobId) {
        await worker.terminate();
        worker = null;
        return;
      }

      recognitionRef.current.worker = worker;
      const result = await worker.recognize(file);
      if (recognitionRef.current.id !== jobId) return;

      const parsed = extractKtpFields(result?.data?.text || '');
      const found = KTP_FIELDS.filter((key) => String(parsed[key] || '').trim());
      setForm((current) => {
        const next = { ...current };
        for (const key of KTP_FIELDS) {
          if (String(parsed[key] || '').trim()) next[key] = parsed[key];
        }
        return next;
      });
      setDetectedFields(found);
      setOcrConfidence(Number.isFinite(result?.data?.confidence) ? Math.round(result.data.confidence) : null);
      setOcrStatus('done');
      setOcrMessage(found.length
        ? `Pemindaian selesai. ${found.length} bagian terdeteksi — mohon periksa dan koreksi.`
        : 'Teks belum terbaca jelas. Coba foto yang lebih terang atau isi data secara manual.');
      if (found.length) addToast('Data KTP terbaca. Periksa lagi sebelum mencetak.', 'success');
      else addToast('Belum ada data yang terbaca. Kamu tetap bisa isi manual.', 'warning');
    } catch {
      if (recognitionRef.current.id !== jobId) return;
      setOcrStatus('error');
      setOcrMessage('Pemindaian gagal. Coba lagi dengan foto yang lebih jelas, atau isi data secara manual.');
      addToast('OCR gagal dijalankan. Data bisa diisi manual.', 'error');
    } finally {
      if (worker && recognitionRef.current.worker === worker) {
        recognitionRef.current.worker = null;
        await Promise.resolve(worker.terminate()).catch(() => {});
      }
    }
  };

  const chooseFile = (file) => {
    if (!file) return;
    const allowedImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      || /\.(?:jpe?g|png|webp)$/i.test(file.name || '');
    if (!allowedImage) {
      addToast('Pilih foto KTP berformat JPG, PNG, atau WebP.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      addToast('Ukuran foto maksimal 15 MB.', 'error');
      return;
    }

    stopRecognition();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    setOcrStatus('idle');
    setOcrMessage('');
    setForm((current) => {
      const next = { ...current };
      for (const key of KTP_FIELDS) next[key] = '';
      return next;
    });
    setShowNik(false);
    recognizeKtp(file);
  };

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    chooseFile(file);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const clearData = () => {
    stopRecognition();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setPreviewUrl('');
    setForm({ ...EMPTY_FORM, applicationDate: todayLocal() });
    setOcrStatus('idle');
    setOcrMessage('');
    setOcrProgress(0);
    setOcrConfidence(null);
    setDetectedFields([]);
    setShowNik(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    addToast('Data pemohon dan foto dihapus dari halaman.', 'success');
  };

  const selectedSim = SIM_TYPES.find(([value]) => value === form.simType);
  const selectedSimLabel = selectedSim
    ? `${selectedSim[0]} — ${selectedSim[0] === 'Lainnya' ? (form.otherSim || 'Golongan lain') : selectedSim[1]}`
    : '';
  const checklist = getChecklist(form.applicationType);
  const nikIsValid = /^\d{16}$/.test(String(form.nik || '').replace(/\D/g, ''));
  const simChoiceIsComplete = Boolean(form.simType && (form.simType !== 'Lainnya' || form.otherSim.trim()));
  const canPrint = Boolean(form.name.trim() && nikIsValid && simChoiceIsComplete);

  const printDocument = () => {
    if (!form.name.trim()) {
      addToast('Isi nama pemohon terlebih dahulu.', 'warning');
      return;
    }
    if (!nikIsValid) {
      addToast('NIK harus berisi 16 digit. Periksa hasil OCR atau isi manual.', 'warning');
      return;
    }
    if (!form.simType) {
      addToast('Pilih golongan SIM yang akan diajukan.', 'warning');
      return;
    }
    if (form.simType === 'Lainnya' && !form.otherSim.trim()) {
      addToast('Jelaskan golongan SIM yang dimaksud.', 'warning');
      return;
    }
    window.print();
  };

  return (
    <ToolShell
      title="Berkas Persiapan SIM"
      desc="Unggah foto KTP untuk membaca data otomatis, koreksi hasilnya, lalu cetak lembar persiapan pribadi."
      icon="fingerprint"
      className="sim-tool-shell"
    >
      <div className="sim-workspace">
        <div className="sim-form-column">
          <section className="panel sim-panel" aria-labelledby="sim-upload-title">
            <div className="sim-privacy-note">
              <span className="sim-privacy-icon"><Icon name="lock" size={17} /></span>
              <p><strong>Privasi:</strong> foto KTP dan data diproses di browser ini, tidak diunggah ke server dan tidak disimpan. Segarkan halaman atau tekan “Hapus data” untuk membersihkan.</p>
            </div>

            <div className="sim-section-heading">
              <span className="sim-step">01</span>
              <div>
                <h2 id="sim-upload-title">Baca data KTP</h2>
                <p>OCR otomatis berjalan setelah foto dipilih.</p>
              </div>
            </div>

            <label
              className={`dropzone sim-dropzone${isDragging ? ' is-dragging' : ''}`}
              htmlFor="sim-ktp-upload"
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                id="sim-ktp-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFileChange}
                aria-label="Unggah foto KTP"
              />
              <span className="sim-upload-icon"><Icon name="image" size={27} /></span>
              <strong>{previewUrl ? 'Pilih foto lain' : 'Klik untuk unggah atau tarik foto ke sini'}</strong>
              <span>Foto KTP · JPG, PNG, WebP · Maksimal 15 MB</span>
            </label>

            {previewUrl ? (
              <div className="sim-image-preview-wrap">
                <img className="sim-image-preview" src={previewUrl} alt="Pratinjau foto KTP yang hanya tersimpan di browser" />
                <div className="sim-image-caption">
                  <Icon name="lock" size={14} />
                  <span>Pratinjau lokal. Foto tidak ikut dimasukkan ke dokumen.</span>
                </div>
              </div>
            ) : null}

            {ocrStatus === 'working' ? (
              <div className="sim-ocr-status" role="status" aria-live="polite">
                <div className="sim-ocr-status-line">
                  <span className="sim-spinner" aria-hidden="true" />
                  <span>{ocrMessage || 'Memproses foto…'}</span>
                </div>
                <div className="meter" aria-label={`Progres pemindaian ${ocrProgress}%`}>
                  <i style={{ width: `${ocrProgress}%`, background: 'var(--accent)' }} />
                </div>
                <button type="button" className="btn btn-ghost btn-sm sim-cancel-button" onClick={() => {
                  stopRecognition();
                  setOcrStatus('idle');
                  setOcrMessage('Pemindaian dibatalkan. Data bisa diisi manual.');
                }}>Batalkan scan</button>
              </div>
            ) : null}

            {ocrStatus === 'done' || ocrStatus === 'error' ? (
              <div className={`sim-ocr-result ${ocrStatus === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">
                <span className="sim-ocr-result-icon"><Icon name={ocrStatus === 'error' ? 'warning' : 'check'} size={16} /></span>
                <div>
                  <strong>{ocrMessage}</strong>
                  {ocrStatus === 'done' && detectedFields.length ? (
                    <p>{detectedFields.length} bagian terbaca{ocrConfidence !== null ? ` · skor OCR ${ocrConfidence}% (bukan jaminan akurasi)` : ''}.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="sim-section-heading sim-form-heading">
              <span className="sim-step">02</span>
              <div>
                <h2>Periksa & lengkapi data</h2>
                <p>Hasil OCR hanyalah saran. Cocokkan dengan KTP asli sebelum mencetak.</p>
              </div>
            </div>

            <div className="sim-form-section">
              <h3>Identitas pemohon</h3>
              <div className="sim-form-grid">
                <FormField id="sim-name" label="Nama lengkap" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Sesuai KTP" className="sim-field-wide" />
                <FormField id="sim-nik" label="NIK (16 digit)" value={form.nik} onChange={(e) => setField('nik', e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="Masukkan 16 digit" type={showNik ? 'text' : 'password'} inputMode="numeric" maxLength={16} hint={`${String(form.nik || '').replace(/\D/g, '').length}/16 digit · data disembunyikan di pratinjau`}>
                  <div className="sim-nik-control">
                    <input
                      id="sim-nik"
                      className="input"
                      type={showNik ? 'text' : 'password'}
                      inputMode="numeric"
                      value={form.nik}
                      onChange={(e) => setField('nik', e.target.value.replace(/\D/g, '').slice(0, 16))}
                      placeholder="Masukkan 16 digit"
                      maxLength={16}
                      autoComplete="off"
                      aria-describedby="sim-nik-hint"
                    />
                    <button type="button" className="sim-reveal-button" onClick={() => setShowNik((visible) => !visible)} aria-label={showNik ? 'Sembunyikan NIK' : 'Tampilkan NIK'} title={showNik ? 'Sembunyikan NIK' : 'Tampilkan NIK'}>
                      <Icon name={showNik ? 'eyeOff' : 'eye'} size={17} />
                    </button>
                  </div>
                </FormField>
                <FormField id="sim-birth-place" label="Tempat lahir" value={form.placeOfBirth} onChange={(e) => setField('placeOfBirth', e.target.value)} placeholder="Kota kelahiran" />
                <FormField id="sim-birth-date" label="Tanggal lahir" value={form.birthDate} onChange={(e) => setField('birthDate', e.target.value)} placeholder="DD-MM-YYYY" />
                <FormField id="sim-gender" label="Jenis kelamin" value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
                  <select id="sim-gender" className="select" value={form.gender} onChange={(e) => setField('gender', e.target.value)}>
                    <option value="">Pilih jenis kelamin</option>
                    <option value="LAKI-LAKI">Laki-laki</option>
                    <option value="PEREMPUAN">Perempuan</option>
                  </select>
                </FormField>
                <FormField id="sim-blood" label="Golongan darah" value={form.bloodType} onChange={(e) => setField('bloodType', e.target.value)}>
                  <select id="sim-blood" className="select" value={form.bloodType} onChange={(e) => setField('bloodType', e.target.value)}>
                    <option value="">Tidak dicantumkan</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                    <option value="-">Tidak diketahui</option>
                  </select>
                </FormField>
                <FormField id="sim-religion" label="Agama" value={form.religion} onChange={(e) => setField('religion', e.target.value)} placeholder="Opsional" />
                <FormField id="sim-marital" label="Status perkawinan" value={form.maritalStatus} onChange={(e) => setField('maritalStatus', e.target.value)} placeholder="Opsional" />
                <FormField id="sim-occupation" label="Pekerjaan" value={form.occupation} onChange={(e) => setField('occupation', e.target.value)} placeholder="Opsional" />
                <FormField id="sim-citizenship" label="Kewarganegaraan" value={form.citizenship} onChange={(e) => setField('citizenship', e.target.value)} placeholder="Contoh: WNI" />
                <FormField id="sim-valid-until" label="Masa berlaku KTP" value={form.validUntil} onChange={(e) => setField('validUntil', e.target.value)} placeholder="Opsional" className="sim-field-wide" />
              </div>
            </div>

            <div className="sim-form-section">
              <h3>Alamat sesuai KTP</h3>
              <div className="sim-form-grid">
                <FormField id="sim-address" label="Alamat" value={form.address} onChange={(e) => setField('address', e.target.value)} className="sim-field-wide">
                  <textarea id="sim-address" className="textarea sim-short-textarea" value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Jalan, nomor rumah, dan keterangan alamat" />
                </FormField>
                <FormField id="sim-rtrw" label="RT / RW" value={form.rtRw} onChange={(e) => setField('rtRw', e.target.value)} placeholder="000/000" />
                <FormField id="sim-village" label="Kelurahan / desa" value={form.village} onChange={(e) => setField('village', e.target.value)} placeholder="Opsional" />
                <FormField id="sim-district" label="Kecamatan" value={form.district} onChange={(e) => setField('district', e.target.value)} placeholder="Opsional" />
                <FormField id="sim-city" label="Kabupaten / kota" value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="Opsional" />
                <FormField id="sim-province" label="Provinsi" value={form.province} onChange={(e) => setField('province', e.target.value)} placeholder="Opsional" />
              </div>
            </div>

            <div className="sim-form-section">
              <h3>Detail permohonan</h3>
              <div className="sim-form-grid">
                <FormField id="sim-type" label="Golongan SIM yang diajukan" value={form.simType} onChange={(e) => setField('simType', e.target.value)} className="sim-field-wide">
                  <select id="sim-type" className="select" value={form.simType} onChange={(e) => setField('simType', e.target.value)}>
                    <option value="">Pilih golongan SIM</option>
                    {SIM_TYPES.map(([value, description]) => <option key={value} value={value}>{value} — {description}</option>)}
                  </select>
                </FormField>
                {form.simType === 'Lainnya' ? (
                  <FormField id="sim-other-type" label="Jelaskan golongan SIM" value={form.otherSim} onChange={(e) => setField('otherSim', e.target.value)} placeholder="Tuliskan jenis SIM" className="sim-field-wide" />
                ) : null}
                <FormField id="sim-application-type" label="Jenis permohonan" value={form.applicationType} onChange={(e) => setField('applicationType', e.target.value)} className="sim-field-wide">
                  <select id="sim-application-type" className="select" value={form.applicationType} onChange={(e) => setField('applicationType', e.target.value)}>
                    {APPLICATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </FormField>
                <FormField id="sim-satpas" label="Satpas / lokasi tujuan" value={form.satpas} onChange={(e) => setField('satpas', e.target.value)} placeholder="Kota atau Satpas tujuan" />
                <FormField id="sim-date" label="Tanggal persiapan" type="date" value={form.applicationDate} onChange={(e) => setField('applicationDate', e.target.value)} />
                <FormField id="sim-phone" label="Nomor kontak (opsional)" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="08xx…" inputMode="tel" />
                <FormField id="sim-email" label="Email (opsional)" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="nama@email.com" />
                <FormField id="sim-notes" label="Catatan pribadi" value={form.notes} onChange={(e) => setField('notes', e.target.value)} className="sim-field-wide">
                  <textarea id="sim-notes" className="textarea sim-short-textarea" value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Misalnya catatan atau pertanyaan untuk Satpas" maxLength={500} />
                </FormField>
              </div>
              <p className="hint">Nama golongan hanya untuk membantu menyiapkan catatan. Kelayakan, syarat, dan kategori resmi tetap mengikuti ketentuan terbaru.</p>
            </div>

            <div className="sim-form-footer">
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearData}>
                <Icon name="close" size={14} /> Hapus data
              </button>
              <span>Data hanya berada di memori halaman ini.</span>
            </div>
          </section>
        </div>

        <div className="sim-preview-column">
          <div className="sim-preview-toolbar">
            <div>
              <span className="sim-step">03</span>
              <div>
                <h2>Pratinjau dokumen</h2>
                <p>Perubahan data langsung terlihat di sini.</p>
              </div>
            </div>
            <button type="button" className="btn btn-primary sim-print-button" onClick={printDocument} disabled={!canPrint}>
              <Icon name="fileText" size={16} /> Cetak / Simpan PDF
            </button>
          </div>
          {!canPrint ? <p className="sim-print-hint">Untuk mencetak, lengkapi nama, NIK 16 digit, dan golongan SIM.</p> : null}

          <article className="sim-print-sheet" aria-label="Pratinjau lembar persiapan permohonan SIM">
            <header className="sim-doc-header">
              <div>
                <p className="sim-doc-kicker">CATATAN PRIBADI · DOKUMEN PERSIAPAN</p>
                <h2>Lembar Persiapan<br />Permohonan SIM</h2>
                <p className="sim-doc-subtitle">Ringkasan data untuk diperiksa sebelum mengurus permohonan melalui layanan resmi.</p>
              </div>
              <span className="sim-doc-badge">DRAF<br />PRIBADI</span>
            </header>

            <div className="sim-doc-warning">
              BUKAN SIM · BUKAN IZIN MENGEMUDI · BUKAN FORMULIR RESMI
            </div>

            <div className="sim-doc-meta">
              <DocumentField label="Tanggal persiapan" value={formatDate(form.applicationDate)} />
              <DocumentField label="Jenis permohonan" value={form.applicationType} />
              <DocumentField label="Golongan yang dituju" value={selectedSimLabel} />
              <DocumentField label="Satpas / lokasi tujuan" value={form.satpas} />
            </div>

            <section className="sim-doc-section">
              <h3>01 · IDENTITAS PEMOHON</h3>
              <div className="sim-doc-grid">
                <DocumentField label="Nama lengkap" value={form.name} wide />
                <DocumentField label="NIK" value={form.nik} sensitive revealSensitive={showNik} />
                <DocumentField label="Tempat, tanggal lahir" value={[form.placeOfBirth, form.birthDate].filter(Boolean).join(', ')} />
                <DocumentField label="Jenis kelamin" value={form.gender} />
                <DocumentField label="Golongan darah" value={form.bloodType} />
                <DocumentField label="Agama" value={form.religion} />
                <DocumentField label="Status perkawinan" value={form.maritalStatus} />
                <DocumentField label="Pekerjaan" value={form.occupation} />
                <DocumentField label="Kewarganegaraan" value={form.citizenship} />
                <DocumentField label="Masa berlaku KTP" value={form.validUntil} />
              </div>
            </section>

            <section className="sim-doc-section">
              <h3>02 · ALAMAT SESUAI KTP</h3>
              <div className="sim-doc-grid">
                <DocumentField label="Alamat" value={form.address} wide />
                <DocumentField label="RT / RW" value={form.rtRw} />
                <DocumentField label="Kelurahan / desa" value={form.village} />
                <DocumentField label="Kecamatan" value={form.district} />
                <DocumentField label="Kabupaten / kota" value={form.city} />
                <DocumentField label="Provinsi" value={form.province} />
              </div>
            </section>

            <section className="sim-doc-section">
              <h3>03 · CATATAN PERSIAPAN</h3>
              <ul className="sim-doc-checklist">
                {checklist.map((item) => <li key={item}><span className="sim-checkbox">□</span><span>{item}</span></li>)}
              </ul>
              {(form.phone || form.email) ? (
                <div className="sim-doc-contact">
                  {form.phone ? <DocumentField label="Nomor kontak" value={form.phone} /> : null}
                  {form.email ? <DocumentField label="Email" value={form.email} /> : null}
                </div>
              ) : null}
              {form.notes.trim() ? <div className="sim-doc-notes"><span>Catatan pribadi</span><p>{form.notes}</p></div> : null}
            </section>

            <footer className="sim-doc-footer">
              Hasil OCR wajib dicocokkan dengan dokumen asli. Lembar ini dibuat pengguna sebagai catatan persiapan; bukan bukti pendaftaran, bukan bukti pembayaran, bukan dokumen kepolisian, dan tidak memberi hak untuk mengemudi. SIM yang sah hanya diterbitkan melalui proses resmi.
            </footer>
          </article>

          <div className="sim-reminder">
            <Icon name="info" size={17} />
            <p><strong>Ingat:</strong> dokumen ini hanya lembar persiapan pribadi, bukan SIM atau formulir resmi. Cek persyaratan, alur, dan biaya terkini di Satpas atau kanal resmi Korlantas.</p>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
