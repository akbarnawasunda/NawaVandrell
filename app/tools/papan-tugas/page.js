'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Metric, Notice, Section, SectionHead, SelectField, TextAreaField, TextField } from '@/components/Ui';
import { useLocalCollection } from '@/components/useLocalCollection';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { createLocalCollection, newId } from '@/lib/localData.mjs';
import { TASK_PRIORITY, TASK_STATUS, createTask, sanitizeTask, summarizeTasks, tasksCsv } from '@/lib/workTools.mjs';
import { todayIso } from '@/lib/format.mjs';

const store = createLocalCollection({ name: 'papan-tugas', version: 1, sanitize: sanitizeTask, maxItems: 500 });

export default function PapanTugasPage() {
  const { items, setItems, meta, ready, save, afterDataChange } = useLocalCollection(store);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('Umum');
  const [priority, setPriority] = useState('normal');
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState('open');
  const summary = useMemo(() => summarizeTasks(items, todayIso()), [items]);
  const visible = useMemo(() => [...items].filter((task) => filter === 'all' || (filter === 'open' ? task.status !== 'done' : task.status === filter)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || ({ high: 0, normal: 1, low: 2 }[a.priority] - { high: 0, normal: 1, low: 2 }[b.priority])), [items, filter]);
  const add = (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    const task = sanitizeTask({ ...createTask(), id: newId('tugas'), title, area, priority, due: due || todayIso(), notes });
    if (save([task, ...items])) { setTitle(''); setDue(''); setNotes(''); }
  };
  const update = (id, patch) => save(items.map((task) => task.id === id ? sanitizeTask({ ...task, ...patch }) : task));
  const remove = (task) => { if (window.confirm(`Hapus tugas “${task.title}”?`)) save(items.filter((item) => item.id !== task.id)); };
  return (
    <ToolShell title="Papan Tugas Harian" desc="Rapikan pekerjaan lintas proyek: tentukan prioritas, tenggat, lalu tandai progres. Semua data tersimpan lokal." icon="clipboard" className="nv-tool-wide">
      <div className="nv-stack">
        <Notice kind="info" title="Ruang kerja pribadi di perangkat ini">Tugas tidak dikirim ke server. Gunakan ekspor cadangan JSON jika perlu pindah perangkat.</Notice>
        <div className="nv-metrics"><Metric label="Belum selesai" value={summary.open} /><Metric label="Tenggat hari ini" value={summary.dueToday} /><Metric label="Terlambat" value={summary.overdue} tone={summary.overdue ? 'warn' : 'default'} /><Metric label="Selesai" value={summary.done} /></div>
        <Section labelledBy="tasks-add"><SectionHead id="tasks-add" eyebrow="TANGKAP PEKERJAAN" title="Tambahkan tugas">Simpan hal penting sebelum tenggelam di chat dan email.</SectionHead>
          <form onSubmit={add} className="nv-stack">
            <div className="nv-grid-2"><TextField id="task-title" label="Apa yang perlu dikerjakan?" value={title} onChange={setTitle} maxLength={180} placeholder="Contoh: kirim rekap penjualan mingguan" required /><TextField id="task-area" label="Proyek / bagian" value={area} onChange={setArea} maxLength={60} placeholder="Operasional, Keuangan…" /></div>
            <div className="nv-grid-2"><SelectField id="task-priority" label="Prioritas" value={priority} onChange={setPriority} options={TASK_PRIORITY.map((item) => ({ value: item.value, label: item.label }))} /><TextField id="task-due" type="date" label="Tenggat" value={due} onChange={setDue} hint="Kosong berarti hari ini." /></div>
            <TextAreaField id="task-notes" label="Catatan (opsional)" value={notes} onChange={setNotes} rows={3} maxLength={1000} placeholder="Konteks atau langkah kecil…" />
            <div className="nv-actions"><button type="submit" className="btn btn-primary" disabled={!ready || !meta.available || meta.corrupt || !title.trim()}>+ Tambahkan ke papan</button></div>
          </form>
        </Section>
        <Section labelledBy="tasks-list"><SectionHead id="tasks-list" eyebrow="DAFTAR KERJA" title="Tugasmu">Ubah status langsung dari daftar. Urutannya mengikuti tenggat dan prioritas.</SectionHead>
          <div className="chips" role="group" aria-label="Filter tugas">{[['open', 'Aktif'], ['todo', 'Belum'], ['doing', 'Dikerjakan'], ['done', 'Selesai'], ['all', 'Semua']].map(([value, label]) => <button key={value} type="button" className="chip" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
          {!ready ? <p className="nv-muted">Memuat data…</p> : visible.length ? <div className="worktask-list">{visible.map((task) => <article className={`worktask-card is-${task.status}${task.due && task.due < todayIso() && task.status !== 'done' ? ' is-overdue' : ''}`} key={task.id}>
            <div className="worktask-main"><strong>{task.title}</strong><span className="nv-muted">{task.area} · {task.due ? `Tenggat ${task.due}` : 'Tanpa tenggat'} · {TASK_PRIORITY.find((item) => item.value === task.priority)?.label}</span>{task.notes ? <p>{task.notes}</p> : null}</div>
            <label className="nv-sr-only" htmlFor={`task-status-${task.id}`}>Status {task.title}</label><select id={`task-status-${task.id}`} className="select worktask-status" value={task.status} onChange={(event) => update(task.id, { status: event.target.value })}>{TASK_STATUS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <button type="button" className="nv-icon-button is-danger" aria-label={`Hapus tugas ${task.title}`} onClick={() => remove(task)}>×</button>
          </article>)}</div> : <p className="nv-muted">Belum ada tugas di filter ini. Tambahkan tugas di atas.</p>}
          <div className="nv-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText(tasksCsv(items), `${safeFileName('daftar-tugas')}.csv`, 'text/csv;charset=utf-8')} disabled={!items.length}>Unduh CSV</button></div>
        </Section>
        <LocalDataPanel title="Cadangan papan tugas" store={store} items={items} setItems={setItems} {...meta} fileBase="papan-tugas" onAfterChange={afterDataChange} available={ready && meta.available} />
      </div>
    </ToolShell>
  );
}
