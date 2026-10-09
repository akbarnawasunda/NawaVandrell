'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import LocalDataPanel from '@/components/LocalDataPanel';
import { ErrorList, Metric, NumberField, Notice, Section, SectionHead, TextAreaField, TextField } from '@/components/Ui';
import { useToast } from '@/context/ToastContext';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { csvLine, formatDateId, todayIso } from '@/lib/format.mjs';
import { createLocalCollection, newId } from '@/lib/localData.mjs';
import {
  FOCUS_DEFAULTS,
  PHASE_LABEL,
  buildStudyPlan,
  focusMinutesLastDays,
  focusMinutesOn,
  nextAfter,
  normalizeSettings,
  pause,
  remainingMs,
  resume,
  sanitizeSession,
  startPhase,
} from '@/lib/focusPlanner.mjs';

const TIMER_KEY = 'nawa:v1:fokus-timer';
const sessionStore = createLocalCollection({ name: 'fokus', version: 1, sanitize: sanitizeSession, maxItems: 1000, auxKeys: [TIMER_KEY] });
const WEEKDAYS = [
  { value: 1, label: 'Sen' }, { value: 2, label: 'Sel' }, { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' }, { value: 5, label: 'Jum' }, { value: 6, label: 'Sab' }, { value: 0, label: 'Min' },
];

function readTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeTimer(state) {
  try {
    if (state) localStorage.setItem(TIMER_KEY, JSON.stringify(state));
    else localStorage.removeItem(TIMER_KEY);
  } catch {
    /* penyimpanan tidak tersedia: timer tetap berjalan selama halaman terbuka */
  }
}

function format(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    /* suara boleh gagal tanpa mengganggu timer */
  }
}

export default function FokusPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState(FOCUS_DEFAULTS);
  const [timer, setTimer] = useState(null);
  const [now, setNow] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [meta, setMeta] = useState({ available: true, corrupt: false, updatedAt: '' });
  const [status, setStatus] = useState('Siap. Tekan Mulai untuk sesi fokus pertama.');
  const [today, setToday] = useState('');
  const [topicsText, setTopicsText] = useState('Bab 1: Pengantar; 60\nBab 2: Latihan soal; 90');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [perDay, setPerDay] = useState('60');
  const handledRef = useRef(false);

  useEffect(() => {
    const loaded = sessionStore.load();
    setSessions(loaded.items);
    setMeta({ available: loaded.available, corrupt: loaded.corrupt, updatedAt: loaded.updatedAt });
    const saved = readTimer();
    if (saved && saved.settings) {
      setSettings(normalizeSettings(saved.settings));
      setTimer(saved);
    }
    const stamp = Date.now();
    setNow(stamp);
    setToday(todayIso());
    setStartDate(todayIso());
  }, []);

  useEffect(() => {
    writeTimer(timer);
  }, [timer]);

  useEffect(() => {
    if (!timer?.running) {
      if (timer) document.title = 'Timer Fokus · Nawa Editor';
      return undefined;
    }
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [timer]);

  const left = timer ? remainingMs(timer, now || Date.now()) : 0;

  useEffect(() => {
    if (timer?.running) document.title = `${format(left)} · ${PHASE_LABEL[timer.phase]} · Nawa Editor`;
  }, [left, timer]);

  // Saat waktu habis: catat sesi fokus, lalu lanjut ke fase berikutnya secara otomatis.
  useEffect(() => {
    if (!timer?.running || left > 0 || handledRef.current) return;
    handledRef.current = true;
    const finished = timer;
    const next = nextAfter(finished);
    if (finished.phase === 'fokus' && sessionStore) {
      const entry = { id: newId('sesi'), tanggal: todayIso(), menit: finished.settings.fokusMenit, dicatat: new Date().toISOString() };
      try {
        const saved = sessionStore.save([entry, ...sessions]);
        setSessions(saved);
      } catch (error) {
        addToast(error.message, 'error', 5200);
      }
    }
    const upcoming = startPhase({ phase: next.phase, settings: finished.settings, cycle: next.cycle, now: Date.now() });
    setTimer(upcoming);
    setStatus(`${PHASE_LABEL[finished.phase]} selesai. Sekarang: ${PHASE_LABEL[next.phase]}.`);
    beep();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Timer fokus', { body: `${PHASE_LABEL[next.phase]} dimulai.`, tag: 'fokus-phase' });
    }
    window.setTimeout(() => { handledRef.current = false; }, 1200);
  }, [left, timer, sessions, addToast]);

  const start = () => {
    handledRef.current = false;
    const next = startPhase({ phase: 'fokus', settings, cycle: 0, now: Date.now() });
    setTimer(next);
    setNow(Date.now());
    setStatus(`Fokus dimulai: ${settings.fokusMenit} menit.`);
    beep();
  };

  const togglePause = () => {
    if (!timer) return start();
    if (timer.running) {
      setTimer(pause(timer, Date.now()));
      setStatus('Timer dijeda.');
    } else {
      setTimer(resume(timer, Date.now()));
      setNow(Date.now());
      setStatus('Timer dilanjutkan.');
    }
    return undefined;
  };

  const skip = () => {
    if (!timer) return;
    const next = nextAfter(timer);
    setTimer(startPhase({ phase: next.phase, settings: timer.settings, cycle: next.cycle, now: Date.now() }));
    setStatus(`Dilewati. Sekarang: ${PHASE_LABEL[next.phase]}.`);
  };

  const resetTimer = () => {
    setTimer(null);
    setStatus('Timer diatur ulang.');
  };

  const logManual = () => {
    try {
      const entry = { id: newId('sesi'), tanggal: todayIso(), menit: settings.fokusMenit, dicatat: new Date().toISOString() };
      setSessions(sessionStore.save([entry, ...sessions]));
      addToast(`${settings.fokusMenit} menit dicatat sebagai fokus hari ini.`, 'success');
    } catch (error) {
      addToast(error.message, 'error', 5200);
    }
  };

  const updateSetting = (key, value) => {
    const next = normalizeSettings({ ...settings, [key]: value });
    setSettings(next);
    if (!timer) return;
    setTimer({ ...timer, settings: next });
  };

  const plan = useMemo(() => buildStudyPlan({
    topics: topicsText.split('\n').map((line) => {
      const [nama, menit] = line.split(';').map((part) => part.trim());
      return { nama: nama || '', menit: Number(menit) || 0 };
    }),
    mulai: startDate,
    hariBelajar: days,
    menitPerHari: Number(perDay) || 0,
  }), [topicsText, startDate, days, perDay]);

  const todayMinutes = today ? focusMinutesOn(sessions, today) : 0;
  const weekMinutes = today ? focusMinutesLastDays(sessions, today, 7) : 0;
  const phase = timer?.phase || 'fokus';
  const progress = timer ? 1 - left / (minutesOf(timer) * 60_000) : 0;

  const downloadPlan = () => {
    if (!plan.rows.length) return;
    const lines = [csvLine(['Tanggal', 'Topik', 'Menit']), ...plan.rows.map((row) => csvLine([formatDateId(row.tanggal), row.topik, row.menit]))];
    downloadText(`\uFEFF${lines.join('\r\n')}\r\n`, `${safeFileName('rencana-belajar')}.csv`, 'text/csv;charset=utf-8');
    addToast('Rencana belajar diunduh.', 'success');
  };

  const toggleDay = (value) => setDays((current) => (current.includes(value) ? current.filter((d) => d !== value) : [...current, value]));

  return (
    <ToolShell
      title="Timer Fokus & Rencana Belajar"
      desc="Sesi fokus dengan jeda otomatis, catatan waktu belajar, dan rencana belajar sederhana dari daftar topik."
      icon="timer"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="info" title="Timer berjalan selama halaman terbuka">
          Waktu dihitung dari jam perangkat, jadi tetap akurat walau tab sempat tidak aktif. Notifikasi dan suara hanya muncul saat situs terbuka.
        </Notice>

        <Section labelledBy="fokus-timer">
          <SectionHead id="fokus-timer" eyebrow="TIMER" title={timer ? PHASE_LABEL[phase] : 'Siap mulai fokus'}>
            Fokus {settings.fokusMenit} menit, lalu istirahat singkat. Setiap {settings.siklusPanjangSetelah} sesi ada istirahat panjang.
          </SectionHead>
          <div className="nv-timer" role="group" aria-label="Timer fokus">
            <p className="nv-timer-display" aria-live="off">{timer ? format(left) : format(settings.fokusMenit * 60_000)}</p>
            <div className="nv-bar nv-timer-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} /></div>
            <div className="nv-actions nv-timer-actions">
              <button type="button" className="btn btn-primary" onClick={togglePause}>
                <Icon name={timer?.running ? 'close' : 'timer'} size={15} /> {!timer ? 'Mulai fokus' : timer.running ? 'Jeda' : 'Lanjutkan'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={skip} disabled={!timer}>Lewati fase</button>
              <button type="button" className="btn btn-ghost" onClick={resetTimer} disabled={!timer}>Atur ulang</button>
              <button type="button" className="btn btn-ghost" onClick={logManual} title="Catat satu sesi fokus tanpa menunggu timer">Catat {settings.fokusMenit} menit</button>
            </div>
            <p className="nv-sr-only" role="status" aria-live="polite">{status}</p>
            <p className="nv-muted nv-timer-status">{status}</p>
          </div>
          <div className="nv-grid-2">
            <NumberField id="fokus-menit" label="Durasi fokus (menit)" value={settings.fokusMenit} onChange={(v) => updateSetting('fokusMenit', v)} suffix="menit" />
            <NumberField id="fokus-istirahat" label="Istirahat singkat (menit)" value={settings.istirahatMenit} onChange={(v) => updateSetting('istirahatMenit', v)} suffix="menit" />
            <NumberField id="fokus-panjang" label="Istirahat panjang (menit)" value={settings.istirahatPanjangMenit} onChange={(v) => updateSetting('istirahatPanjangMenit', v)} suffix="menit" />
            <NumberField id="fokus-siklus" label="Istirahat panjang setiap berapa sesi" value={settings.siklusPanjangSetelah} onChange={(v) => updateSetting('siklusPanjangSetelah', v)} suffix="sesi" />
          </div>
          <div className="nv-metrics">
            <Metric label="Fokus hari ini" value={`${todayMinutes} menit`} tone="strong" />
            <Metric label="7 hari terakhir" value={`${weekMinutes} menit`} />
          </div>
        </Section>

        <Section labelledBy="fokus-rencana">
          <SectionHead id="fokus-rencana" eyebrow="RENCANA" title="Rencana belajar sederhana">
            Tulis topik dan perkiraan menit per baris dengan format “Topik; menit”. Rencana dibagi ke hari yang Anda pilih.
          </SectionHead>
          <TextAreaField id="rencana-topik" label="Topik belajar" value={topicsText} onChange={setTopicsText} rows={4} maxLength={5000} />
          <div className="nv-grid-3">
            <TextField id="rencana-mulai" type="date" label="Mulai belajar" value={startDate} onChange={setStartDate} />
            <NumberField id="rencana-perhari" label="Menit per hari belajar" value={perDay} onChange={setPerDay} suffix="menit" />
            <div className="nv-field">
              <span className="label" id="rencana-hari-label">Hari belajar</span>
              <div className="nv-chip-group" role="group" aria-labelledby="rencana-hari-label">
                {WEEKDAYS.map((day) => (
                  <button key={day.value} type="button" className="chip" aria-pressed={days.includes(day.value)} onClick={() => toggleDay(day.value)}>{day.label}</button>
                ))}
              </div>
            </div>
          </div>
          <ErrorList errors={plan.errors} />
          {plan.rows.length ? (
            <>
              <p className="nv-muted">Total {plan.totalMenit} menit dalam {plan.hariDipakai} hari, selesai {formatDateId(plan.selesai)}.</p>
              <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
                <table className="nv-table">
                  <caption className="nv-sr-only">Jadwal belajar per hari</caption>
                  <thead><tr><th scope="col">Tanggal</th><th scope="col">Topik</th><th scope="col" className="is-num">Menit</th></tr></thead>
                  <tbody>
                    {plan.rows.slice(0, 60).map((row, index) => (
                      <tr key={`${row.tanggal}-${index}`}><td>{formatDateId(row.tanggal)}</td><td>{row.topik}</td><td className="is-num">{row.menit}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan.rows.length > 60 ? <p className="hint">Menampilkan 60 baris pertama. Unduh CSV untuk daftar lengkap.</p> : null}
              <div className="nv-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={downloadPlan}><Icon name="download" size={14} /> Unduh rencana (CSV)</button>
              </div>
            </>
          ) : null}
        </Section>

        {meta.corrupt ? <Notice kind="bad" title="Catatan sesi tidak terbaca">Data lama tidak diubah. Gunakan panel cadangan untuk mengekspor atau menghapusnya.</Notice> : null}

        {today ? (
          <LocalDataPanel
            title="Catatan sesi fokus"
            store={sessionStore}
            items={sessions}
            setItems={setSessions}
            corrupt={meta.corrupt}
            available={meta.available}
            updatedAt={meta.updatedAt}
            fileBase="fokus"
            onAfterChange={() => setTimer(null)}
          />
        ) : null}
      </div>
    </ToolShell>
  );
}

function minutesOf(state) {
  return state.settings?.[state.phase === 'fokus' ? 'fokusMenit' : state.phase === 'istirahat-panjang' ? 'istirahatPanjangMenit' : 'istirahatMenit'] || 25;
}
