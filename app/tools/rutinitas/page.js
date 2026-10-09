'use client';

import { useEffect, useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Metric, Notice, Section, SectionHead, TextAreaField, TextField } from '@/components/NvUi';
import { useToast } from '@/context/ToastContext';
import { formatDateId, todayIso } from '@/lib/format.mjs';
import { createLocalCollection } from '@/lib/localData.mjs';
import {
  WEEKDAYS,
  createRoutine,
  dueReminders,
  isRoutineOn,
  nextReminder,
  progressOn,
  sanitizeRoutine,
  streakOf,
  toggleStep,
} from '@/lib/routines.mjs';

const store = createLocalCollection({ name: 'rutinitas', version: 1, sanitize: sanitizeRoutine, maxItems: 20 });
const NOTIFIED_KEY = 'nawa:v1:rutinitas-notif';

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
    /* penyimpanan penuh: pengingat tetap tampil di halaman */
  }
}

export default function RutinitasPage() {
  const { addToast } = useToast();
  const [routines, setRoutines] = useState([]);
  const [meta, setMeta] = useState({ available: true, corrupt: false, updatedAt: '' });
  const [today, setToday] = useState('');
  const [now, setNow] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState(null);
  const [banner, setBanner] = useState([]);
  const [permission, setPermission] = useState('unsupported');

  useEffect(() => {
    const loaded = store.load();
    setRoutines(loaded.items);
    setMeta({ available: loaded.available, corrupt: loaded.corrupt, updatedAt: loaded.updatedAt });
    setToday(todayIso());
    setNow(new Date());
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  // Pengingat: diperiksa setiap 30 detik selama halaman terbuka.
  useEffect(() => {
    const check = () => {
      const current = new Date();
      setNow(current);
      const notified = readNotified();
      const due = dueReminders(routines, current, notified);
      if (!due.length) return;
      const day = todayIso(current);
      writeNotified({ [day]: [...(notified[day] || []), ...due.map((r) => r.id)] });
      setBanner(due.map((r) => r.nama));
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        due.forEach((r) => new Notification('Rutinitas', { body: `Saatnya: ${r.nama}`, tag: `rutin-${r.id}` }));
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [routines]);

  const persist = (next) => {
    try {
      setRoutines(store.save(next));
      return true;
    } catch (error) {
      addToast(error.message, 'error', 6000);
      return false;
    }
  };

  const toggle = (routine, stepId) => {
    const updated = toggleStep(routine, today, stepId, today);
    persist(routines.map((r) => (r.id === routine.id ? updated : r)));
  };

  const todayList = useMemo(() => routines.filter((r) => today && isRoutineOn(r, today)), [routines, today]);
  const totalSteps = todayList.reduce((sum, r) => sum + r.langkah.length, 0);
  const doneSteps = todayList.reduce((sum, r) => sum + progressOn(r, today).selesai, 0);
  const persen = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;

  const startEdit = (routine) => {
    setEditingId(routine.id);
    setDraft({
      nama: routine.nama,
      waktu: routine.waktu,
      hari: [...routine.hari],
      langkah: routine.langkah.map((s) => s.teks).join('\n'),
      id: routine.id,
      sourceChecks: routine.checks,
    });
  };

  const newRoutine = () => {
    if (routines.length >= 20) {
      addToast('Batas 20 rutinitas.', 'warning');
      return;
    }
    const fresh = createRoutine('Rutinitas baru');
    setEditingId(fresh.id);
    setDraft({ nama: fresh.nama, waktu: '', hari: [...fresh.hari], langkah: '', id: fresh.id, sourceChecks: {} });
  };

  const saveDraft = () => {
    if (!draft) return;
    const steps = draft.langkah.split('\n').map((t) => t.trim()).filter(Boolean);
    if (!draft.nama.trim()) {
      addToast('Beri nama rutinitas dulu.', 'warning');
      return;
    }
    if (!steps.length) {
      addToast('Tulis minimal satu langkah, satu per baris.', 'warning');
      return;
    }
    if (!draft.hari.length) {
      addToast('Pilih minimal satu hari.', 'warning');
      return;
    }
    const previous = routines.find((r) => r.id === draft.id);
    const existingIds = new Map((previous?.langkah || []).map((s) => [s.teks, s.id]));
    const cleaned = sanitizeRoutine({
      id: draft.id,
      nama: draft.nama,
      waktu: draft.waktu,
      hari: draft.hari,
      langkah: steps.map((teks) => ({ id: existingIds.get(teks), teks })),
      checks: previous?.checks || {},
    });
    const next = previous ? routines.map((r) => (r.id === draft.id ? cleaned : r)) : [cleaned, ...routines];
    if (persist(next)) {
      setEditingId('');
      setDraft(null);
      addToast('Rutinitas disimpan.', 'success');
    }
  };

  const removeRoutine = (routine) => {
    if (!window.confirm(`Hapus rutinitas “${routine.nama}” beserta riwayat centangnya?`)) return;
    persist(routines.filter((r) => r.id !== routine.id));
    setEditingId('');
    setDraft(null);
  };

  const enableReminders = async () => {
    if (typeof Notification === 'undefined') {
      addToast('Browser ini tidak mendukung notifikasi. Pengingat tetap tampil di halaman ini.', 'info', 5200);
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    addToast(result === 'granted' ? 'Notifikasi aktif selama situs ini dibuka.' : 'Izin belum diberikan. Pengingat tetap muncul di halaman ini.', result === 'granted' ? 'success' : 'info', 5200);
  };

  return (
    <ToolShell
      title="Checklist Rutinitas & Pengingat"
      desc="Atur kebiasaan harian, centang setiap langkah, dan lihat streak. Pengingat berjalan selama halaman terbuka."
      icon="check"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="info" title="Batas pengingat">
          Pengingat hanya berjalan saat halaman ini terbuka atau tab tidak ditutup. Untuk pengingat di luar itu, pakai jam atau alarm di HP Anda.
        </Notice>

        {banner.length ? (
          <div className="nv-notice is-ok" role="status">
            <strong>Saatnya:</strong> {banner.join(', ')}.
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setBanner([])}>Tutup pengingat</button></div>
          </div>
        ) : null}

        <div className="nv-metrics">
          <Metric label="Langkah hari ini" value={`${doneSteps}/${totalSteps}`} tone={persen === 100 && totalSteps ? 'strong' : 'default'} hint={`${persen}% selesai`} />
          <Metric label="Rutinitas hari ini" value={todayList.length} />
          <Metric label="Tanggal" value={today ? formatDateId(today) : '…'} />
        </div>

        <Section labelledBy="rutin-hari-ini">
          <SectionHead id="rutin-hari-ini" eyebrow="HARI INI" title="Checklist">
            Centang langkah yang sudah selesai. Hanya rutinitas yang dijadwalkan hari ini yang tampil.
          </SectionHead>
          {!todayList.length ? <p className="nv-muted">Belum ada rutinitas untuk hari ini. Buat di bawah.</p> : null}
          {todayList.map((routine) => {
            const progress = progressOn(routine, today);
            const streak = streakOf(routine, today);
            const next = nextReminder(routine, now || new Date());
            return (
              <article className="nv-cv-card" key={routine.id} aria-labelledby={`rutin-${routine.id}`}>
                <div className="nv-actions" style={{ justifyContent: 'space-between' }}>
                  <h3 id={`rutin-${routine.id}`} className="nv-routine-title">{routine.nama}{routine.waktu ? <span className="nv-muted"> · {routine.waktu}</span> : null}</h3>
                  <span className="nv-tag is-ok">Streak {streak} hari</span>
                </div>
                <div className="nv-bar" role="img" aria-label={`${progress.selesai} dari ${progress.total} langkah selesai`}><i style={{ width: `${progress.persen}%` }} /></div>
                <ul className="nv-plain-list nv-routine-steps">
                  {routine.langkah.map((step) => {
                    const checked = (routine.checks[today] || []).includes(step.id);
                    return (
                      <li key={step.id}>
                        <label className="nv-check">
                          <input type="checkbox" checked={checked} onChange={() => toggle(routine, step.id)} />
                          <span className={checked ? 'nv-done' : ''}>{step.teks}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {next && routine.waktu ? <p className="hint">Pengingat berikutnya: {next.toLocaleDateString('id-ID', { weekday: 'long' })}, {routine.waktu}.</p> : null}
              </article>
            );
          })}
        </Section>

        <Section labelledBy="rutin-kelola">
          <SectionHead id="rutin-kelola" eyebrow="RUTINITAS" title="Kelola rutinitas">
            Atur nama, jam pengingat, hari, dan langkahnya. Langkah ditulis satu per baris.
          </SectionHead>
          <div className="nv-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={newRoutine} disabled={!meta.available}><Icon name="plus" size={14} /> Rutinitas baru</button>
            {permission !== 'granted' && permission !== 'unsupported' ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={enableReminders}><Icon name="bell" size={14} /> Aktifkan notifikasi browser</button>
            ) : null}
          </div>

          {routines.map((routine) => (
            <div className="nv-table-wrap nv-routine-row" key={routine.id}>
              <div className="nv-actions" style={{ justifyContent: 'space-between', padding: '10px 12px' }}>
                <div>
                  <strong>{routine.nama}</strong>
                  <div className="nv-muted">{routine.hari.length === 7 ? 'Setiap hari' : routine.hari.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(', ')}{routine.waktu ? ` · pengingat ${routine.waktu}` : ' · tanpa pengingat'} · {routine.langkah.length} langkah</div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(routine)} aria-label={`Ubah ${routine.nama}`}><Icon name="edit" size={14} /> Ubah</button>
              </div>
            </div>
          ))}

          {draft ? (
            <div className="nv-cv-card" role="group" aria-label="Editor rutinitas">
              <TextField id="rutin-nama" label="Nama rutinitas" value={draft.nama} onChange={(v) => setDraft((d) => ({ ...d, nama: v }))} maxLength={80} />
              <div className="nv-grid-2">
                <TextField id="rutin-waktu" type="time" label="Jam pengingat (opsional)" value={draft.waktu} onChange={(v) => setDraft((d) => ({ ...d, waktu: v }))} hint="Kosongkan bila tidak perlu pengingat." />
                <div className="nv-field">
                  <span className="label" id="rutin-hari-label">Hari</span>
                  <div className="nv-chip-group" role="group" aria-labelledby="rutin-hari-label">
                    {WEEKDAYS.map((day) => (
                      <button key={day.value} type="button" className="chip" aria-pressed={draft.hari.includes(day.value)} onClick={() => setDraft((d) => ({ ...d, hari: d.hari.includes(day.value) ? d.hari.filter((x) => x !== day.value) : [...d.hari, day.value] }))}>{day.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <TextAreaField id="rutin-langkah" label="Langkah (satu per baris)" value={draft.langkah} onChange={(v) => setDraft((d) => ({ ...d, langkah: v }))} rows={5} maxLength={4000} placeholder={'Minum air putih 2 gelas\nJalan kaki 10 menit\nTulis 3 hal yang disyukuri'} />
              <div className="nv-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={saveDraft}><Icon name="check" size={14} /> Simpan</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDraft(null); setEditingId(''); }}>Batal</button>
                {routines.some((r) => r.id === editingId) ? <button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={() => removeRoutine(routines.find((r) => r.id === editingId))}><Icon name="trash" size={14} /> Hapus rutinitas</button> : null}
              </div>
            </div>
          ) : null}
        </Section>

        {meta.corrupt ? <Notice kind="bad" title="Data tidak terbaca">Data lama tidak diubah. Gunakan panel cadangan untuk mengekspor atau menghapusnya.</Notice> : null}

        {today ? (
          <LocalDataPanel
            title="Cadangan rutinitas"
            store={store}
            items={routines}
            setItems={setRoutines}
            corrupt={meta.corrupt}
            available={meta.available}
            updatedAt={meta.updatedAt}
            fileBase="rutinitas"
          />
        ) : null}
      </div>
    </ToolShell>
  );
}
