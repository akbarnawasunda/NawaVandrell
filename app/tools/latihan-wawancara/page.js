'use client';

import { useEffect, useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Metric, Notice, Section, SectionHead, TextAreaField } from '@/components/Ui';
import { INTERVIEW_CATEGORIES, STAR_STEPS } from '@/data/interviewBank.js';
import { useToast } from '@/context/ToastContext';
import { formatDateId, isValidIsoDate, todayIso } from '@/lib/format.mjs';
import { createLocalCollection, newId } from '@/lib/localData.mjs';
import { pickQuestion, scoreAnswer } from '@/lib/interviewPractice.mjs';

const PRACTICE_SECONDS = 120;

function sanitizePractice(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.pertanyaan !== 'string' || !raw.pertanyaan) return null;
  return {
    id: raw.id.slice(0, 80),
    tanggal: isValidIsoDate(raw.tanggal) ? raw.tanggal : todayIso(),
    kategori: String(raw.kategori || '').slice(0, 30),
    pertanyaan: String(raw.pertanyaan).slice(0, 400),
    jawaban: String(raw.jawaban ?? '').slice(0, 6000),
    skor: Math.max(0, Math.min(100, Math.round(Number(raw.skor) || 0))),
    dibuat: typeof raw.dibuat === 'string' ? raw.dibuat : new Date().toISOString(),
  };
}

const store = createLocalCollection({ name: 'wawancara', version: 1, sanitize: sanitizePractice, maxItems: 300 });

function formatClock(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function LatihanWawancaraPage() {
  const { addToast } = useToast();
  const [category, setCategory] = useState('semua');
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState([]);
  const [meta, setMeta] = useState({ available: true, corrupt: false, updatedAt: '' });
  const [ready, setReady] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const loaded = store.load();
    setHistory(loaded.items);
    setMeta({ available: loaded.available, corrupt: loaded.corrupt, updatedAt: loaded.updatedAt });
    setQuestion(pickQuestion('semua', []));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!deadline) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - (now || Date.now())) / 1000)) : PRACTICE_SECONDS;
  const finished = Boolean(deadline) && secondsLeft === 0;
  const scored = useMemo(() => scoreAnswer(answer), [answer]);

  const chooseQuestion = (cat = category, exclude = question ? [question.id] : []) => {
    setQuestion(pickQuestion(cat, exclude));
    setAnswer('');
    setDeadline(null);
  };

  const pickCategory = (id) => {
    setCategory(id);
    chooseQuestion(id, []);
  };

  const startTimer = () => {
    setDeadline(Date.now() + PRACTICE_SECONDS * 1000);
    setNow(Date.now());
  };

  const saveAttempt = () => {
    if (!question) return;
    if (!answer.trim()) {
      addToast('Tulis jawaban dulu sebelum menyimpan.', 'warning');
      return;
    }
    const entry = {
      id: newId('latihan'),
      tanggal: todayIso(),
      kategori: question.kategori,
      pertanyaan: question.tanya,
      jawaban: answer.trim(),
      skor: scored.score,
      dibuat: new Date().toISOString(),
    };
    try {
      setHistory(store.save([entry, ...history]));
      addToast(`Latihan disimpan. Skor mandiri ${scored.score}/100.`, 'success');
    } catch (error) {
      addToast(error.message, 'error', 6000);
    }
  };

  const removeAttempt = (id) => {
    if (!window.confirm('Hapus jawaban latihan ini dari perangkat?')) return;
    setHistory(store.save(history.filter((h) => h.id !== id)));
  };

  const average = history.length ? Math.round(history.reduce((sum, h) => sum + h.skor, 0) / history.length) : 0;

  return (
    <ToolShell
      title="Latihan Wawancara"
      desc="Latih jawaban dengan pertanyaan umum, timer dua menit, dan panduan STAR. Penilaiannya mandiri dan tersimpan di perangkat."
      icon="mic"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="info" title="Latihan mandiri">
          Penilaian di halaman ini memeriksa panjang jawaban, struktur STAR, dan angka. Ini bukan penilaian perekrut.
          Latih dengan suara keras atau bersama teman untuk umpan balik yang lebih nyata.
        </Notice>

        <Section labelledBy="wawancara-soal">
          <SectionHead id="wawancara-soal" eyebrow="LATIHAN" title="Pertanyaan">
            Pilih kategori, lalu jawab dengan batas waktu dua menit.
          </SectionHead>
          <div className="nv-chip-group" role="group" aria-label="Kategori pertanyaan">
            {INTERVIEW_CATEGORIES.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={category === c.id} onClick={() => pickCategory(c.id)}>{c.label}</button>
            ))}
          </div>
          {question ? (
            <article className="nv-cv-card" aria-label="Pertanyaan latihan">
              <p className="nv-eyebrow">PERTANYAAN</p>
              <p className="nv-question">{question.tanya}</p>
              <p className="nv-muted"><strong>Tips:</strong> {question.tip}</p>
            </article>
          ) : null}
          <div className="nv-timer nv-practice-timer-wrap" role="group" aria-label="Timer latihan">
            <p className="nv-practice-timer" aria-live="off">{deadline ? formatClock(secondsLeft) : formatClock(PRACTICE_SECONDS)}</p>
            <div className="nv-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={startTimer} disabled={Boolean(deadline) && !finished}><Icon name="timer" size={14} /> {deadline && !finished ? 'Sedang berjalan' : 'Mulai 2 menit'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => chooseQuestion()}><Icon name="refresh" size={14} /> Pertanyaan lain</button>
            </div>
            {finished ? <p className="nv-notice is-warn" role="status">Waktu habis. Baca jawabanmu dan perbaiki bagian yang belum jelas.</p> : null}
          </div>
        </Section>

        <Section labelledBy="wawancara-jawab">
          <SectionHead id="wawancara-jawab" eyebrow="JAWABAN" title="Tulis jawabanmu">
            Gunakan STAR: Situasi, Tugas, Tindakan, Hasil. Jawaban yang baik biasanya 1–2 menit.
          </SectionHead>
          <TextAreaField id="wawancara-teks" label="Jawaban" value={answer} onChange={setAnswer} rows={7} maxLength={6000} placeholder="Tulis jawaban dengan kata-katamu sendiri." />
          <div className="nv-metrics">
            <Metric label="Kata" value={scored.words} hint="ideal 60–200" />
            <Metric label="Skor mandiri" value={`${scored.score}/100`} tone={scored.score >= 70 ? 'strong' : scored.score >= 45 ? 'warn' : 'danger'} />
          </div>
          <ul className="nv-star-list" aria-label="Struktur STAR">
            {STAR_STEPS.map((step) => (
              <li key={step.id} className={scored.star[step.id] ? 'is-ok' : ''}>
                <strong>{step.label}</strong>
                <br />
                {scored.star[step.id] ? 'Terlihat dalam jawaban' : step.hint}
              </li>
            ))}
          </ul>
          {scored.tips.length ? (
            <ul className="nv-plain-list">{scored.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          ) : answer.trim() ? <p className="nv-muted">Struktur sudah cukup baik. Pastikan jawaban tetap natural saat diucapkan.</p> : null}
          <div className="nv-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={saveAttempt} disabled={!question || !meta.available}><Icon name="check" size={14} /> Simpan latihan ini</button>
          </div>
        </Section>

        {ready ? (
          <Section labelledBy="wawancara-riwayat">
            <SectionHead id="wawancara-riwayat" eyebrow="RIWAYAT" title="Latihan tersimpan">
              {history.length ? `${history.length} latihan · rata-rata skor mandiri ${average}/100` : 'Belum ada latihan tersimpan.'}
            </SectionHead>
            {history.slice(0, 15).map((item) => (
              <div className="nv-cv-card" key={item.id}>
                <div className="nv-actions" style={{ justifyContent: 'space-between' }}>
                  <strong>{formatDateId(item.tanggal)} · skor {item.skor}/100</strong>
                  <button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={() => removeAttempt(item.id)} aria-label={`Hapus latihan tanggal ${formatDateId(item.tanggal)}`}><Icon name="trash" size={14} /></button>
                </div>
                <p className="nv-muted">{item.pertanyaan}</p>
                <p className="nv-practice-answer">{item.jawaban}</p>
              </div>
            ))}
          </Section>
        ) : null}

        {meta.corrupt ? <Notice kind="bad" title="Riwayat tidak terbaca">Data lama tidak diubah. Gunakan panel cadangan untuk mengekspor atau menghapusnya.</Notice> : null}

        {ready ? (
          <LocalDataPanel
            title="Cadangan latihan wawancara"
            store={store}
            items={history}
            setItems={setHistory}
            corrupt={meta.corrupt}
            available={meta.available}
            updatedAt={meta.updatedAt}
            fileBase="latihan-wawancara"
          />
        ) : null}
      </div>
    </ToolShell>
  );
}
