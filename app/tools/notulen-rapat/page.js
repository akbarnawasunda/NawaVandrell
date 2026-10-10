'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Notice, Section, SectionHead, TextAreaField, TextField } from '@/components/Ui';
import { useLocalCollection } from '@/components/useLocalCollection';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { createLocalCollection, newId } from '@/lib/localData.mjs';
import { createMeeting, meetingActionsCsv, sanitizeMeeting } from '@/lib/workTools.mjs';
import { printNvDocument } from '@/lib/printDoc.mjs';

const store = createLocalCollection({ name: 'notulen-rapat', version: 1, sanitize: sanitizeMeeting, maxItems: 50 });

export default function MeetingMinutesPage() {
  const { items, setItems, meta, ready, save, afterDataChange } = useLocalCollection(store);
  const [activeId, setActiveId] = useState('');
  const [actionText, setActionText] = useState('');
  const [actionOwner, setActionOwner] = useState('');
  const [actionDue, setActionDue] = useState('');
  const active = items.find((item) => item.id === activeId) || items[0] || null;
  const pending = useMemo(() => active?.actions.filter((item) => !item.done).length || 0, [active]);
  const update = (patch) => active && save(items.map((item) => item.id === active.id ? sanitizeMeeting({ ...item, ...patch }) : item));
  const create = () => {
    const fresh = { ...createMeeting(), id: newId('rapat'), title: 'Rapat baru' };
    if (save([fresh, ...items])) setActiveId(fresh.id);
  };
  const addAction = (event) => {
    event.preventDefault();
    if (!active || !actionText.trim()) return;
    update({ actions: [...active.actions, { id: newId('aksi'), text: actionText, owner: actionOwner, due: actionDue, done: false }] });
    setActionText(''); setActionOwner(''); setActionDue('');
  };
  const print = () => {
    if (!active) return;
    document.body.classList.add('nv-printing');
    printNvDocument();
  };
  const remove = () => {
    if (active && window.confirm(`Hapus notulen “${active.title || 'tanpa judul'}”?`)) { save(items.filter((item) => item.id !== active.id)); setActiveId(''); }
  };
  return (
    <ToolShell title="Notulen & Tindak Lanjut Rapat" desc="Catat agenda, keputusan, penanggung jawab, dan tenggat. Cetak notulen ke PDF dari browser." icon="🗒️" className="nv-tool-wide">
      <div className="nv-stack">
        <Notice kind="info" title="Catatan rapat bersifat lokal">Nama dan isi rapat tetap di perangkat ini. Untuk dibagikan, cetak ke PDF atau ekspor daftar tindak lanjut.</Notice>
        <Section labelledBy="meeting-work"><SectionHead id="meeting-work" eyebrow="RUANG RAPAT" title="Kelola notulen">Pisahkan tiap rapat agar keputusan dan tindak lanjut mudah ditemukan.</SectionHead>
          <div className="nv-actions"><button type="button" className="btn btn-primary" onClick={create} disabled={!ready || !meta.available || meta.corrupt}>+ Notulen baru</button><select className="select meeting-select" aria-label="Pilih notulen" value={active?.id || ''} onChange={(event) => setActiveId(event.target.value)}><option value="">Pilih rapat…</option>{items.map((item) => <option key={item.id} value={item.id}>{item.title || 'Tanpa judul'} · {item.date || 'tanpa tanggal'}</option>)}</select>{active ? <span className="nv-tag">{pending} tindak lanjut terbuka</span> : null}</div>
          {!active ? <p className="nv-muted">Belum ada notulen. Buat notulen untuk mulai mencatat.</p> : <>
            <div className="nv-grid-2"><TextField id="meeting-title" label="Nama rapat" value={active.title} onChange={(value) => update({ title: value })} maxLength={180} placeholder="Contoh: Koordinasi operasional mingguan" /><TextField id="meeting-date" type="date" label="Tanggal" value={active.date} onChange={(value) => update({ date: value })} /><TextField id="meeting-start" type="time" label="Waktu mulai" value={active.start} onChange={(value) => update({ start: value })} /><TextField id="meeting-place" label="Tempat / tautan" value={active.location} onChange={(value) => update({ location: value })} maxLength={140} /><TextField id="meeting-chair" label="Pimpinan rapat / notulis" value={active.chair} onChange={(value) => update({ chair: value })} maxLength={100} /><TextField id="meeting-attendees" label="Peserta" value={active.attendees} onChange={(value) => update({ attendees: value })} maxLength={1200} placeholder="Pisahkan dengan koma" /></div>
            <TextAreaField id="meeting-agenda" label="Agenda" value={active.agenda} onChange={(value) => update({ agenda: value })} rows={4} maxLength={4000} placeholder="Satu agenda per baris" />
            <TextAreaField id="meeting-notes" label="Pembahasan dan keputusan" value={active.notes} onChange={(value) => update({ notes: value })} rows={7} maxLength={8000} placeholder="Catat keputusan, kendala, dan konteks penting…" />
          </>}
        </Section>
        {active ? <Section labelledBy="meeting-actions"><SectionHead id="meeting-actions" eyebrow="LANGKAH BERIKUTNYA" title="Daftar tindak lanjut">Setiap keputusan yang perlu dikerjakan memiliki PIC dan tenggat yang jelas.</SectionHead>
          <form className="nv-grid-2" onSubmit={addAction}><TextField id="action-text" label="Tindak lanjut" value={actionText} onChange={setActionText} maxLength={240} placeholder="Contoh: kirim revisi jadwal" required /><TextField id="action-owner" label="Penanggung jawab" value={actionOwner} onChange={setActionOwner} maxLength={100} placeholder="Nama / tim" /><TextField id="action-due" type="date" label="Tenggat" value={actionDue} onChange={setActionDue} /><div className="nv-field"><span className="label" aria-hidden="true">&nbsp;</span><button type="submit" className="btn btn-primary" disabled={!actionText.trim()}>+ Tambah tindak lanjut</button></div></form>
          {active.actions.length ? <div className="worktask-list">{active.actions.map((item) => <article className={`worktask-card${item.done ? ' is-done' : ''}`} key={item.id}><label className="nv-check"><input type="checkbox" checked={item.done} onChange={(event) => update({ actions: active.actions.map((action) => action.id === item.id ? { ...action, done: event.target.checked } : action) })} /><span className="nv-sr-only">Tandai tindak lanjut selesai</span></label><div className="worktask-main"><strong>{item.text}</strong><span className="nv-muted">{[item.owner && `PIC ${item.owner}`, item.due && `Tenggat ${item.due}`].filter(Boolean).join(' · ') || 'PIC dan tenggat belum ditentukan'}</span></div><button type="button" className="nv-icon-button is-danger" aria-label={`Hapus tindak lanjut ${item.text}`} onClick={() => update({ actions: active.actions.filter((action) => action.id !== item.id) })}>×</button></article>)}</div> : <p className="nv-muted">Belum ada tindak lanjut.</p>}
          <div className="nv-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={print}>Cetak / simpan PDF</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText(meetingActionsCsv(active), `${safeFileName(active.title || 'tindak-lanjut')}.csv`, 'text/csv;charset=utf-8')} disabled={!active.actions.length}>Unduh tindak lanjut CSV</button><button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={remove}>Hapus notulen</button></div>
          <div className="nv-print-area nv-closed"><article className="nv-print-sheet meeting-print"><h1>{active.title || 'Notulen rapat'}</h1><p>{active.date || ''} {active.start ? `· ${active.start}` : ''} {active.location ? `· ${active.location}` : ''}</p><p><strong>Pimpinan / notulis:</strong> {active.chair || '-'} &nbsp; <strong>Peserta:</strong> {active.attendees || '-'}</p><h2>Agenda</h2><pre>{active.agenda || '-'}</pre><h2>Pembahasan & keputusan</h2><pre>{active.notes || '-'}</pre><h2>Tindak lanjut</h2><ol>{active.actions.map((item) => <li key={item.id}>{item.text} — {item.owner || 'PIC belum ditentukan'} — {item.due || 'tanpa tenggat'} {item.done ? '(selesai)' : ''}</li>)}</ol></article></div>
        </Section> : null}
        <LocalDataPanel title="Cadangan notulen rapat" store={store} items={items} setItems={(next) => { setItems(next); setActiveId(next[0]?.id || ''); }} {...meta} fileBase="notulen-rapat" onAfterChange={afterDataChange} available={ready && meta.available} />
      </div>
    </ToolShell>
  );
}
