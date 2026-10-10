'use client';

import { useEffect, useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { Notice, Section, SectionHead, TextAreaField, TextField } from '@/components/Ui';
import { useToast } from '@/context/ToastContext';
import { downloadBlob, downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { runDownloadTask } from '@/lib/downloadTask.mjs';
import { printNvDocument } from '@/lib/printDoc.mjs';
import { todayIso } from '@/lib/format.mjs';
import { createLocalCollection } from '@/lib/localData.mjs';
import { sanitizeCv } from '@/lib/cvBuilder.mjs';
import {
  COMMON_FIELDS,
  LETTER_FIELDS,
  LETTER_TEMPLATES,
  buildLetter,
  createLetterDocxBlob,
  emptyLetterValues,
  letterPlainText,
  letterValuesFromCv,
} from '@/lib/letterTemplates.mjs';

// Hanya dibaca: mengambil data CV yang sudah tersimpan di perangkat ini, tanpa mengubahnya.
const cvStore = createLocalCollection({ name: 'cv', version: 1, sanitize: sanitizeCv, maxItems: 1 });

function FieldInput({ field, value, onChange }) {
  const id = `surat-${field.key}`;
  const label = `${field.label}${field.required ? ' *' : ''}`;
  if (field.type === 'textarea') {
    return <TextAreaField id={id} label={label} value={value} onChange={onChange} hint={field.hint} rows={3} maxLength={1000} />;
  }
  return <TextField id={id} type={field.type || 'text'} label={label} value={value} onChange={onChange} hint={field.hint} maxLength={field.type === 'date' ? undefined : 300} required={Boolean(field.required)} />;
}

export default function SuratPage() {
  const { addToast } = useToast();
  const [templateId, setTemplateId] = useState('lamaran');
  const [values, setValues] = useState(() => emptyLetterValues());
  const [fromCv, setFromCv] = useState(false);
  const [cvAvailable, setCvAvailable] = useState(false);

  useEffect(() => {
    const loaded = cvStore.load();
    setCvAvailable(loaded.items.length > 0);
    setValues((current) => (current.tanggal ? current : { ...current, tanggal: todayIso() }));
  }, []);

  const template = LETTER_TEMPLATES.find((item) => item.id === templateId) || LETTER_TEMPLATES[0];
  const fields = [...COMMON_FIELDS, ...(LETTER_FIELDS[templateId] || [])];
  const result = useMemo(() => buildLetter(templateId, values), [templateId, values]);
  const doc = result.doc;

  const setValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const fillFromCv = () => {
    const loaded = cvStore.load();
    const cv = loaded.items[0];
    if (!cv) {
      addToast('Belum ada CV tersimpan di perangkat ini. Buat dulu di Pembuat CV.', 'warning', 5200);
      return;
    }
    const picked = letterValuesFromCv(cv);
    setValues((current) => ({ ...current, ...Object.fromEntries(Object.entries(picked).filter(([, v]) => v)) }));
    setFromCv(true);
    addToast('Data dari CV tersimpan diisikan. Periksa sebelum mencetak.', 'success', 5200);
  };

  const copyText = async () => {
    if (!doc) {
      addToast('Lengkapi data wajib dulu.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(letterPlainText(doc));
      addToast('Teks surat tersalin.', 'success');
    } catch {
      addToast('Gagal menyalin. Unduh .txt sebagai gantinya.', 'error');
    }
  };

  const downloadTxt = () => {
    if (!doc) return;
    downloadText(letterPlainText(doc), `${safeFileName(template.label)}.txt`, 'text/plain;charset=utf-8');
  };

  const downloadDocx = () => {
    if (!doc) {
      addToast('Lengkapi data wajib dulu.', 'warning');
      return;
    }
    const fname = `${safeFileName(template.label)}.docx`;
    runDownloadTask('Menyiapkan file DOCX surat…', async () => {
      const blob = await createLetterDocxBlob(doc);
      downloadBlob(blob, fname);
    }, fname).then(
      () => addToast('DOCX diunduh.', 'success'),
      (error) => {
        console.error('Gagal membuat DOCX surat:', error);
        addToast('DOCX belum bisa dibuat. Coba lagi.', 'error');
      },
    );
  };

  const printPdf = () => {
    if (!doc) {
      addToast('Lengkapi data wajib dulu sebelum mencetak.', 'warning');
      return;
    }
    printNvDocument();
  };

  return (
    <ToolShell
      title="Pembuat Surat Lamaran & Resmi"
      desc="Surat lamaran kerja dan template surat administrasi. Isi data, periksa pratinjau, lalu cetak atau unduh."
      icon="mail"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="info" title="Tidak ada data yang disimpan">
          Surat dibuat di perangkat ini dan tidak disimpan. Unduh atau cetak sebelum menutup halaman bila perlu.
          Periksa ulang nama, tanggal, dan isi sebelum dikirim.
        </Notice>

        <Section labelledBy="surat-jenis">
          <SectionHead id="surat-jenis" eyebrow="LANGKAH 1" title="Pilih jenis surat" />
          <div className="nv-chip-group" role="group" aria-label="Jenis surat">
            {LETTER_TEMPLATES.map((item) => (
              <button key={item.id} type="button" className="chip" aria-pressed={templateId === item.id} onClick={() => setTemplateId(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          {cvAvailable && (templateId === 'lamaran' || templateId === 'kuasa') ? (
            <div className="nv-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={fillFromCv}><Icon name="file" size={14} /> Isi dari CV tersimpan</button>
              {fromCv ? <span className="nv-muted">Diisi dari CV. Ubah bila perlu.</span> : null}
            </div>
          ) : null}
        </Section>

        <Section labelledBy="surat-isi">
          <SectionHead id="surat-isi" eyebrow="LANGKAH 2" title={`Isi data: ${template.label}`}>
            Tanda bintang (*) menandakan data wajib. Kolom yang sama tetap terisi saat Anda berpindah jenis surat.
          </SectionHead>
          <div className="nv-grid-2">
            {fields.map((field) => (
              <FieldInput key={field.key} field={field} value={values[field.key] ?? ''} onChange={(v) => setValue(field.key, v)} />
            ))}
          </div>
          {templateId === 'pernyataan' ? (
            <label className="nv-check" htmlFor="surat-tanggung-jawab">
              <input id="surat-tanggung-jawab" type="checkbox" checked={values.tanggungJawab} onChange={(event) => setValue('tanggungJawab', event.target.checked)} />
              <span>Sertakan kalimat tanggung jawab di akhir pernyataan</span>
            </label>
          ) : null}
        </Section>

        <div className="nv-actions" role="toolbar" aria-label="Aksi surat">
          <button type="button" className="btn btn-primary btn-sm" onClick={printPdf} disabled={!doc}><Icon name="printer" size={14} /> Cetak / PDF</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={downloadDocx} disabled={!doc}><Icon name="download" size={14} /> Unduh DOCX</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyText} disabled={!doc}><Icon name="copy" size={14} /> Salin teks</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={downloadTxt} disabled={!doc}><Icon name="file" size={14} /> Unduh .txt</button>
        </div>

        {result.errors.length ? (
          <Notice kind="warn" title="Lengkapi data berikut">
            <ul className="nv-plain-list">{result.errors.slice(0, 8).map((text) => <li key={text}>{text}</li>)}</ul>
          </Notice>
        ) : null}

        <Section labelledBy="surat-pratinjau">
          <SectionHead id="surat-pratinjau" eyebrow="PRATINJAU" title="Tampilan surat">
            Ini yang akan tercetak atau diunduh.
          </SectionHead>
          {doc ? (
            <div className="nv-print-area">
              <div className="nv-print-sheet nv-letter-sheet">
                {doc.judul ? <h2 className="nv-letter-title">{doc.judul}</h2> : null}
                {doc.pembuka.map((block, index) => <div key={index} className="nv-letter-block">{block.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div>)}
                {doc.paragraphs.map((paragraph, index) => <div key={index} className="nv-letter-block">{paragraph.split('\n').map((line, i) => <p key={i}>{line || '\u00a0'}</p>)}</div>)}
                {doc.penutup ? <p className="nv-letter-block">{doc.penutup}</p> : null}
                {templateId !== 'lamaran' ? <p>{doc.tempatTanggal}</p> : null}
                <div className="nv-letter-signs">
                  {doc.tandaTangan.map((signer) => (
                    <div key={signer.label}>
                      <p>{signer.label}</p>
                      <div className="nv-letter-space" />
                      <p><strong>{signer.nama || '(nama)'}</strong></p>
                      {signer.jabatan ? <p>{signer.jabatan}</p> : null}
                    </div>
                  ))}
                </div>
                {doc.lampiran.length ? (
                  <div className="nv-letter-block"><p><strong>Lampiran:</strong></p><ul>{doc.lampiran.map((item) => <li key={item}>{item}</li>)}</ul></div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="nv-muted">Pratinjau muncul setelah data wajib lengkap.</p>
          )}
          {doc && doc.catatan?.length ? doc.catatan.map((note) => <p key={note} className="hint">{note}</p>) : null}
        </Section>
      </div>
    </ToolShell>
  );
}
