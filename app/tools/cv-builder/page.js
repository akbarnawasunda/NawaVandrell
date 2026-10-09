'use client';

import { useEffect, useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Metric, Notice, Section, SectionHead, TextAreaField, TextField } from '@/components/Ui';
import { useToast } from '@/context/ToastContext';
import { downloadBlob, downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { printNvDocument } from '@/lib/printDoc.mjs';
import { formatMonthId } from '@/lib/format.mjs';
import { createLocalCollection } from '@/lib/localData.mjs';
import {
  CV_SECTION_LABELS,
  atsReport,
  bulletsOf,
  createCv,
  createCvDocxBlob,
  cvPlainText,
  emptyEducation,
  emptyExperience,
  sanitizeCv,
} from '@/lib/cvBuilder.mjs';

const store = createLocalCollection({ name: 'cv', version: 1, sanitize: sanitizeCv, maxItems: 1 });
const LEVEL_LABEL = { perbaiki: 'Perbaiki', info: 'Saran', ok: 'Sudah baik' };
const LEVEL_TONE = { perbaiki: 'is-bad', info: 'is-warn', ok: 'is-ok' };
const MONTH_HINT = 'Pilih bulan dan tahun. Hari tidak dipakai.';

function factory(listName) {
  return listName === 'pendidikan' ? emptyEducation() : emptyExperience();
}

function moveItem(list, index, delta) {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function MonthField({ id, label, value, onChange }) {
  return (
    <TextField id={id} type="month" label={label} value={value} onChange={onChange} hint={MONTH_HINT} />
  );
}

function CvPreview({ cv }) {
  const experiences = cv.pengalaman.filter((row) => row.posisi || row.perusahaan);
  const education = cv.pendidikan.filter((row) => row.institusi || row.jenjang);
  const skills = cv.keterampilan.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const certs = cv.sertifikat.split('\n').filter(Boolean);
  const contact = [cv.kota, cv.email, cv.telepon, cv.tautan].filter(Boolean).join(' | ');
  return (
    <div className="nv-print-sheet nv-cv-sheet">
      <h2 className="nv-cv-name">{cv.nama || 'Nama lengkap'}</h2>
      {cv.judulTarget ? <p className="nv-cv-target">{cv.judulTarget}</p> : null}
      {contact ? <p className="nv-cv-contact">{contact}</p> : null}
      {cv.ringkasan ? (
        <section><h3>{CV_SECTION_LABELS.ringkasan}</h3><p>{cv.ringkasan}</p></section>
      ) : null}
      {experiences.length ? (
        <section>
          <h3>{CV_SECTION_LABELS.pengalaman}</h3>
          {experiences.map((row) => {
            const period = [formatMonthId(row.mulai), row.sekarang ? 'Sekarang' : formatMonthId(row.selesai)].filter(Boolean).join(' – ');
            return (
              <article key={row.id} className="nv-cv-entry">
                <p className="nv-cv-entry-title"><strong>{row.posisi || 'Posisi'}</strong>{row.perusahaan ? ` — ${row.perusahaan}` : ''}{row.lokasi ? `, ${row.lokasi}` : ''}</p>
                {period ? <p className="nv-cv-period">{period}</p> : null}
                {bulletsOf(row).length ? <ul>{bulletsOf(row).map((item) => <li key={item}>{item}</li>)}</ul> : null}
              </article>
            );
          })}
        </section>
      ) : null}
      {education.length ? (
        <section>
          <h3>{CV_SECTION_LABELS.pendidikan}</h3>
          {education.map((row) => (
            <article key={row.id} className="nv-cv-entry">
              <p className="nv-cv-entry-title"><strong>{[row.jenjang, row.jurusan].filter(Boolean).join(' ') || 'Pendidikan'}</strong>{row.institusi ? ` — ${row.institusi}` : ''}</p>
              {formatMonthId(row.mulai) || formatMonthId(row.selesai) ? <p className="nv-cv-period">{[formatMonthId(row.mulai), formatMonthId(row.selesai)].filter(Boolean).join(' – ')}</p> : null}
            </article>
          ))}
        </section>
      ) : null}
      {skills.length ? <section><h3>{CV_SECTION_LABELS.keterampilan}</h3><p>{skills.join(', ')}</p></section> : null}
      {certs.length ? <section><h3>{CV_SECTION_LABELS.sertifikat}</h3><ul>{certs.map((c) => <li key={c}>{c}</li>)}</ul></section> : null}
      {cv.bahasa ? <section><h3>{CV_SECTION_LABELS.bahasa}</h3><p>{cv.bahasa}</p></section> : null}
    </div>
  );
}

export default function CvBuilderPage() {
  const { addToast } = useToast();
  const [cv, setCv] = useState(() => createCv());
  const [meta, setMeta] = useState({ available: true, corrupt: false, updatedAt: '' });
  const [saved, setSaved] = useState([]);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const loaded = store.load();
    setSaved(loaded.items);
    setMeta({ available: loaded.available, corrupt: loaded.corrupt, updatedAt: loaded.updatedAt });
    if (loaded.items[0]) setCv(loaded.items[0]);
    setReady(true);
  }, []);

  const report = useMemo(() => atsReport(cv), [cv]);
  const update = (field, value) => {
    setDirty(true);
    setCv((current) => ({ ...current, [field]: value }));
  };
  const updateRow = (listName, id, field, value) => {
    setDirty(true);
    setCv((current) => ({
      ...current,
      [listName]: current[listName].map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    }));
  };
  const addRow = (listName, factory, max = 8) => {
    if (cv[listName].length >= max) {
      addToast(`Maksimal ${max} baris untuk bagian ini.`, 'warning');
      return;
    }
    setDirty(true);
    setCv((current) => ({ ...current, [listName]: [...current[listName], factory()] }));
  };
  const removeRow = (listName, id) => {
    setDirty(true);
    setCv((current) => {
      const next = current[listName].filter((row) => row.id !== id);
      return { ...current, [listName]: next.length ? next : [factory(listName)] };
    });
  };
  const reorder = (listName, index, delta) => {
    setDirty(true);
    setCv((current) => ({ ...current, [listName]: moveItem(current[listName], index, delta) }));
  };

  const saveDraft = () => {
    try {
      const stamped = sanitizeCv({ ...cv, updatedAt: new Date().toISOString() });
      const clean = store.save([stamped]);
      setSaved(clean);
      setCv(clean[0]);
      setMeta((current) => ({ ...current, updatedAt: clean[0].updatedAt, corrupt: false }));
      setDirty(false);
      addToast('CV disimpan di perangkat ini.', 'success');
    } catch (error) {
      addToast(error.message, 'error', 6000);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(cvPlainText(cv));
      addToast('Teks CV tersalin. Tempel ke formulir lamaran.', 'success');
    } catch {
      addToast('Gagal menyalin. Unduh file .txt sebagai gantinya.', 'error');
    }
  };

  const downloadTxt = () => {
    downloadText(cvPlainText(cv), `${safeFileName(cv.nama || 'cv')}-cv.txt`, 'text/plain;charset=utf-8');
  };

  const downloadDocx = async () => {
    if (!cv.nama) {
      addToast('Isi nama lengkap dulu agar nama file dan dokumen jelas.', 'warning');
      return;
    }
    try {
      const blob = await createCvDocxBlob(cv);
      downloadBlob(blob, `${safeFileName(cv.nama)}-cv.docx`);
      addToast('DOCX diunduh.', 'success');
    } catch (error) {
      console.error('Gagal membuat DOCX CV:', error);
      addToast('DOCX belum bisa dibuat. Coba lagi.', 'error');
    }
  };

  const printPdf = () => {
    if (!cv.nama) addToast('Tip: isi nama lengkap agar judul PDF jelas.', 'info');
    const previous = document.title;
    document.title = safeFileName(cv.nama ? `${cv.nama}-cv` : 'cv');
    printNvDocument();
    window.setTimeout(() => { document.title = previous; }, 500);
  };

  const groups = ['perbaiki', 'info', 'ok'].map((level) => ({ level, items: report.checks.filter((c) => c.level === level) }));

  return (
    <ToolShell
      title="Pembuat CV & Cek ATS"
      desc="Susun CV satu kolom yang mudah dibaca mesin dan manusia. Periksa kelengkapannya, lalu cetak PDF, unduh DOCX, atau salin teks."
      icon="file"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="warn" title="Pemeriksa ATS hanya saran">
          Skor di bawah memeriksa format dan kelengkapan dengan aturan lokal. Ini tidak menjamin CV lolos sistem ATS
          atau seleksi perekrut. Data CV tidak dikirim ke AI atau server.
        </Notice>

        <div className="nv-actions" role="toolbar" aria-label="Aksi CV">
          <button type="button" className="btn btn-primary btn-sm" onClick={saveDraft} disabled={!meta.available}><Icon name="check" size={14} /> Simpan di perangkat{dirty ? ' *' : ''}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={printPdf}><Icon name="printer" size={14} /> Cetak / PDF</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={downloadDocx}><Icon name="download" size={14} /> Unduh DOCX</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyText}><Icon name="copy" size={14} /> Salin teks</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={downloadTxt}><Icon name="file" size={14} /> Unduh .txt</button>
        </div>

        <div className="nv-metrics">
          <Metric label="Skor kelengkapan (heuristik)" value={`${report.score}/100`} tone={report.score >= 80 ? 'strong' : report.score >= 60 ? 'warn' : 'danger'} hint="bukan skor ATS resmi" />
          <Metric label="Perlu diperbaiki" value={groups[0].items.length} tone={groups[0].items.length ? 'danger' : 'default'} />
          <Metric label="Kata" value={report.words} />
          <Metric label="Kata kunci posisi" value={report.keywords.total ? `${report.keywords.found.length}/${report.keywords.total}` : '-'} />
        </div>

        <div className="nv-grid-2 nv-cv-layout">
          <div className="nv-stack">
            <Section labelledBy="cv-identitas">
              <SectionHead id="cv-identitas" eyebrow="BAGIAN 1" title="Identitas dan kontak" />
              <div className="nv-grid-2">
                <TextField id="cv-nama" label="Nama lengkap" value={cv.nama} onChange={(v) => update('nama', v)} maxLength={80} required />
                <TextField id="cv-target" label="Posisi yang dituju" value={cv.judulTarget} onChange={(v) => update('judulTarget', v)} maxLength={120} placeholder="Contoh: Admin Keuangan" />
                <TextField id="cv-email" type="email" label="Email" value={cv.email} onChange={(v) => update('email', v)} maxLength={120} autoComplete="email" />
                <TextField id="cv-telepon" type="tel" label="Telepon / WhatsApp" value={cv.telepon} onChange={(v) => update('telepon', v)} maxLength={40} autoComplete="tel" placeholder="+62 812…" />
                <TextField id="cv-kota" label="Kota domisili" value={cv.kota} onChange={(v) => update('kota', v)} maxLength={80} />
                <TextField id="cv-tautan" label="Tautan profil (opsional)" value={cv.tautan} onChange={(v) => update('tautan', v)} maxLength={200} placeholder="linkedin.com/in/nama" />
              </div>
            </Section>

            <Section labelledBy="cv-ringkasan">
              <SectionHead id="cv-ringkasan" eyebrow="BAGIAN 2" title="Ringkasan" />
              <TextAreaField id="cv-ringkasan-teks" label="Ringkasan profesional" value={cv.ringkasan} onChange={(v) => update('ringkasan', v)} rows={4} maxLength={1200} hint="Dua sampai empat kalimat: siapa Anda, pengalaman utama, dan hasil yang paling penting." />
            </Section>

            <Section labelledBy="cv-pengalaman">
              <SectionHead id="cv-pengalaman" eyebrow="BAGIAN 3" title="Pengalaman kerja">
                Satu poin per baris, mulai dengan kata kerja, dan tambahkan angka bila ada.
              </SectionHead>
              {cv.pengalaman.map((row, index) => (
                <div className="nv-cv-card" key={row.id}>
                  <div className="nv-grid-2">
                    <TextField id={`cv-p-posisi-${row.id}`} label="Posisi" value={row.posisi} onChange={(v) => updateRow('pengalaman', row.id, 'posisi', v)} maxLength={120} />
                    <TextField id={`cv-p-perusahaan-${row.id}`} label="Perusahaan" value={row.perusahaan} onChange={(v) => updateRow('pengalaman', row.id, 'perusahaan', v)} maxLength={120} />
                    <TextField id={`cv-p-lokasi-${row.id}`} label="Lokasi (opsional)" value={row.lokasi} onChange={(v) => updateRow('pengalaman', row.id, 'lokasi', v)} maxLength={120} />
                    <label className="nv-check" htmlFor={`cv-p-now-${row.id}`}>
                      <input id={`cv-p-now-${row.id}`} type="checkbox" checked={row.sekarang} onChange={(event) => updateRow('pengalaman', row.id, 'sekarang', event.target.checked)} />
                      <span>Masih bekerja di sini</span>
                    </label>
                    <MonthField id={`cv-p-mulai-${row.id}`} label="Mulai" value={row.mulai} onChange={(v) => updateRow('pengalaman', row.id, 'mulai', v)} />
                    {!row.sekarang ? <MonthField id={`cv-p-selesai-${row.id}`} label="Selesai" value={row.selesai} onChange={(v) => updateRow('pengalaman', row.id, 'selesai', v)} /> : null}
                  </div>
                  <TextAreaField id={`cv-p-poin-${row.id}`} label="Poin tugas dan pencapaian" value={row.poin} onChange={(v) => updateRow('pengalaman', row.id, 'poin', v)} rows={4} maxLength={3000} placeholder={'Menyusun laporan bulanan untuk 3 cabang\nMengurangi selisih kas 40% dalam setahun'} />
                  <div className="nv-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => reorder('pengalaman', index, -1)} disabled={index === 0} aria-label={`Naik: pengalaman nomor ${index + 1}`}>Naik</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => reorder('pengalaman', index, 1)} disabled={index === cv.pengalaman.length - 1} aria-label={`Turun: pengalaman nomor ${index + 1}`}>Turun</button>
                    <button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={() => removeRow('pengalaman', row.id)} aria-label={`Hapus pengalaman nomor ${index + 1}`}><Icon name="trash" size={14} /> Hapus</button>
                  </div>
                </div>
              ))}
              <div className="nv-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => addRow('pengalaman', emptyExperience)}><Icon name="plus" size={14} /> Tambah pengalaman</button>
              </div>
            </Section>

            <Section labelledBy="cv-pendidikan">
              <SectionHead id="cv-pendidikan" eyebrow="BAGIAN 4" title="Pendidikan" />
              {cv.pendidikan.map((row, index) => (
                <div className="nv-cv-card" key={row.id}>
                  <div className="nv-grid-2">
                    <TextField id={`cv-d-jenjang-${row.id}`} label="Jenjang" value={row.jenjang} onChange={(v) => updateRow('pendidikan', row.id, 'jenjang', v)} maxLength={80} placeholder="Contoh: S1" />
                    <TextField id={`cv-d-institusi-${row.id}`} label="Institusi" value={row.institusi} onChange={(v) => updateRow('pendidikan', row.id, 'institusi', v)} maxLength={120} />
                    <TextField id={`cv-d-jurusan-${row.id}`} label="Jurusan" value={row.jurusan} onChange={(v) => updateRow('pendidikan', row.id, 'jurusan', v)} maxLength={120} />
                    <MonthField id={`cv-d-mulai-${row.id}`} label="Mulai" value={row.mulai} onChange={(v) => updateRow('pendidikan', row.id, 'mulai', v)} />
                    <MonthField id={`cv-d-selesai-${row.id}`} label="Selesai" value={row.selesai} onChange={(v) => updateRow('pendidikan', row.id, 'selesai', v)} />
                  </div>
                  <div className="nv-actions">
                    <button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={() => removeRow('pendidikan', row.id)} aria-label={`Hapus pendidikan nomor ${index + 1}`}><Icon name="trash" size={14} /> Hapus</button>
                  </div>
                </div>
              ))}
              <div className="nv-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => addRow('pendidikan', emptyEducation, 5)}><Icon name="plus" size={14} /> Tambah pendidikan</button>
              </div>
            </Section>

            <Section labelledBy="cv-lain">
              <SectionHead id="cv-lain" eyebrow="BAGIAN 5" title="Keterampilan, sertifikat, dan bahasa" />
              <TextAreaField id="cv-keterampilan" label="Keterampilan" value={cv.keterampilan} onChange={(v) => update('keterampilan', v)} rows={2} maxLength={800} hint="Pisahkan dengan koma. Contoh: Excel, Accurate, pelayanan pelanggan." />
              <TextAreaField id="cv-sertifikat" label="Sertifikat atau pelatihan (satu per baris)" value={cv.sertifikat} onChange={(v) => update('sertifikat', v)} rows={2} maxLength={1500} />
              <TextField id="cv-bahasa" label="Bahasa" value={cv.bahasa} onChange={(v) => update('bahasa', v)} maxLength={200} placeholder="Indonesia (native), Inggris (aktif)" />
            </Section>
          </div>

          <div className="nv-stack nv-cv-side">
            <Section labelledBy="cv-ats">
              <SectionHead id="cv-ats" eyebrow="PEMERIKSA" title="Cek keterbacaan ATS">
                Daftar ini menunjukkan apa yang perlu diperbaiki dan apa yang sudah baik.
              </SectionHead>
              <div className="nv-bar" role="img" aria-label={`Skor kelengkapan ${report.score} dari 100`}>
                <i style={{ width: `${report.score}%` }} />
              </div>
              {groups.map((group) => group.items.length ? (
                <div key={group.level} className="nv-check-group">
                  <p className="nv-eyebrow">{LEVEL_LABEL[group.level]}</p>
                  <ul className="nv-plain-list nv-check-list">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <span className={`nv-tag ${LEVEL_TONE[group.level]}`}>{LEVEL_LABEL[group.level]}</span>{' '}
                        <strong>{item.title}.</strong> <span className="nv-muted">{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null)}
              {report.keywords.missing.length ? (
                <p className="nv-muted">Kata dari posisi target yang belum ada di CV: <strong>{report.keywords.missing.join(', ')}</strong>.</p>
              ) : null}
              <p className="hint">{report.disclaimer}</p>
            </Section>

            <Section labelledBy="cv-pratinjau">
              <SectionHead id="cv-pratinjau" eyebrow="PRATINJAU" title="Tampilan CV" />
              <div className="nv-print-area">
                <CvPreview cv={cv} />
              </div>
            </Section>
          </div>
        </div>

        {ready ? (
          <LocalDataPanel
            title="Cadangan CV"
            store={store}
            items={saved}
            setItems={(items) => { setSaved(items); if (items[0]) setCv(items[0]); else setCv(createCv()); }}
            corrupt={meta.corrupt}
            available={meta.available}
            updatedAt={meta.updatedAt}
            fileBase="cv"
          />
        ) : null}
      </div>
    </ToolShell>
  );
}
