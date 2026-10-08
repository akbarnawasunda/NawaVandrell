'use client';

import { useEffect, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { useToast } from '@/context/ToastContext';
import { extractKtpFields } from '@/lib/ktpOcr.mjs';
import {
  createCollectiveExportData,
  exportCollectiveCsv,
  exportCollectiveDocx,
  exportCollectiveJson,
  exportCollectiveXlsx,
} from '@/lib/collectiveSimExports.mjs';

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const MAX_ROSTER = 100;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SIM_TYPES = [
  'SIM A', 'SIM A Umum', 'SIM B I', 'SIM B I Umum', 'SIM B II', 'SIM B II Umum',
  'SIM C', 'SIM C I', 'SIM C II', 'SIM D', 'SIM D I', 'SIM Internasional', 'Lainnya',
];
const EMPTY_KTP = {
  name: '', nik: '', placeOfBirth: '', birthDate: '', gender: '', bloodType: '', address: '', rtRw: '',
  village: '', district: '', city: '', province: '', religion: '', maritalStatus: '', occupation: '',
  citizenship: '', validUntil: '',
};
const DETAIL_FIELDS = [
  ['nik', 'NIK', 'password'],
  ['placeOfBirth', 'Tempat lahir'],
  ['birthDate', 'Tanggal lahir'],
  ['gender', 'Jenis kelamin'],
  ['bloodType', 'Golongan darah'],
  ['rtRw', 'RT / RW'],
  ['village', 'Kelurahan / desa'],
  ['district', 'Kecamatan'],
  ['city', 'Kabupaten / kota'],
  ['province', 'Provinsi'],
  ['religion', 'Agama'],
  ['maritalStatus', 'Status perkawinan'],
  ['occupation', 'Pekerjaan'],
  ['citizenship', 'Kewarganegaraan'],
  ['validUntil', 'Berlaku hingga'],
];

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createPerson({ simType = 'SIM C', note = 'BIKIN BARU', photoData = '', parsed = {} } = {}) {
  return {
    id: makeId(),
    ...EMPTY_KTP,
    ...parsed,
    simType,
    note,
    photoData,
  };
}

function maskNik(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : 'Belum terbaca';
}

function createKtpPreview(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        if (!width || !height || width * height > 45_000_000) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Resolusi gambar terlalu besar untuk diproses di perangkat ini.'));
          return;
        }
        const scale = Math.min(1, 1000 / width, 650 / height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Browser tidak dapat menyiapkan gambar.'));
          return;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Gambar tidak dapat dikompres.'));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.78);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('File gambar tidak dapat dibuka.'));
    };
    image.src = objectUrl;
  });
}

function progressText(status) {
  if (status.includes('core')) return 'Menyiapkan mesin OCR lokal…';
  if (status.includes('language') || status.includes('traineddata')) return 'Memuat model bahasa Indonesia…';
  if (status.includes('recogniz')) return 'Membaca tulisan pada KTP…';
  if (status.includes('initializ')) return 'Menyiapkan pemindaian…';
  return 'Memproses gambar di perangkat…';
}

function DetailInput({ person, field, label, type, visible, onToggleVisibility, onChange }) {
  const inputType = type === 'password' && !visible ? 'password' : 'text';
  return (
    <label className={`sim-detail-field${field === 'address' ? ' sim-detail-field-wide' : ''}`}>
      <span>{label}</span>
      {field === 'address' ? (
        <textarea
          value={person[field] || ''}
          onChange={(event) => onChange(field, event.target.value)}
          rows={2}
          autoComplete="off"
        />
      ) : (
        <span className={field === 'nik' ? 'sim-nik-input-wrap' : undefined}>
          <input
            type={inputType}
            inputMode={field === 'nik' ? 'numeric' : undefined}
            maxLength={field === 'nik' ? 16 : undefined}
            value={person[field] || ''}
            onChange={(event) => onChange(field, field === 'nik' ? event.target.value.replace(/\D/g, '').slice(0, 16) : event.target.value)}
            autoComplete="off"
          />
          {field === 'nik' ? (
            <button type="button" onClick={onToggleVisibility} aria-label={visible ? 'Sembunyikan NIK' : 'Tampilkan NIK'}>
              {visible ? 'Sembunyikan' : 'Lihat'}
            </button>
          ) : null}
        </span>
      )}
    </label>
  );
}

export default function SimCollectiveBuilder() {
  const { addToast } = useToast();
  const [roster, setRoster] = useState([]);
  const [defaultSimType, setDefaultSimType] = useState('SIM C');
  const [defaultNote, setDefaultNote] = useState('BIKIN BARU');
  const [includeNIK, setIncludeNIK] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0, message: '' });
  const [exportingFormat, setExportingFormat] = useState('');
  const [visibleNiks, setVisibleNiks] = useState({});
  const fileInputRef = useRef(null);
  const recognitionRef = useRef({ id: 0, worker: null });

  useEffect(() => () => {
    recognitionRef.current.id += 1;
    const worker = recognitionRef.current.worker;
    recognitionRef.current.worker = null;
    if (worker) Promise.resolve(worker.terminate()).catch(() => {});
  }, []);

  const updatePerson = (id, field, value) => {
    setRoster((current) => current.map((person) => (person.id === id ? { ...person, [field]: value } : person)));
  };

  const handleFiles = async (fileList) => {
    if (processing) return;
    const candidates = Array.from(fileList || []);
    if (!candidates.length) return;

    const validFiles = [];
    const rejected = [];
    for (const file of candidates) {
      const extensionAllowed = /\.(jpe?g|png|webp)$/i.test(file.name || '');
      if (!(ALLOWED_IMAGE_TYPES.has(file.type) || (!file.type && extensionAllowed))) {
        rejected.push(`${file.name || 'File'}: format harus JPG, PNG, atau WebP.`);
      } else if (file.size > MAX_IMAGE_SIZE) {
        rejected.push(`${file.name || 'File'}: ukuran melebihi 15 MB.`);
      } else {
        validFiles.push(file);
      }
    }
    if (rejected.length) addToast(`${rejected.length} file dilewati. ${rejected[0]}`, 'warning', 5200);
    if (!validFiles.length) return;

    const available = Math.max(0, MAX_ROSTER - roster.length);
    if (!available) {
      addToast(`Maksimal ${MAX_ROSTER} orang dalam satu rekap.`, 'warning');
      return;
    }
    const files = validFiles.slice(0, available);
    if (files.length < validFiles.length) {
      addToast(`Hanya ${files.length} dari file terpilih yang ditambahkan agar batas ${MAX_ROSTER} orang tidak terlampaui.`, 'warning', 5200);
    }

    const taskId = ++recognitionRef.current.id;
    setProcessing(true);
    setProgress({ current: 0, total: files.length, percent: 0, message: 'Memuat mesin OCR lokal…' });
    let worker = null;
    let ocrAvailable = true;

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
          if (recognitionRef.current.id !== taskId) return;
          const fileProgress = Math.max(0, Math.min(1, Number(message.progress) || 0));
          setProgress((current) => ({
            ...current,
            percent: Math.round(((current.current + fileProgress) / Math.max(current.total, 1)) * 100),
            message: progressText(String(message.status || '')),
          }));
        },
      });
      if (recognitionRef.current.id !== taskId) {
        await worker.terminate();
        return;
      }
      recognitionRef.current.worker = worker;
    } catch {
      ocrAvailable = false;
      addToast('OCR tidak tersedia saat ini. Foto tetap ditambahkan dan datanya bisa diisi manual.', 'warning', 5200);
    }

    let added = 0;
    let failedPhotos = 0;
    let readCount = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        if (recognitionRef.current.id !== taskId) break;
        const file = files[index];
        setProgress((current) => ({
          ...current,
          current: index,
          percent: Math.round((index / Math.max(current.total, 1)) * 100),
          message: `Menyiapkan foto ${index + 1} dari ${files.length}…`,
        }));

        let photoData = '';
        try {
          photoData = await createKtpPreview(file);
        } catch (error) {
          failedPhotos += 1;
          setProgress((current) => ({ ...current, current: index + 1, message: `Foto ${index + 1} dilewati: ${error.message}` }));
          continue;
        }

        let parsed = {};
        let confidence = null;
        if (worker && ocrAvailable) {
          try {
            const result = await worker.recognize(file);
            if (recognitionRef.current.id !== taskId) break;
            parsed = extractKtpFields(result?.data?.text || '');
            confidence = Number.isFinite(result?.data?.confidence) ? Math.round(result.data.confidence) : null;
            if (Object.values(parsed).some((value) => String(value || '').trim())) readCount += 1;
          } catch {
            // Keep the image as an editable roster row even if this one OCR pass fails.
          }
        }

        if (recognitionRef.current.id !== taskId) break;
        const person = createPerson({ simType: defaultSimType, note: defaultNote, photoData, parsed });
        person.ocrConfidence = confidence;
        setRoster((current) => [...current, person]);
        added += 1;
        setProgress((current) => ({
          ...current,
          current: index + 1,
          percent: Math.round(((index + 1) / Math.max(current.total, 1)) * 100),
          message: `Selesai membaca foto ${index + 1} dari ${files.length}.`,
        }));
      }
      if (recognitionRef.current.id === taskId) {
        if (added) {
          const suffix = ocrAvailable ? ` OCR menemukan data pada ${readCount} KTP.` : ' Isi data secara manual.';
          addToast(`${added} foto KTP ditambahkan ke rekap.${suffix}`, added === files.length ? 'success' : 'warning', 5200);
        } else if (failedPhotos) {
          addToast('Foto tidak dapat diproses. Coba JPG, PNG, atau WebP yang lain.', 'error');
        }
        setProgress((current) => ({ ...current, current: added, percent: 100, message: 'Pemrosesan selesai. Periksa dan koreksi data OCR.' }));
      }
    } finally {
      if (worker) {
        if (recognitionRef.current.worker === worker) recognitionRef.current.worker = null;
        await Promise.resolve(worker.terminate()).catch(() => {});
      }
      if (recognitionRef.current.id === taskId) setProcessing(false);
    }
  };

  const addManualPerson = () => {
    if (roster.length >= MAX_ROSTER) {
      addToast(`Maksimal ${MAX_ROSTER} orang dalam satu rekap.`, 'warning');
      return;
    }
    setRoster((current) => [...current, createPerson({ simType: defaultSimType, note: defaultNote })]);
  };

  const removePerson = (id) => {
    setRoster((current) => current.filter((person) => person.id !== id));
    setVisibleNiks((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const clearRoster = () => {
    if (!roster.length) return;
    if (!window.confirm('Hapus seluruh data dan foto KTP dari rekap ini? Tindakan ini tidak dapat dibatalkan.')) return;
    setRoster([]);
    setProgress({ current: 0, total: 0, percent: 0, message: '' });
    addToast('Rekap dikosongkan dari perangkat ini.', 'success');
  };

  const cancelProcessing = async () => {
    recognitionRef.current.id += 1;
    const worker = recognitionRef.current.worker;
    recognitionRef.current.worker = null;
    if (worker) await Promise.resolve(worker.terminate()).catch(() => {});
    setProcessing(false);
    setProgress((current) => ({ ...current, message: 'Pemrosesan dihentikan. Baris yang sudah selesai tetap tersimpan.' }));
    addToast('Pemindaian dihentikan. Baris yang selesai tetap ada.', 'info');
  };

  const handleExport = async (format) => {
    if (!roster.length) {
      addToast('Tambahkan foto KTP atau baris manual terlebih dahulu.', 'warning');
      return;
    }
    setExportingFormat(format);
    try {
      const exportData = createCollectiveExportData(roster, { includeNIK });
      if (format === 'pdf') {
        window.print();
      } else if (format === 'docx') {
        await exportCollectiveDocx(exportData);
      } else if (format === 'xlsx') {
        await exportCollectiveXlsx(exportData);
      } else if (format === 'csv') {
        exportCollectiveCsv(exportData);
      } else if (format === 'json') {
        exportCollectiveJson(exportData);
      }
      if (format !== 'pdf') addToast(`Rekap kolektif berhasil dibuat dalam format ${format.toUpperCase()}.`, 'success');
    } catch (error) {
      console.error(`Gagal membuat ekspor ${format}:`, error);
      addToast(`Ekspor ${format.toUpperCase()} gagal. Coba lagi atau kurangi jumlah/foto.`, 'error', 5200);
    } finally {
      setExportingFormat('');
    }
  };

  const isAllNew = roster.length > 0 && roster.every((person) => /BIKIN\s+BARU|PEMBUATAN\s+BARU/i.test(person.note || ''));
  const rosterTitle = `DATA PEMBUATAN SIM${isAllNew ? ' BARU' : ''} KOLEKTIF - ${roster.length} ORANG`;
  const acceptFiles = (files) => handleFiles(files);

  return (
    <ToolShell
      title="Rekap SIM Kolektif"
      desc="Unggah banyak foto KTP sekaligus, koreksi hasil OCR per orang, lalu buat rekap dengan foto KTP pada setiap baris."
      icon="fingerprint"
      className="sim-tool-shell sim-collective-shell"
    >
      <div className="sim-privacy-note" role="note">
        <Icon name="lock" size={17} />
        <p><strong>Privasi:</strong> OCR, koreksi, foto, dan ekspor diproses di browser perangkat ini. Foto dikompres untuk lampiran; data tidak dikirim ke API. Pastikan Anda berwenang menggunakan setiap KTP.</p>
      </div>

      <div className="sim-collective-toolbar sim-screen-only">
        <label className="sim-default-field">
          <span>SIM default untuk baris baru</span>
          <select className="select" value={defaultSimType} onChange={(event) => setDefaultSimType(event.target.value)} disabled={processing}>
            {SIM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="sim-default-field sim-note-default">
          <span>Keterangan default</span>
          <input className="input" value={defaultNote} onChange={(event) => setDefaultNote(event.target.value)} placeholder="BIKIN BARU" disabled={processing} />
        </label>
        <button type="button" className="btn btn-primary sim-upload-button" onClick={() => fileInputRef.current?.click()} disabled={processing || roster.length >= MAX_ROSTER}>
          <Icon name="image" size={16} />
          {processing ? 'Sedang membaca…' : 'Pilih banyak foto KTP'}
        </button>
        <input
          ref={fileInputRef}
          className="sim-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button type="button" className="btn btn-ghost sim-add-row-button" onClick={addManualPerson} disabled={processing || roster.length >= MAX_ROSTER}>
          + Tambah manual
        </button>
        <button type="button" className="btn btn-ghost sim-clear-button" onClick={clearRoster} disabled={processing || !roster.length}>
          Hapus semua
        </button>
      </div>

      <div
        className={`sim-drop-zone sim-screen-only${isDragging ? ' is-dragging' : ''}${processing ? ' is-processing' : ''}`}
        onDragOver={(event) => { event.preventDefault(); if (!processing) setIsDragging(true); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          acceptFiles(event.dataTransfer.files);
        }}
      >
        <span className="sim-drop-icon" aria-hidden="true"><Icon name="image" size={22} /></span>
        <div>
          <strong>{processing ? 'OCR berjalan satu per satu' : 'Atau seret dan lepas beberapa foto KTP di sini'}</strong>
          <p>{processing ? 'Mohon tunggu. Foto dan hasil yang selesai tetap berada di perangkat.' : `JPG, PNG, WebP · maks. 15 MB per foto · maks. ${MAX_ROSTER} orang dalam rekap`}</p>
        </div>
        {processing ? <button type="button" className="btn btn-ghost btn-sm" onClick={cancelProcessing}>Hentikan</button> : null}
      </div>

      {processing || progress.message ? (
        <div className="sim-batch-progress sim-screen-only" aria-live="polite">
          <div className="sim-batch-progress-text">
            <span>{progress.message}</span>
            <strong>{progress.total ? `${progress.current}/${progress.total}` : ''}</strong>
          </div>
          <progress value={progress.percent} max="100" aria-label="Kemajuan membaca KTP" />
        </div>
      ) : null}

      <div className="sim-roster-controls sim-screen-only">
        <div>
          <strong>{roster.length} orang</strong>
          <span> · Batas {MAX_ROSTER} baris</span>
        </div>
        <label className="sim-nik-toggle">
          <input type="checkbox" checked={includeNIK} onChange={(event) => setIncludeNIK(event.target.checked)} />
          <span>Tampilkan kolom NIK di hasil ekspor</span>
        </label>
      </div>

      {roster.length ? (
        <section className="sim-panel sim-roster-panel" aria-label="Rekap kolektif yang dapat diedit">
          <article className="sim-print-sheet sim-collective-document" aria-label="Pratinjau rekap SIM kolektif">
            <h2 className="sim-collective-title">{rosterTitle}</h2>
            <p className="sim-collective-disclaimer">DRAF REKAP PRIBADI — BUKAN SIM, BUKAN BUKTI PENDAFTARAN/PEMBAYARAN, DAN BUKAN FORMULIR RESMI.</p>
            <table className={`sim-collective-table${includeNIK ? ' has-nik' : ''}`}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>NAMA</th>
                  {includeNIK ? <th>NIK</th> : null}
                  <th>SIM</th>
                  <th>KETERANGAN</th>
                  <th>FOTO KTP</th>
                  <th className="sim-screen-only-col" aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {roster.map((person, index) => (
                  <tr key={person.id}>
                    <td className="sim-roster-number">{index + 1}</td>
                    <td className="sim-roster-name-cell">
                      <input
                        className="sim-roster-input sim-name-input"
                        aria-label={`Nama orang ke-${index + 1}`}
                        value={person.name || ''}
                        onChange={(event) => updatePerson(person.id, 'name', event.target.value)}
                        placeholder="Isi nama"
                        autoComplete="off"
                      />
                      {!includeNIK ? <span className="sim-roster-nik-hint sim-screen-only">NIK: {maskNik(person.nik)}</span> : null}
                      <details className="sim-roster-details sim-screen-only">
                        <summary>Detail KTP / koreksi</summary>
                        <div className="sim-detail-grid">
                          {DETAIL_FIELDS.map(([field, label, type]) => (
                            <DetailInput
                              key={field}
                              person={person}
                              field={field}
                              label={label}
                              type={type}
                              visible={Boolean(visibleNiks[person.id])}
                              onToggleVisibility={() => setVisibleNiks((current) => ({ ...current, [person.id]: !current[person.id] }))}
                              onChange={(key, value) => updatePerson(person.id, key, value)}
                            />
                          ))}
                          <DetailInput person={person} field="address" label="Alamat" onChange={(key, value) => updatePerson(person.id, key, value)} />
                        </div>
                        {person.ocrConfidence != null ? <span className="sim-ocr-confidence">Keyakinan OCR: {person.ocrConfidence}% — tetap cocokkan dengan KTP asli.</span> : null}
                      </details>
                    </td>
                    {includeNIK ? (
                      <td className="sim-roster-nik-cell">
                        <input
                          className="sim-roster-input"
                          value={person.nik || ''}
                          aria-label={`NIK orang ke-${index + 1}`}
                          inputMode="numeric"
                          maxLength={16}
                          onChange={(event) => updatePerson(person.id, 'nik', event.target.value.replace(/\D/g, '').slice(0, 16))}
                          placeholder="NIK"
                          autoComplete="off"
                        />
                      </td>
                    ) : null}
                    <td>
                      <select
                        className="sim-roster-input sim-roster-select"
                        aria-label={`Jenis SIM orang ke-${index + 1}`}
                        value={person.simType || ''}
                        onChange={(event) => updatePerson(person.id, 'simType', event.target.value)}
                      >
                        {SIM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        className="sim-roster-input"
                        aria-label={`Keterangan orang ke-${index + 1}`}
                        value={person.note || ''}
                        onChange={(event) => updatePerson(person.id, 'note', event.target.value)}
                        placeholder="BIKIN BARU"
                        autoComplete="off"
                      />
                    </td>
                    <td className="sim-roster-photo-cell">
                      {person.photoData ? (
                        <img className="sim-roster-photo" src={person.photoData} alt={`Foto KTP untuk baris ${index + 1}`} />
                      ) : (
                        <span className="sim-no-photo">Belum ada foto</span>
                      )}
                    </td>
                    <td className="sim-screen-only-col sim-roster-action-cell">
                      <button type="button" className="sim-remove-person" onClick={() => removePerson(person.id)} aria-label={`Hapus orang ke-${index + 1}`} title="Hapus baris">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <div className="sim-export-panel sim-screen-only">
            <div className="sim-export-heading">
              <div>
                <strong>Unduh rekap</strong>
                <span>Foto KTP disertakan di PDF, DOCX, dan XLSX. CSV memuat data; JSON juga menyimpan foto terkompres.</span>
              </div>
            </div>
            <div className="sim-export-actions">
              {[
                ['pdf', 'PDF / Cetak'],
                ['docx', 'DOCX'],
                ['xlsx', 'Excel'],
                ['csv', 'CSV'],
                ['json', 'JSON'],
              ].map(([format, label]) => (
                <button
                  key={format}
                  type="button"
                  className={`btn ${format === 'pdf' ? 'btn-primary' : 'btn-ghost'} sim-export-button`}
                  onClick={() => handleExport(format)}
                  disabled={Boolean(exportingFormat) || processing}
                >
                  {exportingFormat === format ? 'Membuat…' : label}
                </button>
              ))}
            </div>
            <p className="sim-export-hint">Untuk PDF, pilih “Simpan sebagai PDF” pada dialog cetak browser. Kolom NIK pada rekap utama opsional; ekspor CSV, JSON, dan sheet “Data KTP” tetap memuat semua data KTP.</p>
          </div>
        </section>
      ) : (
        <section className="sim-panel sim-roster-empty sim-screen-only">
          <div className="sim-empty-icon"><Icon name="image" size={23} /></div>
          <h2>Belum ada orang di rekap</h2>
          <p>Pilih banyak foto KTP sekaligus untuk membuat satu baris per orang. Hasil OCR bisa dikoreksi sebelum diunduh.</p>
          <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={processing}>
            Pilih foto KTP
          </button>
        </section>
      )}

      <div className="sim-collective-footer sim-screen-only">
        <span>Foto dikompres di perangkat untuk menjaga ukuran file ekspor tetap wajar. Hapus rekap setelah selesai bila perangkat dipakai bersama.</span>
        <span>OCR hanya saran—verifikasi nama, NIK, dan golongan SIM sebelum digunakan.</span>
      </div>
    </ToolShell>
  );
}
