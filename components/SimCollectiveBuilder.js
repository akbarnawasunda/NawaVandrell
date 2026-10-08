'use client';

import { useEffect, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { useToast } from '@/context/ToastContext';
import { extractKtpFields, mergeKtpCandidates } from '@/lib/ktpOcr.mjs';
import {
  composePositionedPhoto,
  DEFAULT_PHOTO_LAYOUT,
  drawPositionedImage,
  getPhotoPlacement,
  loadImage,
  normalizePhotoLayout,
  PHOTO_FRAME_SIZE,
  prepareKtpImageAssets,
  prepareKtpPhoto,
  prepareOcrVariantsFromDataUrl,
} from '@/lib/ktpImageProcessing.mjs';
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
const KTP_FIELD_KEYS = Object.keys(EMPTY_KTP);
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
    photoOriginalData: photoData,
    photoLayout: normalizePhotoLayout(DEFAULT_PHOTO_LAYOUT),
    ocrScore: null,
    ocrConfidence: null,
    ocrFieldsFound: 0,
    ocrConflicts: [],
    ocrPasses: 0,
  };
}

function maskNik(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : 'Belum terbaca';
}

function progressText(status) {
  if (status.includes('core')) return 'Menyiapkan mesin baca lokal';
  if (status.includes('language') || status.includes('traineddata')) return 'Memuat model bahasa Indonesia';
  if (status.includes('recogniz')) return 'Membaca tulisan di KTP';
  if (status.includes('initializ')) return 'Menyiapkan pemindaian';
  return 'Memproses foto di perangkat';
}

function createOcrWorker(logger) {
  return import('tesseract.js').then(({ createWorker, OEM }) => createWorker('ind', OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr',
    langPath: '/ocr',
    gzip: true,
    cacheMethod: 'write',
    workerBlobURL: false,
    logger,
  }));
}

async function runOcrPasses(worker, originalSource, variants, mode, onPassStart) {
  const { PSM } = await import('tesseract.js');
  const careful = mode === 'cermat';
  const passCount = careful ? 3 : 1;
  const candidates = [];
  const passes = [
    { source: careful ? originalSource : (variants.enhancedData || originalSource), psm: PSM.AUTO, label: careful ? 'Baca foto asli' : 'Pindai cepat' },
  ];

  if (careful) {
    passes.push({ source: variants.enhancedData || originalSource, psm: PSM.SPARSE_TEXT, label: 'Baca kontras tinggi' });
  }

  const readPass = async (pass, passIndex, label = pass.label) => {
    onPassStart(passIndex, passCount, label);
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: pass.psm,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
      const result = await worker.recognize(pass.source, { rotateAuto: true });
      candidates.push({
        text: result?.data?.text || '',
        confidence: result?.data?.confidence || 0,
      });
      return true;
    } catch {
      return false;
    }
  };

  for (let index = 0; index < passes.length; index += 1) await readPass(passes[index], index);

  let merged = mergeKtpCandidates(candidates);
  const needsRescuePass = careful && variants.thresholdData
    && (!merged.fields.name || !merged.fields.nik || merged.fieldsFound < 7);
  if (needsRescuePass) {
    await readPass({ source: variants.thresholdData, psm: PSM.SPARSE_TEXT }, 2, 'Pembersihan tambahan untuk data yang belum terbaca');
    merged = mergeKtpCandidates(candidates);
  }

  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' }).catch(() => {});
  return { ...merged, passes: candidates.length };
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

function PhotoPositionEditor({ person, rowNumber, onClose, onSave }) {
  const sourceData = person.photoOriginalData || person.photoData;
  const [layout, setLayout] = useState(() => normalizePhotoLayout(person.photoLayout || DEFAULT_PHOTO_LAYOUT));
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadImage(sourceData).then((loaded) => {
      if (active) setImage(loaded);
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Foto tidak dapat dibuka.');
    });
    return () => { active = false; };
  }, [sourceData]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = 960;
    canvas.height = Math.round(canvas.width * PHOTO_FRAME_SIZE.height / PHOTO_FRAME_SIZE.width);
    const context = canvas.getContext('2d');
    if (!context) return;
    drawPositionedImage(context, image, canvas.width, canvas.height, layout);
  }, [image, layout]);

  const updateLayout = (key, value) => {
    setLayout((current) => normalizePhotoLayout({ ...current, [key]: value }));
  };

  const startDrag = (event) => {
    if (!image || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      layout,
    };
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas || !image) return;
    const rect = canvas.getBoundingClientRect();
    const placement = getPhotoPlacement(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, drag.layout);
    const rangeX = canvas.width - placement.width;
    const rangeY = canvas.height - placement.height;
    const deltaX = (event.clientX - drag.startX) * canvas.width / Math.max(rect.width, 1);
    const deltaY = (event.clientY - drag.startY) * canvas.height / Math.max(rect.height, 1);
    setLayout(normalizePhotoLayout({
      ...drag.layout,
      positionX: Math.abs(rangeX) < 1 ? drag.layout.positionX : drag.layout.positionX + deltaX / rangeX,
      positionY: Math.abs(rangeY) < 1 ? drag.layout.positionY : drag.layout.positionY + deltaY / rangeY,
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const photoData = await composePositionedPhoto(sourceData, layout);
      await onSave({ photoData, photoOriginalData: sourceData, photoLayout: normalizePhotoLayout(layout) });
    } catch (saveError) {
      setError(saveError.message || 'Posisi foto belum bisa disimpan.');
      setSaving(false);
    }
  };

  return (
    <div className="sim-photo-editor-backdrop sim-screen-only" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="sim-photo-editor" role="dialog" aria-modal="true" aria-labelledby="sim-photo-editor-title">
        <div className="sim-photo-editor-header">
          <div className="sim-photo-editor-icon"><Icon name="image" size={19} /></div>
          <div>
            <p>BARIS {rowNumber}</p>
            <h2 id="sim-photo-editor-title">Atur posisi foto KTP</h2>
          </div>
          <button type="button" className="sim-photo-close" onClick={onClose} disabled={saving} aria-label="Tutup editor foto">×</button>
        </div>

        <p className="sim-photo-editor-help">Seret foto langsung di pratinjau. Pilih mode <strong>Utuh</strong> agar kartu tidak terpotong, atau <strong>Isi bingkai</strong> untuk memenuhi kotak.</p>
        <div className={`sim-photo-canvas-wrap${image ? ' is-ready' : ''}`}>
          {image ? (
            <canvas
              ref={canvasRef}
              className="sim-photo-editor-canvas"
              aria-label="Pratinjau foto KTP yang bisa digeser"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}
            />
          ) : <div className="sim-photo-loading">{error || 'Membuka foto…'}</div>}
        </div>

        <div className="sim-photo-fit-options" role="group" aria-label="Cara menampilkan foto">
          <button type="button" className={layout.fit === 'contain' ? 'is-selected' : ''} onClick={() => updateLayout('fit', 'contain')}>
            <strong>Utuh</strong><span>Seluruh KTP terlihat</span>
          </button>
          <button type="button" className={layout.fit === 'cover' ? 'is-selected' : ''} onClick={() => updateLayout('fit', 'cover')}>
            <strong>Isi bingkai</strong><span>Sebagian tepi bisa terpotong</span>
          </button>
        </div>

        <label className="sim-photo-slider">
          <span><strong>Ukuran</strong><output>{Math.round(layout.zoom * 100)}%</output></span>
          <input type="range" min="0.7" max="2.5" step="0.01" value={layout.zoom} onChange={(event) => updateLayout('zoom', Number(event.target.value))} />
        </label>
        <label className="sim-photo-slider">
          <span><strong>Posisi mendatar</strong><output>{Math.round(layout.positionX * 100)}%</output></span>
          <input type="range" min="0" max="1" step="0.01" value={layout.positionX} onChange={(event) => updateLayout('positionX', Number(event.target.value))} />
        </label>
        <label className="sim-photo-slider">
          <span><strong>Posisi vertikal</strong><output>{Math.round(layout.positionY * 100)}%</output></span>
          <input type="range" min="0" max="1" step="0.01" value={layout.positionY} onChange={(event) => updateLayout('positionY', Number(event.target.value))} />
        </label>

        {error ? <p className="sim-photo-editor-error" role="alert">{error}</p> : null}
        <div className="sim-photo-editor-footer">
          <button type="button" className="btn btn-ghost sim-photo-reset" onClick={() => setLayout(normalizePhotoLayout(DEFAULT_PHOTO_LAYOUT))} disabled={saving}>Atur ulang</button>
          <div>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Batal</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={!image || saving}>{saving ? 'Menyimpan…' : 'Simpan posisi'}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SimCollectiveBuilder() {
  const { addToast } = useToast();
  const [roster, setRoster] = useState([]);
  const [defaultSimType, setDefaultSimType] = useState('SIM C');
  const [defaultNote, setDefaultNote] = useState('BIKIN BARU');
  const [ocrMode, setOcrMode] = useState('cermat');
  const [includeNIK, setIncludeNIK] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [retryingPersonId, setRetryingPersonId] = useState('');
  const [replacementPersonId, setReplacementPersonId] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0, message: '' });
  const [exportingFormat, setExportingFormat] = useState('');
  const [photoEditorId, setPhotoEditorId] = useState('');
  const [visibleNiks, setVisibleNiks] = useState({});
  const fileInputRef = useRef(null);
  const recognitionRef = useRef({ id: 0, worker: null });
  const activeOcrRef = useRef({ fileIndex: 0, totalFiles: 1, passIndex: 0, passCount: 1, label: '' });

  useEffect(() => () => {
    recognitionRef.current.id += 1;
    const worker = recognitionRef.current.worker;
    recognitionRef.current.worker = null;
    if (worker) Promise.resolve(worker.terminate()).catch(() => {});
  }, []);

  const updatePerson = (id, field, value) => {
    setRoster((current) => current.map((person) => (person.id === id ? { ...person, [field]: value } : person)));
  };

  const onOcrProgress = (message) => {
    const active = activeOcrRef.current;
    if (active.jobId !== recognitionRef.current.id) return;
    const fraction = Math.max(0, Math.min(1, Number(message.progress) || 0));
    const total = Math.max(1, active.totalFiles);
    const percent = Math.round(((active.fileIndex + (active.passIndex + fraction) / Math.max(active.passCount, 1)) / total) * 100);
    setProgress((current) => ({
      ...current,
      percent,
      message: `${active.label || 'OCR lokal'} · ${progressText(String(message.status || ''))}`,
    }));
  };

  const startOcrPass = (jobId, fileIndex, totalFiles, passIndex, passCount, label) => {
    activeOcrRef.current = { jobId, fileIndex, totalFiles, passIndex, passCount, label };
    setProgress((current) => ({
      ...current,
      message: `${label} · ${fileIndex + 1} dari ${totalFiles}`,
    }));
  };

  const handleFiles = async (fileList) => {
    if (processing || retryingPersonId) return;
    const candidates = Array.from(fileList || []);
    if (!candidates.length) return;

    const validFiles = [];
    const rejected = [];
    for (const file of candidates) {
      const extensionAllowed = /\.(jpe?g|png|webp)$/i.test(file.name || '');
      if (!(ALLOWED_IMAGE_TYPES.has(file.type) || (!file.type && extensionAllowed))) {
        rejected.push(`${file.name || 'File'}: pilih JPG, PNG, atau WebP.`);
      } else if (file.size > MAX_IMAGE_SIZE) {
        rejected.push(`${file.name || 'File'}: ukuran melewati 15 MB.`);
      } else {
        validFiles.push(file);
      }
    }
    if (rejected.length) addToast(`${rejected.length} file dilewati. ${rejected[0]}`, 'warning', 5200);
    if (!validFiles.length) return;

    const available = Math.max(0, MAX_ROSTER - roster.length);
    if (!available) {
      addToast(`Batas rekap ${MAX_ROSTER} orang sudah tercapai.`, 'warning');
      return;
    }
    const files = validFiles.slice(0, available);
    if (files.length < validFiles.length) addToast(`Hanya ${files.length} file yang ditambahkan agar batas ${MAX_ROSTER} baris tidak terlampaui.`, 'warning', 5200);

    const jobId = ++recognitionRef.current.id;
    const careful = ocrMode === 'cermat';
    setProcessing(true);
    setProgress({ current: 0, total: files.length, percent: 0, message: 'Menyiapkan mesin OCR bahasa Indonesia…' });
    activeOcrRef.current = { jobId, fileIndex: 0, totalFiles: files.length, passIndex: 0, passCount: careful ? 3 : 1, label: 'Memuat model OCR' };

    let worker = null;
    let ocrAvailable = true;
    try {
      worker = await createOcrWorker(onOcrProgress);
      if (recognitionRef.current.id !== jobId) {
        await worker.terminate();
        return;
      }
      recognitionRef.current.worker = worker;
    } catch {
      ocrAvailable = false;
      addToast('Model OCR belum bisa dimuat. Foto tetap masuk dan semua kolom dapat diisi manual.', 'warning', 5600);
    }

    let added = 0;
    let failedPhotos = 0;
    let readCount = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        if (recognitionRef.current.id !== jobId) break;
        setProgress((current) => ({
          ...current,
          current: index,
          percent: Math.round((index / Math.max(current.total, 1)) * 100),
          message: `Menyiapkan KTP ${index + 1} dari ${files.length}…`,
        }));

        let assets;
        try {
          assets = worker ? await prepareKtpImageAssets(files[index]) : { photoData: await prepareKtpPhoto(files[index]) };
        } catch (error) {
          failedPhotos += 1;
          setProgress((current) => ({ ...current, current: index + 1, message: `Foto ${index + 1} dilewati · ${error.message}` }));
          continue;
        }
        if (recognitionRef.current.id !== jobId) break;

        let result = { fields: {}, score: 0, confidence: 0, fieldsFound: 0, conflicts: [], passes: 0 };
        if (worker && ocrAvailable) {
          try {
            result = await runOcrPasses(
              worker,
              files[index],
              assets,
              ocrMode,
              (passIndex, passCount, label) => startOcrPass(jobId, index, files.length, passIndex, passCount, label),
            );
          } catch {
            // Foto tetap dibuat menjadi baris agar koreksi manual tidak terhalang kegagalan OCR.
          }
        }
        if (recognitionRef.current.id !== jobId) break;

        const person = createPerson({ simType: defaultSimType, note: defaultNote, photoData: assets.photoData, parsed: result.fields });
        person.ocrScore = result.score;
        person.ocrConfidence = result.confidence;
        person.ocrFieldsFound = result.fieldsFound;
        person.ocrConflicts = result.conflicts;
        person.ocrPasses = result.passes;
        setRoster((current) => [...current, person]);
        added += 1;
        if (result.fieldsFound) readCount += 1;
        setProgress((current) => ({
          ...current,
          current: index + 1,
          percent: Math.round(((index + 1) / Math.max(current.total, 1)) * 100),
          message: `Selesai membaca KTP ${index + 1} dari ${files.length}.`,
        }));
      }

      if (recognitionRef.current.id === jobId) {
        if (added) {
          const suffix = ocrAvailable ? ` Data terbaca pada ${readCount} dari ${added} KTP; periksa badge “Perlu dicek”.` : ' Isi data yang belum terbaca secara manual.';
          addToast(`${added} foto ditambahkan.${suffix}`, added === files.length ? 'success' : 'warning', 6000);
        } else if (failedPhotos) {
          addToast('Foto gagal dibuka. Coba file JPG, PNG, atau WebP lain.', 'error');
        }
        setProgress((current) => ({ ...current, current: added, percent: 100, message: 'Pemindaian selesai · cocokkan lagi data dengan KTP asli.' }));
      }
    } finally {
      if (worker) {
        if (recognitionRef.current.worker === worker) recognitionRef.current.worker = null;
        await Promise.resolve(worker.terminate()).catch(() => {});
      }
      if (recognitionRef.current.id === jobId) setProcessing(false);
    }
  };

  const addManualPerson = () => {
    if (roster.length >= MAX_ROSTER) {
      addToast(`Batas rekap ${MAX_ROSTER} orang sudah tercapai.`, 'warning');
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

  const replacePhoto = async (id, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const extensionAllowed = /\.(jpe?g|png|webp)$/i.test(file.name || '');
    if (!(ALLOWED_IMAGE_TYPES.has(file.type) || (!file.type && extensionAllowed))) {
      addToast('Pilih foto JPG, PNG, atau WebP.', 'warning');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      addToast('Foto tidak boleh lebih besar dari 15 MB.', 'warning');
      return;
    }
    setReplacementPersonId(id);
    try {
      const photoData = await prepareKtpPhoto(file);
      setRoster((current) => current.map((person) => person.id === id ? {
        ...person,
        photoData,
        photoOriginalData: photoData,
        photoLayout: normalizePhotoLayout(DEFAULT_PHOTO_LAYOUT),
        ocrScore: null,
        ocrFieldsFound: 0,
        ocrConflicts: [],
      } : person));
      addToast('Foto diganti. Jalankan OCR ulang untuk mengisi kolom kosong.', 'success');
    } catch (error) {
      addToast(error.message || 'Foto tidak dapat digunakan.', 'error');
    } finally {
      setReplacementPersonId('');
    }
  };

  const retryOcrForPerson = async (personId) => {
    if (processing || retryingPersonId) return;
    const person = roster.find((item) => item.id === personId);
    const source = person?.photoOriginalData || person?.photoData;
    if (!person || !source) {
      addToast('Baris ini belum memiliki foto KTP.', 'warning');
      return;
    }
    const jobId = ++recognitionRef.current.id;
    setRetryingPersonId(personId);
    setProgress({ current: 0, total: 1, percent: 0, message: 'Menyiapkan OCR ulang…' });
    activeOcrRef.current = { jobId, fileIndex: 0, totalFiles: 1, passIndex: 0, passCount: 3, label: `OCR ulang · baris ${roster.findIndex((item) => item.id === personId) + 1}` };
    let worker = null;
    try {
      worker = await createOcrWorker(onOcrProgress);
      if (recognitionRef.current.id !== jobId) {
        await worker.terminate();
        worker = null;
        return;
      }
      recognitionRef.current.worker = worker;
      const variants = await prepareOcrVariantsFromDataUrl(source);
      const result = await runOcrPasses(worker, source, variants, 'cermat', (passIndex, passCount, label) => {
        startOcrPass(jobId, 0, 1, passIndex, passCount, label);
      });
      if (recognitionRef.current.id !== jobId) return;
      let filled = 0;
      setRoster((current) => current.map((item) => {
        if (item.id !== personId) return item;
        const next = { ...item };
        for (const key of KTP_FIELD_KEYS) {
          if (!String(next[key] || '').trim() && String(result.fields[key] || '').trim()) {
            next[key] = result.fields[key];
            filled += 1;
          }
        }
        next.ocrScore = result.score;
        next.ocrConfidence = result.confidence;
        next.ocrFieldsFound = result.fieldsFound;
        next.ocrConflicts = result.conflicts;
        next.ocrPasses = result.passes;
        return next;
      }));
      addToast(filled ? `${filled} kolom kosong diisi dari OCR ulang. Data yang sudah terisi tidak ditimpa.` : 'OCR ulang selesai. Kolom yang sudah berisi tetap tidak diubah; periksa detail KTP.', 'success', 5200);
      setProgress((current) => ({ ...current, percent: 100, message: 'OCR ulang selesai · data lama tidak ditimpa.' }));
    } catch (error) {
      addToast(error.message || 'OCR ulang gagal. Isi data secara manual.', 'error');
    } finally {
      if (worker) {
        if (recognitionRef.current.worker === worker) recognitionRef.current.worker = null;
        await Promise.resolve(worker.terminate()).catch(() => {});
      }
      if (recognitionRef.current.id === jobId) setRetryingPersonId('');
    }
  };

  const clearRoster = () => {
    if (!roster.length) return;
    if (!window.confirm('Hapus semua orang dan foto KTP dari rekap ini? Tindakan ini tidak dapat dibatalkan.')) return;
    setRoster([]);
    setProgress({ current: 0, total: 0, percent: 0, message: '' });
    addToast('Rekap dihapus dari perangkat ini.', 'success');
  };

  const cancelProcessing = async () => {
    recognitionRef.current.id += 1;
    const worker = recognitionRef.current.worker;
    recognitionRef.current.worker = null;
    if (worker) await Promise.resolve(worker.terminate()).catch(() => {});
    setProcessing(false);
    setRetryingPersonId('');
    setProgress((current) => ({ ...current, message: 'Pemindaian dihentikan · baris yang selesai tetap ada.' }));
    addToast('Pemindaian dihentikan. Baris yang selesai tetap tersimpan.', 'info');
  };

  const savePhotoPosition = async (personId, changes) => {
    setRoster((current) => current.map((person) => person.id === personId ? { ...person, ...changes } : person));
    setPhotoEditorId('');
    addToast('Posisi foto disimpan dan akan dipakai pada hasil ekspor.', 'success');
  };

  const handleExport = async (format) => {
    if (!roster.length) {
      addToast('Tambahkan foto KTP atau baris manual sebelum ekspor.', 'warning');
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
      if (format !== 'pdf') addToast(`Rekap kolektif siap sebagai ${format.toUpperCase()}.`, 'success');
    } catch (error) {
      console.error(`Gagal membuat ekspor ${format}:`, error);
      addToast(`Ekspor ${format.toUpperCase()} gagal. Coba lagi atau kurangi jumlah/foto.`, 'error', 5200);
    } finally {
      setExportingFormat('');
    }
  };

  const isAllNew = roster.length > 0 && roster.every((person) => /BIKIN\s+BARU|PEMBUATAN\s+BARU/i.test(person.note || ''));
  const rosterTitle = `DATA PEMBUATAN SIM${isAllNew ? ' BARU' : ''} KOLEKTIF - ${roster.length} ORANG`;
  const photoEditorPerson = roster.find((person) => person.id === photoEditorId);
  const simCounts = roster.reduce((counts, person) => {
    const type = person.simType || 'Belum dipilih';
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});

  return (
    <ToolShell
      title="Rekap SIM Kolektif"
      desc="Satukan data banyak KTP dalam satu rekap yang bisa dikoreksi dan dicetak."
      icon="fingerprint"
      className="sim-tool-shell sim-collective-shell"
    >
      <section className="sim-collective-intro" aria-label="Alur penggunaan">
        <div className="sim-collective-eyebrow"><span className="sim-live-dot" /> OCR LOKAL · REKAP BANYAK ORANG</div>
        <p>Satu foto KTP jadi satu baris. Rapikan data, atur foto, lalu ekspor daftar yang siap dibagikan.</p>
        <div className="sim-workflow-steps">
          <div className={roster.length ? 'is-complete' : 'is-current'}><b>01</b><span><strong>Unggah</strong><small>Foto KTP</small></span></div>
          <i aria-hidden="true" />
          <div className={roster.length ? (processing ? 'is-current' : 'is-complete') : ''}><b>02</b><span><strong>Periksa</strong><small>OCR & foto</small></span></div>
          <i aria-hidden="true" />
          <div className={roster.length && !processing ? 'is-current' : ''}><b>03</b><span><strong>Ekspor</strong><small>PDF / Excel</small></span></div>
        </div>
      </section>

      <div className="sim-privacy-note" role="note">
        <span className="sim-privacy-icon"><Icon name="lock" size={17} /></span>
        <p><strong>Data tetap di perangkat.</strong> Foto, OCR, koreksi, dan ekspor berlangsung di browser ini—tidak diunggah ke API. Pastikan Anda berhak menggunakan setiap KTP.</p>
      </div>

      <section className="sim-upload-card sim-screen-only" aria-label="Unggah KTP">
        <div className="sim-upload-card-heading">
          <div className="sim-step sim-step-large">01</div>
          <div><h2>Mulai dari foto KTP</h2><p>Pilih beberapa file sekaligus. Mode cermat mencoba beberapa pembacaan lalu menggabungkan hasilnya.</p></div>
          <span className="sim-local-badge"><Icon name="lock" size={13} /> LOKAL</span>
        </div>

        <div className="sim-ocr-settings">
          <label className="sim-setting-field">
            <span>SIM untuk baris baru</span>
            <select className="select" value={defaultSimType} onChange={(event) => setDefaultSimType(event.target.value)} disabled={processing || Boolean(retryingPersonId)}>
              {SIM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="sim-setting-field">
            <span>Keterangan default</span>
            <input className="input" value={defaultNote} onChange={(event) => setDefaultNote(event.target.value)} placeholder="BIKIN BARU" disabled={processing || Boolean(retryingPersonId)} />
          </label>
          <label className="sim-setting-field sim-ocr-mode-field">
            <span>Mode OCR</span>
            <select className="select" value={ocrMode} onChange={(event) => setOcrMode(event.target.value)} disabled={processing || Boolean(retryingPersonId)}>
              <option value="cermat">Cermat · lebih lengkap</option>
              <option value="cepat">Cepat · satu pemindaian</option>
            </select>
          </label>
        </div>
        <p className="sim-ocr-mode-note"><strong>{ocrMode === 'cermat' ? 'Cermat:' : 'Cepat:'}</strong> {ocrMode === 'cermat' ? 'membaca foto asli dan versi kontras tinggi; mencoba pembersihan tambahan bila nama/NIK belum terbaca.' : 'satu kali baca untuk mempercepat unggahan banyak KTP.'} Hasilnya tetap perlu diverifikasi.</p>

        <input
          ref={fileInputRef}
          className="sim-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <div
          className={`sim-drop-zone${isDragging ? ' is-dragging' : ''}${processing ? ' is-processing' : ''}`}
          onDragOver={(event) => { event.preventDefault(); if (!processing && !retryingPersonId) setIsDragging(true); }}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
          aria-label="Area untuk mengunggah foto KTP"
        >
          <div className="sim-drop-icon"><Icon name="image" size={23} /></div>
          <div className="sim-drop-copy">
            <strong>{processing ? 'Sedang membaca KTP satu per satu…' : isDragging ? 'Lepaskan foto untuk mulai' : 'Letakkan foto KTP di sini'}</strong>
            <span>{processing ? 'Foto yang selesai akan langsung muncul di daftar.' : 'atau pilih beberapa file dari perangkat'}</span>
          </div>
          <div className="sim-drop-actions">
            {processing || retryingPersonId ? (
              <button type="button" className="btn btn-ghost sim-cancel-button" onClick={cancelProcessing}>Hentikan OCR</button>
            ) : (
              <button type="button" className="btn btn-primary sim-upload-button" onClick={() => fileInputRef.current?.click()} disabled={roster.length >= MAX_ROSTER}>
                <Icon name="image" size={16} /> Pilih foto KTP
              </button>
            )}
            <button type="button" className="btn btn-ghost sim-add-row-button" onClick={addManualPerson} disabled={processing || Boolean(retryingPersonId) || roster.length >= MAX_ROSTER}>+ Baris manual</button>
          </div>
          <small>JPG, PNG, WebP · maks. 15 MB/foto · hingga {MAX_ROSTER} orang</small>
        </div>

        {(processing || retryingPersonId || progress.message) ? (
          <div className="sim-batch-progress" aria-live="polite">
            <div className="sim-batch-progress-text"><span>{progress.message}</span><strong>{progress.total ? `${progress.current}/${progress.total}` : ''}</strong></div>
            <progress value={progress.percent} max="100" aria-label="Kemajuan OCR" />
          </div>
        ) : null}
      </section>

      <div className="sim-roster-controls sim-screen-only">
        <div className="sim-roster-count"><span className="sim-roster-count-number">{roster.length}</span><span><strong>orang di rekap</strong><small>{MAX_ROSTER - roster.length} slot tersisa</small></span></div>
        <div className="sim-roster-tools">
          <label className="sim-nik-toggle"><input type="checkbox" checked={includeNIK} onChange={(event) => setIncludeNIK(event.target.checked)} /><span>Tampilkan NIK di tabel</span></label>
          <button type="button" className="btn btn-ghost sim-clear-button" onClick={clearRoster} disabled={!roster.length || processing || Boolean(retryingPersonId)}>Kosongkan daftar</button>
        </div>
      </div>

      {roster.length ? (
        <section className="sim-roster-section" aria-label="Daftar SIM kolektif yang dapat diedit">
          <div className="sim-roster-section-heading sim-screen-only">
            <div><span className="sim-step sim-step-large">02</span><div><h2>Periksa & rapikan</h2><p>Ubah isian langsung. Buka detail untuk NIK dan alamat, atau atur foto pada setiap baris.</p></div></div>
            <div className="sim-sim-counts" aria-label="Jumlah per jenis SIM">
              {Object.entries(simCounts).sort(([a], [b]) => a.localeCompare(b, 'id')).map(([type, count]) => <span key={type}>{type}<b>{count}</b></span>)}
            </div>
          </div>

          <article className="sim-print-sheet sim-collective-document" aria-label="Pratinjau rekap SIM kolektif">
            <h2 className="sim-collective-title">{rosterTitle}</h2>
            <p className="sim-collective-disclaimer">DRAF REKAP PRIBADI — BUKAN SIM, BUKAN BUKTI PENDAFTARAN/PEMBAYARAN, DAN BUKAN FORMULIR RESMI.</p>
            <div className="sim-table-scroll">
              <table className={`sim-collective-table${includeNIK ? ' has-nik' : ''}`}>
                <thead>
                  <tr>
                    <th>No</th><th>NAMA</th>
                    {includeNIK ? <th>NIK</th> : null}
                    <th>SIM</th><th>KETERANGAN</th><th>FOTO KTP</th>
                    <th className="sim-screen-only-col" aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {roster.map((person, index) => {
                    const needsReview = !person.name || !/^\d{16}$/.test(String(person.nik || '')) || Boolean(person.ocrConflicts?.length);
                    return (
                      <tr key={person.id}>
                        <td data-label="No" className="sim-roster-number">{index + 1}</td>
                        <td data-label="NAMA" className="sim-roster-name-cell">
                          <input
                            className="sim-roster-input sim-name-input"
                            aria-label={`Nama orang ke-${index + 1}`}
                            value={person.name || ''}
                            onChange={(event) => updatePerson(person.id, 'name', event.target.value)}
                            placeholder="Isi nama lengkap"
                            autoComplete="off"
                          />
                          {!includeNIK ? <span className="sim-roster-nik-hint sim-screen-only">NIK: {maskNik(person.nik)}</span> : null}
                          {person.ocrFieldsFound > 0 ? (
                            <span className={`sim-ocr-badge${needsReview ? ' needs-review' : ' looks-good'}`}>
                              <i /> {needsReview ? 'Perlu dicek' : `${person.ocrFieldsFound} data terbaca`}
                            </span>
                          ) : <span className="sim-ocr-badge is-manual"><i /> {person.photoData ? 'Isi data' : 'Baris manual'}</span>}
                          <details className="sim-roster-details sim-screen-only">
                            <summary>Detail KTP & OCR {person.ocrPasses ? <span>· {person.ocrPasses} kali baca</span> : null}</summary>
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
                            {person.ocrConflicts?.length ? <p className="sim-ocr-conflict-note">Beberapa pembacaan berbeda pada {person.ocrConflicts.map((key) => key === 'nik' ? 'NIK' : key === 'name' ? 'nama' : key).join(', ')}. Cocokkan dengan foto asli.</p> : null}
                            {person.ocrScore != null ? <p className="sim-ocr-quality-note">Kelengkapan: {person.ocrFieldsFound}/{KTP_FIELD_KEYS.length} bidang · skor kecocokan pola {person.ocrScore}/100 · bukan jaminan akurasi.</p> : null}
                            {person.photoData ? (
                              <button type="button" className="sim-retry-ocr" onClick={() => retryOcrForPerson(person.id)} disabled={processing || Boolean(retryingPersonId)}>
                                {retryingPersonId === person.id ? 'Membaca ulang…' : 'Coba OCR ulang · isi kolom kosong'}
                              </button>
                            ) : null}
                          </details>
                        </td>
                        {includeNIK ? (
                          <td data-label="NIK" className="sim-roster-nik-cell">
                            <input className="sim-roster-input" value={person.nik || ''} aria-label={`NIK orang ke-${index + 1}`} inputMode="numeric" maxLength={16} onChange={(event) => updatePerson(person.id, 'nik', event.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="16 digit" autoComplete="off" />
                          </td>
                        ) : null}
                        <td data-label="SIM">
                          <select className="sim-roster-input sim-roster-select" aria-label={`Jenis SIM orang ke-${index + 1}`} value={person.simType || ''} onChange={(event) => updatePerson(person.id, 'simType', event.target.value)}>
                            {SIM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </td>
                        <td data-label="KETERANGAN">
                          <input className="sim-roster-input" aria-label={`Keterangan orang ke-${index + 1}`} value={person.note || ''} onChange={(event) => updatePerson(person.id, 'note', event.target.value)} placeholder="BIKIN BARU" autoComplete="off" />
                        </td>
                        <td data-label="FOTO KTP" className="sim-roster-photo-cell">
                          {person.photoData ? (
                            <div className="sim-photo-preview-frame"><img className="sim-roster-photo" src={person.photoData} alt={`Foto KTP orang ke-${index + 1}`} /></div>
                          ) : <div className="sim-photo-missing"><Icon name="image" size={16} /><span>Foto belum ada</span></div>}
                          <div className="sim-photo-actions sim-screen-only">
                            <button type="button" className="sim-photo-action sim-photo-adjust" onClick={() => setPhotoEditorId(person.id)} disabled={!person.photoData || processing || Boolean(retryingPersonId)}>
                              Atur posisi
                            </button>
                            <label className={`sim-photo-action${replacementPersonId === person.id ? ' is-busy' : ''}`}>
                              {person.photoData ? (replacementPersonId === person.id ? 'Mengganti…' : 'Ganti foto') : (replacementPersonId === person.id ? 'Menambah…' : 'Tambah foto')}
                              <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={Boolean(replacementPersonId) || processing} onChange={(event) => { void replacePhoto(person.id, event); }} />
                            </label>
                          </div>
                        </td>
                        <td data-label="Aksi" className="sim-screen-only-col sim-roster-action-cell">
                          <button type="button" className="sim-remove-person" onClick={() => removePerson(person.id)} aria-label={`Hapus orang ke-${index + 1}`} title="Hapus baris">×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <section className="sim-export-panel sim-screen-only" aria-label="Ekspor rekap">
            <div className="sim-export-panel-heading">
              <span className="sim-step sim-step-large">03</span>
              <div><h2>Siap dibagikan</h2><p>Foto mengikuti posisi yang sudah Anda simpan.</p></div>
            </div>
            <div className="sim-export-actions">
              {[
                ['pdf', 'PDF / Cetak', 'Simpan PDF'],
                ['docx', 'DOCX', 'Word'],
                ['xlsx', 'Excel', 'Dengan foto'],
                ['csv', 'CSV', 'Data tabel'],
                ['json', 'JSON', 'Termasuk foto'],
              ].map(([format, label, sublabel]) => (
                <button key={format} type="button" className={`sim-export-card ${format === 'pdf' ? 'is-primary' : ''}`} onClick={() => handleExport(format)} disabled={Boolean(exportingFormat) || processing || Boolean(retryingPersonId)}>
                  <span className={`sim-export-format sim-format-${format}`}>{exportingFormat === format ? '…' : format.toUpperCase()}</span>
                  <span><strong>{exportingFormat === format ? 'Membuat file…' : label}</strong><small>{sublabel}</small></span>
                  <Icon name="download" size={15} />
                </button>
              ))}
            </div>
            <p className="sim-export-hint">PDF dibuat lewat dialog cetak browser dan mengikuti tampilan tabel. Excel/DOCX/PDF menampilkan foto; CSV/JSON memuat data KTP lengkap termasuk NIK, dan JSON menyertakan foto. Bagikan file dengan hati-hati.</p>
          </section>
        </section>
      ) : (
        <section className="sim-roster-empty sim-screen-only">
          <div className="sim-empty-illustration"><span><Icon name="image" size={25} /></span><i>01</i><i>02</i><i>03</i></div>
          <h2>Rekapmu siap dimulai</h2>
          <p>Unggah beberapa KTP sekaligus. Setiap foto akan menjadi baris yang bisa diperiksa, diubah, dan diberi foto yang posisinya dapat kamu atur.</p>
          <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()} disabled={processing}>Pilih foto pertama</button>
        </section>
      )}

      <div className="sim-collective-footer sim-screen-only">
        <span><Icon name="warning" size={14} /> OCR hanya saran—cocokkan nama, NIK, dan SIM dengan KTP asli.</span>
        <span>Foto dikompres lokal. Hapus daftar setelah selesai jika perangkat dipakai bersama.</span>
      </div>

      {photoEditorPerson ? (
        <PhotoPositionEditor
          key={photoEditorPerson.id}
          person={photoEditorPerson}
          rowNumber={roster.findIndex((person) => person.id === photoEditorPerson.id) + 1}
          onClose={() => setPhotoEditorId('')}
          onSave={(changes) => savePhotoPosition(photoEditorPerson.id, changes)}
        />
      ) : null}
    </ToolShell>
  );
}
