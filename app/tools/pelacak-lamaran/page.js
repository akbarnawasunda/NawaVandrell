'use client';

import { useEffect, useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import LocalDataPanel from '@/components/LocalDataPanel';
import { ErrorList, Metric, Notice, Section, SectionHead, SelectField, TextAreaField, TextField } from '@/components/NvUi';
import { useToast } from '@/context/ToastContext';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { formatDateId, todayIso } from '@/lib/format.mjs';
import { createLocalCollection } from '@/lib/localData.mjs';
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  applicationsCsv,
  buildFollowUpIcs,
  createApplication,
  followUpState,
  isClosedStatus,
  sanitizeApplication,
  sortApplications,
  statusLabel,
  summarizeApplications,
  validateApplication,
} from '@/lib/jobApplications.mjs';

const NOTIFIED_KEY = 'nawa:v1:lamaran-notif';
const store = createLocalCollection({ name: 'lamaran', version: 1, sanitize: sanitizeApplication, maxItems: 500, auxKeys: [NOTIFIED_KEY] });

const FOLLOW_UP_LABEL = {
  terlambat: 'Terlambat',
  'hari-ini': 'Hari ini',
  segera: 'Dalam 3 hari',
  nanti: 'Nanti',
  tanpa: 'Belum dijadwalkan',
  selesai: 'Selesai',
};

const FOLLOW_UP_TONE = {
  terlambat: 'is-bad',
  'hari-ini': 'is-warn',
  segera: 'is-warn',
  nanti: '',
  tanpa: '',
  selesai: 'is-ok',
};

function readNotified() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeNotified(value) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(value));
  } catch {
    /* penyimpanan penuh atau ditolak: pengingat tetap berjalan tanpa penanda */
  }
}

function ApplicationForm({ draft, onChange, errors, onSave, onCancel, isNew }) {
  return (
    <Section labelledBy="lamaran-form-title">
      <SectionHead id="lamaran-form-title" eyebrow={isNew ? 'LAMARAN BARU' : 'UBAH LAMARAN'} title={isNew ? 'Tambah lamaran' : `Ubah: ${draft.posisi || 'lamaran'}`}>
        Isi posisi dan perusahaan. Tanggal tindak lanjut akan muncul sebagai pengingat.
      </SectionHead>
      <ErrorList errors={errors} />
      <div className="nv-grid-2">
        <TextField id="lamaran-posisi" label="Posisi yang dilamar" value={draft.posisi} onChange={(v) => onChange('posisi', v)} maxLength={120} required placeholder="Contoh: Admin Gudang" />
        <TextField id="lamaran-perusahaan" label="Perusahaan" value={draft.perusahaan} onChange={(v) => onChange('perusahaan', v)} maxLength={120} required placeholder="Contoh: PT Sejahtera Abadi" />
        <TextField id="lamaran-lokasi" label="Lokasi kerja (opsional)" value={draft.lokasi} onChange={(v) => onChange('lokasi', v)} maxLength={120} placeholder="Kota atau remote" />
        <SelectField id="lamaran-sumber" label="Sumber lowongan" value={draft.sumber} onChange={(v) => onChange('sumber', v)} options={APPLICATION_SOURCES} />
        <SelectField id="lamaran-status" label="Status" value={draft.status} onChange={(v) => onChange('status', v)} options={APPLICATION_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
        <TextField id="lamaran-gaji" label="Rentang gaji (opsional)" value={draft.gaji} onChange={(v) => onChange('gaji', v)} maxLength={120} placeholder="Contoh: 4–5 juta" />
        <TextField id="lamaran-tanggal" type="date" label="Tanggal melamar" value={draft.tanggalLamar} onChange={(v) => onChange('tanggalLamar', v)} />
        <TextField id="lamaran-followup" type="date" label="Tanggal tindak lanjut" value={draft.tindakLanjut} onChange={(v) => onChange('tindakLanjut', v)} hint="Misalnya seminggu setelah melamar, atau tanggal yang dijanjikan HRD." />
        <TextField id="lamaran-link" label="Tautan lowongan (opsional)" value={draft.link} onChange={(v) => onChange('link', v)} maxLength={400} inputMode="url" placeholder="https://…" />
      </div>
      <TextAreaField id="lamaran-catatan" label="Catatan" value={draft.catatan} onChange={(v) => onChange('catatan', v)} rows={3} maxLength={1000} placeholder="Nama PIC, hasil telepon, persyaratan yang perlu disiapkan…" />
      <div className="nv-actions">
        <button type="button" className="btn btn-primary" onClick={onSave}><Icon name="check" size={15} /> Simpan lamaran</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Batal</button>
      </div>
    </Section>
  );
}

export default function PelacakLamaranPage() {
  const { addToast } = useToast();
  const [apps, setApps] = useState([]);
  const [meta, setMeta] = useState({ available: true, corrupt: false, updatedAt: '' });
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(null); // { draft, isNew }
  const [errors, setErrors] = useState([]);
  const [filter, setFilter] = useState('aktif');
  const [query, setQuery] = useState('');
  // Tanggal dan dukungan notifikasi hanya dihitung di browser (setelah mount) agar hasil SSR tidak berbeda.
  const [today, setToday] = useState('');
  const [notifyState, setNotifyState] = useState('unsupported');

  useEffect(() => {
    const loaded = store.load();
    setApps(loaded.items);
    setMeta({ available: loaded.available, corrupt: loaded.corrupt, updatedAt: loaded.updatedAt });
    setToday(todayIso());
    setReady(true);
    if (typeof Notification !== 'undefined') setNotifyState(Notification.permission);
  }, []);

  // Pengingat browser: hanya saat halaman terbuka, sekali per lamaran per hari.
  useEffect(() => {
    if (!ready || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notified = readNotified();
    const due = apps.filter((app) => ['terlambat', 'hari-ini'].includes(followUpState(app, today).kind));
    const fresh = due.filter((app) => !(notified[today] || []).includes(app.id));
    if (!fresh.length) return;
    fresh.slice(0, 5).forEach((app) => {
      const state = followUpState(app, today).kind;
      new Notification('Tindak lanjut lamaran', {
        body: `${app.posisi} di ${app.perusahaan}: ${state === 'terlambat' ? 'sudah lewat tanggal' : 'hari ini'}.`,
        tag: `lamaran-${app.id}`,
      });
    });
    writeNotified({ [today]: [...(notified[today] || []), ...fresh.map((app) => app.id)] });
  }, [ready, apps, today]);

  const summary = useMemo(() => summarizeApplications(apps, today), [apps, today]);
  const isReady = ready && Boolean(today);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sortApplications(apps, today).filter((app) => {
      if (filter === 'aktif' && isClosedStatus(app.status)) return false;
      if (filter === 'tutup' && !isClosedStatus(app.status)) return false;
      if (filter === 'tindak-lanjut' && !['terlambat', 'hari-ini', 'segera'].includes(followUpState(app, today).kind)) return false;
      if (!term) return true;
      return `${app.posisi} ${app.perusahaan} ${app.lokasi} ${app.catatan}`.toLowerCase().includes(term);
    });
  }, [apps, filter, query, today]);

  const persist = (next) => {
    try {
      const clean = store.save(next);
      setApps(clean);
      return true;
    } catch (error) {
      addToast(error.message, 'error', 6000);
      return false;
    }
  };

  const startNew = () => {
    setErrors([]);
    setEditing({ draft: createApplication(), isNew: true });
  };

  const startEdit = (app) => {
    setErrors([]);
    setEditing({ draft: { ...app }, isNew: false });
  };

  const saveDraft = () => {
    const { draft, isNew } = editing;
    const problems = validateApplication(draft);
    setErrors(problems);
    if (problems.length) return;
    const stamped = { ...draft, posisi: draft.posisi.trim(), perusahaan: draft.perusahaan.trim(), updatedAt: new Date().toISOString() };
    const clean = sanitizeApplication(stamped);
    const next = isNew ? [clean, ...apps] : apps.map((app) => (app.id === clean.id ? clean : app));
    if (persist(next)) {
      setEditing(null);
      addToast(isNew ? 'Lamaran ditambahkan.' : 'Perubahan lamaran disimpan.', 'success');
    }
  };

  const setStatusQuick = (app, status) => {
    const next = apps.map((item) => (item.id === app.id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
    if (persist(next)) addToast(`Status diubah ke “${statusLabel(status)}”.`, 'success');
  };

  const removeApp = (app) => {
    if (!window.confirm(`Hapus lamaran ${app.posisi} di ${app.perusahaan}?`)) return;
    persist(apps.filter((item) => item.id !== app.id));
    addToast('Lamaran dihapus dari perangkat ini.', 'success');
  };

  const downloadCsv = () => {
    downloadText(applicationsCsv(sortApplications(apps, today)), `${safeFileName('lamaran-kerja')}-${todayIso()}.csv`, 'text/csv;charset=utf-8');
    addToast('CSV lamaran diunduh.', 'success');
  };

  const downloadIcs = () => {
    const withFollowUp = apps.filter((app) => !isClosedStatus(app.status) && app.tindakLanjut);
    if (!withFollowUp.length) {
      addToast('Belum ada tindak lanjut aktif untuk dijadwalkan.', 'warning');
      return;
    }
    downloadText(buildFollowUpIcs(apps), `tindak-lanjut-lamaran-${todayIso()}.ics`, 'text/calendar;charset=utf-8');
    addToast('Berkas kalender diunduh. Buka untuk menambahkan pengingat ke aplikasi kalender.', 'success', 5200);
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      addToast('Browser ini tidak mendukung notifikasi. Gunakan berkas kalender (.ics).', 'warning', 5200);
      return;
    }
    const result = await Notification.requestPermission();
    setNotifyState(result);
    addToast(result === 'granted' ? 'Pengingat browser aktif selama situs ini dibuka.' : 'Izin notifikasi belum diberikan. Gunakan berkas kalender sebagai gantinya.', result === 'granted' ? 'success' : 'info', 5200);
  };

  const followUpItems = sortApplications(apps, today).filter((app) => ['terlambat', 'hari-ini', 'segera'].includes(followUpState(app, today).kind));

  const filterOptions = [
    { value: 'aktif', label: `Aktif (${summary.active})` },
    { value: 'tindak-lanjut', label: `Perlu tindak lanjut (${followUpItems.length})` },
    { value: 'tutup', label: `Selesai (${summary.total - summary.active})` },
    { value: 'semua', label: `Semua (${summary.total})` },
  ];

  if (!isReady) {
    return (
      <ToolShell title="Pelacak Lamaran Kerja" desc="Memuat data lamaran dari perangkat ini…" icon="briefcase" className="nv-tool-wide">
        <p className="nv-muted" role="status">Memuat…</p>
      </ToolShell>
    );
  }

  return (
    <ToolShell
      title="Pelacak Lamaran Kerja"
      desc="Catat posisi, perusahaan, status, dan tanggal tindak lanjut. Data tersimpan di perangkat ini."
      icon="briefcase"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <div className="nv-actions" role="toolbar" aria-label="Aksi pelacak">
          <button type="button" className="btn btn-primary btn-sm" onClick={startNew} disabled={!meta.available}><Icon name="plus" size={14} /> Tambah lamaran</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={downloadCsv} disabled={!apps.length}><Icon name="download" size={14} /> Unduh CSV</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={downloadIcs} disabled={!apps.length}><Icon name="calendar" size={14} /> Pengingat kalender (.ics)</button>
          {notifyState !== 'granted' && notifyState !== 'unsupported' ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={enableNotifications}><Icon name="bell" size={14} /> Aktifkan notifikasi browser</button>
          ) : null}
        </div>

        <Notice kind="info" title="Batas pengingat">
          Pengingat browser hanya muncul saat situs ini dibuka. Untuk pengingat yang tetap muncul di HP atau laptop, unduh berkas .ics lalu buka di aplikasi kalender.
        </Notice>

        {meta.corrupt ? <Notice kind="bad" title="Data tidak terbaca">Data lama tidak diubah. Ekspor atau hapus lewat panel cadangan di bawah.</Notice> : null}
        {!meta.available ? <Notice kind="warn" title="Penyimpanan tidak tersedia">Browser ini menolak penyimpanan lokal. Lamaran hanya tampil selama halaman terbuka.</Notice> : null}

        <div className="nv-metrics">
          <Metric label="Lamaran aktif" value={summary.active} tone="strong" />
          <Metric label="Perlu tindak lanjut" value={summary.dueNow} tone={summary.dueNow ? 'warn' : 'default'} hint={summary.overdue ? `${summary.overdue} sudah lewat` : 'hari ini atau lewat'} />
          <Metric label="Wawancara" value={summary.counts.wawancara} />
          <Metric label="Respons dari yang sudah melamar" value={`${summary.responseRate}%`} hint="tes, wawancara, tawaran, atau tolakan" />
        </div>

        {editing ? (
          <ApplicationForm
            draft={editing.draft}
            isNew={editing.isNew}
            errors={errors}
            onChange={(field, value) => setEditing((current) => ({ ...current, draft: { ...current.draft, [field]: value } }))}
            onSave={saveDraft}
            onCancel={() => setEditing(null)}
          />
        ) : null}

        {followUpItems.length ? (
          <Section labelledBy="lamaran-followup-title">
            <SectionHead id="lamaran-followup-title" eyebrow="PENGINGAT" title="Tindak lanjut yang perlu dicek">
              Lamaran dengan tanggal tindak lanjut hari ini, sudah lewat, atau dalam 3 hari.
            </SectionHead>
            <ul className="nv-plain-list nv-followup-list">
              {followUpItems.map((app) => {
                const state = followUpState(app, today);
                return (
                  <li key={app.id}>
                    <span className={`nv-tag ${FOLLOW_UP_TONE[state.kind]}`}>{FOLLOW_UP_LABEL[state.kind]}</span>{' '}
                    <strong>{app.posisi}</strong> di {app.perusahaan} · {formatDateId(app.tindakLanjut)}
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}

        <Section labelledBy="lamaran-daftar">
          <SectionHead id="lamaran-daftar" eyebrow="DAFTAR" title="Lamaran saya">
            Ubah status langsung dari tabel. Urutan: tindak lanjut paling mendesak di atas.
          </SectionHead>
          <div className="nv-search-row">
            <TextField id="lamaran-cari" label="Cari posisi, perusahaan, atau catatan" value={query} onChange={setQuery} placeholder="Ketik untuk mencari" />
            <SelectField id="lamaran-filter" label="Tampilkan" value={filter} onChange={setFilter} options={filterOptions} />
          </div>

          {!ready ? <p className="nv-muted">Memuat data dari perangkat…</p> : null}
          {ready && visible.length === 0 ? (
            <p className="nv-muted">{apps.length ? 'Tidak ada lamaran yang cocok dengan filter ini.' : 'Belum ada lamaran. Tekan “Tambah lamaran” untuk mulai mencatat.'}</p>
          ) : null}

          {visible.length ? (
            <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
              <table className="nv-table">
                <caption className="nv-sr-only">Daftar lamaran kerja</caption>
                <thead>
                  <tr>
                    <th scope="col">Posisi &amp; perusahaan</th>
                    <th scope="col">Status</th>
                    <th scope="col">Tindak lanjut</th>
                    <th scope="col"><span className="nv-sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((app) => {
                    const state = followUpState(app, today);
                    return (
                      <tr key={app.id}>
                        <td>
                          <strong>{app.posisi}</strong>
                          <div className="nv-muted">{app.perusahaan}{app.lokasi ? ` · ${app.lokasi}` : ''}</div>
                          {app.tanggalLamar ? <div className="nv-muted">Melamar {formatDateId(app.tanggalLamar)}</div> : null}
                          {app.catatan ? <div className="nv-muted">{app.catatan}</div> : null}
                        </td>
                        <td>
                          <label className="nv-sr-only" htmlFor={`status-${app.id}`}>Status lamaran {app.posisi}</label>
                          <select id={`status-${app.id}`} className="select nv-compact-select" value={app.status} onChange={(event) => setStatusQuick(app, event.target.value)}>
                            {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <span className={`nv-tag ${FOLLOW_UP_TONE[state.kind]}`}>{FOLLOW_UP_LABEL[state.kind]}</span>
                          {app.tindakLanjut ? <div className="nv-muted">{formatDateId(app.tindakLanjut)}</div> : null}
                        </td>
                        <td>
                          <div className="nv-actions">
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(app)} aria-label={`Ubah ${app.posisi} di ${app.perusahaan}`}><Icon name="edit" size={14} /> Ubah</button>
                            <button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={() => removeApp(app)} aria-label={`Hapus ${app.posisi} di ${app.perusahaan}`}><Icon name="trash" size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </Section>

        {ready ? (
          <LocalDataPanel
            title="Cadangan data lamaran"
            store={store}
            items={apps}
            setItems={setApps}
            corrupt={meta.corrupt}
            available={meta.available}
            updatedAt={meta.updatedAt}
            fileBase="pelacak-lamaran"
          />
        ) : null}
      </div>
    </ToolShell>
  );
}
