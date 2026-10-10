'use client';

import { useEffect, useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Metric, NumberField, Notice, Section, SectionHead, SelectField, TextAreaField, TextField } from '@/components/Ui';
import { useToast } from '@/context/ToastContext';
import { downloadBlob, downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { runDownloadTask } from '@/lib/downloadTask.mjs';
import { printNvDocument } from '@/lib/printDoc.mjs';
import { formatDateId, todayIso } from '@/lib/format.mjs';
import { createLocalCollection, newId } from '@/lib/localData.mjs';
import {
  ATTENDANCE_STATUS,
  MAX_PARTICIPANTS,
  certificateData,
  certificateRecipients,
  createEvent,
  parseParticipants,
  rosterCsv,
  rosterXlsxBlob,
  sanitizeEvent,
  summarizeEvent,
} from '@/lib/attendance.mjs';

const store = createLocalCollection({ name: 'daftar-hadir', version: 1, sanitize: sanitizeEvent, maxItems: 30 });

function Certificate({ data }) {
  return (
    <div className="nv-cert-page">
      <h2>{data.judul}</h2>
      <p>Diberikan kepada</p>
      <p className="nv-cert-name">{data.nama}</p>
      <p>{data.keterangan}</p>
      <p><strong>{data.acara}</strong></p>
      <p>{[data.tempat, data.tanggal].filter(Boolean).join(', ')}</p>
      {data.nomor ? <p className="nv-cert-nomor">Nomor: {data.nomor}</p> : null}
      <div className="nv-cert-sign">
        <div>
          {data.penandatangan ? <b>{data.penandatangan}</b> : <b>(nama penandatangan)</b>}
          {data.jabatan ? <span>{data.jabatan}</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function DaftarHadirPage() {
  const { addToast } = useToast();
  const [events, setEvents] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [meta, setMeta] = useState({ available: true, corrupt: false, updatedAt: '' });
  const [ready, setReady] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [printMode, setPrintMode] = useState('');
  const [cert, setCert] = useState({ judul: 'SERTIFIKAT KEHADIRAN', penandatangan: '', jabatan: '', tanggal: '', keterangan: '', mulaiNomor: '1' });

  useEffect(() => {
    const loaded = store.load();
    setEvents(loaded.items);
    setMeta({ available: loaded.available, corrupt: loaded.corrupt, updatedAt: loaded.updatedAt });
    setActiveId(loaded.items[0]?.id || '');
    setReady(true);
  }, []);

  useEffect(() => {
    const done = () => setPrintMode('');
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  const active = events.find((e) => e.id === activeId) || null;
  const summary = useMemo(() => (active ? summarizeEvent(active) : null), [active]);
  const recipients = useMemo(() => (active ? certificateRecipients(active) : []), [active]);

  const persist = (next) => {
    try {
      setEvents(store.save(next));
      return true;
    } catch (error) {
      addToast(error.message, 'error', 6000);
      return false;
    }
  };

  const updateActive = (mutate) => {
    if (!active) return;
    persist(events.map((e) => (e.id === active.id ? mutate(e) : e)));
  };

  const createNewEvent = () => {
    if (events.length >= 30) {
      addToast('Batas 30 kegiatan per perangkat. Hapus kegiatan lama dulu.', 'warning');
      return;
    }
    const fresh = { ...createEvent(), id: newId('acara') };
    if (persist([fresh, ...events])) {
      setActiveId(fresh.id);
      addToast('Kegiatan baru dibuat. Isi nama dan tanggalnya.', 'success');
    }
  };

  const deleteEvent = () => {
    if (!active) return;
    if (!window.confirm(`Hapus kegiatan “${active.nama || 'tanpa nama'}” dan seluruh daftar pesertanya dari perangkat ini?`)) return;
    persist(events.filter((e) => e.id !== active.id));
    setActiveId('');
  };

  const addParticipants = () => {
    if (!active) return;
    const { peserta, skipped } = parseParticipants(pasteText);
    if (!peserta.length) {
      addToast('Tulis satu nama per baris.', 'warning');
      return;
    }
    const room = MAX_PARTICIPANTS - active.peserta.length;
    const added = peserta.slice(0, Math.max(0, room)).map((p) => ({ id: newId('peserta'), nama: p.nama, kontak: p.kontak, status: 'terdaftar', catatan: '' }));
    updateActive((e) => ({ ...e, peserta: [...e.peserta, ...added] }));
    setPasteText('');
    addToast(`${added.length} peserta ditambahkan${skipped ? `, ${skipped} baris kosong dilewati` : ''}.`, 'success');
  };

  const setStatus = (id, status) => updateActive((e) => ({ ...e, peserta: e.peserta.map((p) => (p.id === id ? { ...p, status } : p)) }));
  const setNote = (id, catatan) => updateActive((e) => ({ ...e, peserta: e.peserta.map((p) => (p.id === id ? { ...p, catatan } : p)) }));
  const removeParticipant = (id) => updateActive((e) => ({ ...e, peserta: e.peserta.filter((p) => p.id !== id) }));
  const markAll = (status) => updateActive((e) => ({ ...e, peserta: e.peserta.map((p) => ({ ...p, status })) }));

  const downloadCsv = () => {
    if (!active?.peserta.length) return;
    downloadText(rosterCsv(active), `${safeFileName(active.nama || 'daftar-hadir')}.csv`, 'text/csv;charset=utf-8');
  };

  const downloadXlsx = () => {
    if (!active?.peserta.length) return;
    const fname = `${safeFileName(active.nama || 'daftar-hadir')}.xlsx`;
    runDownloadTask('Menyiapkan file Excel daftar hadir…', async () => {
      const blob = await rosterXlsxBlob(active);
      downloadBlob(blob, fname);
    }, fname).then(
      () => addToast('Excel daftar hadir diunduh.', 'success'),
      (error) => {
        console.error('Gagal membuat Excel daftar hadir:', error);
        addToast('Excel belum bisa dibuat. Coba lagi.', 'error');
      },
    );
  };

  const printWith = (mode) => {
    if (mode === 'sertifikat' && !recipients.length) {
      addToast('Belum ada peserta berstatus “Hadir”. Tandai kehadiran dulu.', 'warning', 5200);
      return;
    }
    setPrintMode(mode);
    window.setTimeout(() => printNvDocument(), 80);
  };

  const sampleCert = recipients[0] ? certificateData(active, recipients[0], { ...cert, nomor: cert.mulaiNomor ? `${cert.mulaiNomor}`.padStart(3, '0') : '' }) : null;

  return (
    <ToolShell
      title="Daftar Hadir & Sertifikat"
      desc="Catat peserta dan kehadiran kegiatan, ekspor daftar ke Excel atau CSV, dan cetak sertifikat untuk yang hadir."
      icon="users"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="info" title="Data kegiatan hanya di perangkat ini">
          Nama peserta tidak dikirim ke server. Sertifikat dibuat di browser. Gunakan panel cadangan untuk berpindah perangkat.
        </Notice>

        <Section labelledBy="hadir-kegiatan">
          <SectionHead id="hadir-kegiatan" eyebrow="LANGKAH 1" title="Kegiatan">
            Buat satu kegiatan untuk setiap acara, lalu isi daftar peserta.
          </SectionHead>
          <div className="nv-grid-2">
            <SelectField id="hadir-pilih" label="Kegiatan aktif" value={activeId} onChange={setActiveId} options={events.length ? events.map((e) => ({ value: e.id, label: `${e.nama || 'Tanpa nama'}${e.tanggal ? ` · ${formatDateId(e.tanggal)}` : ''}` })) : [{ value: '', label: 'Belum ada kegiatan' }]} />
            <div className="nv-field">
              <span className="label" aria-hidden="true">&nbsp;</span>
              <button type="button" className="btn btn-primary" onClick={createNewEvent} disabled={!meta.available}><Icon name="plus" size={15} /> Kegiatan baru</button>
            </div>
          </div>
          {active ? (
            <>
              <div className="nv-grid-2">
                <TextField id="hadir-nama" label="Nama kegiatan" value={active.nama} onChange={(v) => updateActive((e) => ({ ...e, nama: v }))} maxLength={160} placeholder="Contoh: Pelatihan Pertolongan Pertama" />
                <TextField id="hadir-tanggal" type="date" label="Tanggal" value={active.tanggal} onChange={(v) => updateActive((e) => ({ ...e, tanggal: v }))} />
                <TextField id="hadir-tempat" label="Tempat" value={active.tempat} onChange={(v) => updateActive((e) => ({ ...e, tempat: v }))} maxLength={160} />
                <TextField id="hadir-penyelenggara" label="Penyelenggara" value={active.penyelenggara} onChange={(v) => updateActive((e) => ({ ...e, penyelenggara: v }))} maxLength={160} />
              </div>
              <div className="nv-actions">
                <button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={deleteEvent}><Icon name="trash" size={14} /> Hapus kegiatan ini</button>
              </div>
            </>
          ) : null}
        </Section>

        {active ? (
          <>
            <Section labelledBy="hadir-peserta">
              <SectionHead id="hadir-peserta" eyebrow="LANGKAH 2" title="Peserta dan kehadiran">
                Tempel daftar nama (satu per baris, boleh diberi kontak setelah koma). Ubah status langsung di tabel.
              </SectionHead>
              <TextAreaField id="hadir-tempel" label="Tempel daftar peserta" value={pasteText} onChange={setPasteText} rows={3} maxLength={20000} placeholder={'Ani Wijaya, 0812-0000-0001\nBudi Santoso'} />
              <div className="nv-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={addParticipants} disabled={!pasteText.trim()}><Icon name="upload" size={14} /> Tambahkan peserta</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => markAll('hadir')} disabled={!active.peserta.length}>Tandai semua hadir</button>
              </div>

              <div className="nv-metrics">
                <Metric label="Peserta" value={summary.total} />
                <Metric label="Hadir" value={summary.hadir} tone="strong" hint={`${summary.persenHadir}% dari peserta`} />
                <Metric label="Izin" value={summary.izin} />
                <Metric label="Tidak hadir" value={summary.tidakHadir} />
              </div>
              {summary.duplicates.length ? (
                <Notice kind="warn" title="Ada nama ganda">Periksa: {summary.duplicates.join(', ')}. Hapus salah satu bila itu orang yang sama.</Notice>
              ) : null}

              {active.peserta.length ? (
                <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
                  <table className="nv-table">
                    <caption className="nv-sr-only">Daftar peserta dan status kehadiran</caption>
                    <thead><tr><th scope="col">No</th><th scope="col">Nama &amp; kontak</th><th scope="col">Status</th><th scope="col">Catatan</th><th scope="col"><span className="nv-sr-only">Aksi</span></th></tr></thead>
                    <tbody>
                      {active.peserta.map((p, index) => (
                        <tr key={p.id}>
                          <td>{index + 1}</td>
                          <td><strong>{p.nama}</strong>{p.kontak ? <div className="nv-muted">{p.kontak}</div> : null}</td>
                          <td>
                            <label className="nv-sr-only" htmlFor={`hadir-status-${p.id}`}>Status {p.nama}</label>
                            <select id={`hadir-status-${p.id}`} className="select nv-compact-select" value={p.status} onChange={(event) => setStatus(p.id, event.target.value)}>
                              {ATTENDANCE_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </td>
                          <td>
                            <label className="nv-sr-only" htmlFor={`hadir-catatan-${p.id}`}>Catatan {p.nama}</label>
                            <input id={`hadir-catatan-${p.id}`} className="input nv-compact-input" value={p.catatan} maxLength={300} onChange={(event) => setNote(p.id, event.target.value)} placeholder="Catatan" />
                          </td>
                          <td><button type="button" className="nv-icon-button is-danger" onClick={() => removeParticipant(p.id)} aria-label={`Hapus ${p.nama}`}><Icon name="trash" size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="nv-muted">Belum ada peserta. Tempel daftar nama di atas.</p>}

              <div className="nv-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={downloadCsv} disabled={!active.peserta.length}><Icon name="download" size={14} /> Unduh CSV</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={downloadXlsx} disabled={!active.peserta.length}><Icon name="download" size={14} /> Unduh Excel (dengan kolom tanda tangan)</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => printWith('daftar')} disabled={!active.peserta.length}><Icon name="printer" size={14} /> Cetak daftar hadir</button>
              </div>
            </Section>

            <Section labelledBy="hadir-sertifikat">
              <SectionHead id="hadir-sertifikat" eyebrow="LANGKAH 3" title="Sertifikat untuk yang hadir">
                Sertifikat dibuat untuk peserta berstatus “Hadir” ({recipients.length} orang). Satu sertifikat per halaman.
              </SectionHead>
              <div className="nv-grid-2">
                <TextField id="cert-judul" label="Judul sertifikat" value={cert.judul} onChange={(v) => setCert((c) => ({ ...c, judul: v }))} maxLength={100} />
                <TextField id="cert-tanggal" type="date" label="Tanggal sertifikat (opsional)" value={cert.tanggal} onChange={(v) => setCert((c) => ({ ...c, tanggal: v }))} hint="Kosong berarti memakai tanggal kegiatan." />
                <TextField id="cert-ttd" label="Nama penandatangan" value={cert.penandatangan} onChange={(v) => setCert((c) => ({ ...c, penandatangan: v }))} maxLength={120} />
                <TextField id="cert-jabatan" label="Jabatan penandatangan" value={cert.jabatan} onChange={(v) => setCert((c) => ({ ...c, jabatan: v }))} maxLength={120} />
                <TextField id="cert-keterangan" label="Keterangan (opsional)" value={cert.keterangan} onChange={(v) => setCert((c) => ({ ...c, keterangan: v }))} maxLength={240} placeholder="Telah mengikuti kegiatan di atas dengan baik." />
                <NumberField id="cert-nomor" label="Nomor awal sertifikat (opsional)" value={cert.mulaiNomor} onChange={(v) => setCert((c) => ({ ...c, mulaiNomor: v }))} hint="Nomor diberi awalan 3 digit; kosongkan bila tidak perlu." />
              </div>
              {sampleCert ? (
                <div className="nv-cert-preview" aria-label="Contoh sertifikat">
                  <p className="nv-muted">Contoh untuk {recipients[0].nama}:</p>
                  <Certificate data={sampleCert} />
                </div>
              ) : null}
              <div className="nv-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => printWith('sertifikat')} disabled={!recipients.length}><Icon name="printer" size={14} /> Cetak sertifikat ({recipients.length})</button>
              </div>
            </Section>

            <div className="nv-print-area">
              {printMode === 'daftar' ? (
                <div className="nv-print-sheet">
                  <h2>{active.nama || 'Daftar hadir'}</h2>
                  <p>{[formatDateId(active.tanggal), active.tempat].filter(Boolean).join(' · ')}</p>
                  <table>
                    <thead><tr><th>No</th><th>Nama</th><th>Status</th><th>Tanda tangan</th></tr></thead>
                    <tbody>
                      {active.peserta.map((p, i) => (
                        <tr key={p.id}><td>{i + 1}</td><td>{p.nama}</td><td>{ATTENDANCE_STATUS.find((s) => s.value === p.status)?.label}</td><td style={{ height: 30 }} /></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {printMode === 'sertifikat' ? recipients.map((p, i) => (
                <Certificate key={p.id} data={certificateData(active, p, { ...cert, nomor: cert.mulaiNomor ? `${Number(cert.mulaiNomor) + i}`.padStart(3, '0') : '' })} />
              )) : null}
            </div>
          </>
        ) : null}

        {meta.corrupt ? <Notice kind="bad" title="Data tidak terbaca">Data lama tidak diubah. Gunakan panel cadangan untuk mengekspor atau menghapusnya.</Notice> : null}

        {ready ? (
          <LocalDataPanel
            title="Cadangan kegiatan dan daftar hadir"
            store={store}
            items={events}
            setItems={(items) => { setEvents(items); setActiveId((id) => (items.some((e) => e.id === id) ? id : items[0]?.id || '')); }}
            corrupt={meta.corrupt}
            available={meta.available}
            updatedAt={meta.updatedAt}
            fileBase="daftar-hadir"
          />
        ) : null}
        <p className="hint nv-no-print">Tanggal hari ini: {formatDateId(todayIso())}. Sertifikat hanya contoh format; tanda tangan asli tetap diperlukan bila dibutuhkan.</p>
      </div>
    </ToolShell>
  );
}
