'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Metric, Notice, Section, SectionHead, TextAreaField, TextField } from '@/components/Ui';
import { useLocalCollection } from '@/components/useLocalCollection';
import { useToast } from '@/context/ToastContext';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { createLocalCollection, newId } from '@/lib/localData.mjs';
import { calculateStudentAverage, createGradebook, gradebookCsv, sanitizeGradebook, summarizeGradebook } from '@/lib/workTools.mjs';
import { printNvDocument } from '@/lib/printDoc.mjs';

const store = createLocalCollection({ name: 'rekap-nilai', version: 1, sanitize: sanitizeGradebook, maxItems: 40 });

export default function RekapNilaiPage() {
  const { items, setItems, meta, ready, save, afterDataChange } = useLocalCollection(store);
  const { addToast } = useToast();
  const [activeId, setActiveId] = useState('');
  const [namesText, setNamesText] = useState('');
  const book = items.find((item) => item.id === activeId) || items[0] || null;
  const summary = useMemo(() => book ? summarizeGradebook(book) : null, [book]);
  const update = (patch) => book && save(items.map((item) => item.id === book.id ? sanitizeGradebook({ ...item, ...patch }) : item));
  const create = () => { const fresh = { ...createGradebook(), id: newId('kelas'), className: 'Kelas baru' }; if (save([fresh, ...items])) setActiveId(fresh.id); };
  const addStudents = (event) => {
    event.preventDefault();
    if (!book) return;
    const seen = new Set(book.students.map((student) => student.name.toLocaleLowerCase('id')));
    const incoming = namesText.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    const students = incoming.filter((name) => { const key = name.toLocaleLowerCase('id'); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 500 - book.students.length).map((name) => ({ id: newId('murid'), name, scores: Object.fromEntries(book.assessments.map((assessment) => [assessment.id, null])) }));
    if (!students.length) { addToast('Tidak ada nama baru. Periksa nama duplikat atau batas 500 siswa.', 'warning'); return; }
    update({ students: [...book.students, ...students] });
    setNamesText('');
    if (incoming.length > students.length) addToast(`${students.length} siswa ditambahkan. Nama kosong, duplikat, atau melewati batas dilewati.`, 'info');
  };
  const addAssessment = () => {
    if (!book || book.assessments.length >= 20) return;
    const assessment = { id: newId('asesmen'), name: `Penilaian ${book.assessments.length + 1}`, weight: 0 };
    update({ assessments: [...book.assessments, assessment] });
  };
  const updateAssessment = (id, patch) => update({ assessments: book.assessments.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const removeAssessment = (id) => {
    if (book.assessments.length <= 1) return;
    update({ assessments: book.assessments.filter((item) => item.id !== id) });
  };
  const updateScore = (student, assessmentId, value) => update({ students: book.students.map((item) => item.id === student.id ? { ...item, scores: { ...item.scores, [assessmentId]: value === '' ? null : Math.max(0, Math.min(100, Number(value))) } } : item) });
  const removeStudent = (student) => { if (window.confirm(`Hapus data nilai ${student.name}?`)) update({ students: book.students.filter((item) => item.id !== student.id) }); };
  const print = () => { document.body.classList.add('nv-printing'); printNvDocument(); };
  return (
    <ToolShell title="Rekap Nilai Kelas" desc="Atur komponen penilaian dan bobotnya, masukkan daftar siswa, lalu pantau nilai akhir berbobot dan ketuntasan." icon="🎓" className="nv-tool-wide">
      <div className="nv-stack">
        <Notice kind="info" title="Privasi data siswa">Nama dan nilai hanya tersimpan di browser perangkat ini. Buat cadangan sebelum menghapus data browser atau berpindah perangkat.</Notice>
        <Section labelledBy="gradebook-select"><SectionHead id="gradebook-select" eyebrow="DAFTAR KELAS" title="Kelas dan mata pelajaran">Setiap buku nilai berdiri sendiri; ekspor CSV bisa dibuka di spreadsheet.</SectionHead>
          <div className="nv-actions"><button type="button" className="btn btn-primary" onClick={create} disabled={!ready || !meta.available || meta.corrupt}>+ Buku nilai baru</button><select className="select meeting-select" aria-label="Pilih buku nilai" value={book?.id || ''} onChange={(event) => setActiveId(event.target.value)}><option value="">Pilih kelas…</option>{items.map((item) => <option key={item.id} value={item.id}>{item.className || 'Tanpa nama'} · {item.subject || 'Mata pelajaran'}</option>)}</select></div>
          {book ? <div className="nv-grid-3"><TextField id="grade-class" label="Nama kelas" value={book.className} onChange={(value) => update({ className: value })} maxLength={80} placeholder="Contoh: VIII-A" /><TextField id="grade-subject" label="Mata pelajaran" value={book.subject} onChange={(value) => update({ subject: value })} maxLength={80} placeholder="Matematika" /><TextField id="grade-pass" label="Batas ketuntasan" value={String(book.passingScore)} onChange={(value) => update({ passingScore: value })} type="number" min={0} max={100} step={1} inputMode="numeric" hint="Skala 0–100" /></div> : <p className="nv-muted">Buat buku nilai untuk mulai.</p>}
        </Section>
        {book ? <>
          <Section labelledBy="grade-assessments"><SectionHead id="grade-assessments" eyebrow="KOMPONEN NILAI" title="Bobot penilaian">Nilai akhir muncul setelah semua komponen berbobot diisi. Bobot dihitung proporsional bila totalnya bukan 100.</SectionHead>
            <div className="grade-assessment-list">{book.assessments.map((assessment, index) => <div className="grade-assessment-row" key={assessment.id}><TextField id={`assessment-name-${assessment.id}`} label={`Komponen ${index + 1}`} value={assessment.name} onChange={(value) => updateAssessment(assessment.id, { name: value })} maxLength={80} /><TextField id={`assessment-weight-${assessment.id}`} label="Bobot (%)" value={String(assessment.weight)} onChange={(value) => updateAssessment(assessment.id, { weight: value })} type="number" min={0} max={100} step={1} inputMode="numeric" />{book.assessments.length > 1 ? <button type="button" className="nv-icon-button is-danger" aria-label={`Hapus komponen ${assessment.name}`} onClick={() => removeAssessment(assessment.id)}>×</button> : null}</div>)}</div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addAssessment} disabled={book.assessments.length >= 20}>+ Tambah komponen</button>
          </Section>
          <Section labelledBy="grade-students"><SectionHead id="grade-students" eyebrow="SISWA DAN NILAI" title="Daftar siswa">Tempel nama satu per baris. Nama yang sama tidak digandakan. Nilai dapat diedit langsung di tabel.</SectionHead>
            <form className="nv-stack" onSubmit={addStudents}><TextAreaField id="student-names" label="Tambah siswa (satu nama per baris)" value={namesText} onChange={setNamesText} rows={4} maxLength={20000} placeholder={'Alya Pratama\nBima Saputra'} /><div className="nv-actions"><button type="submit" className="btn btn-primary" disabled={!namesText.trim() || book.students.length >= 500}>Tambahkan siswa</button></div></form>
            <div className="nv-metrics"><Metric label="Siswa" value={summary.students} /><Metric label="Nilai lengkap" value={summary.scored} /><Metric label="Rata-rata kelas" value={summary.average == null ? '—' : summary.average.toFixed(1)} /><Metric label="Tuntas" value={`${summary.passing}/${summary.scored}`} tone={summary.needsSupport ? 'warn' : 'strong'} /></div>
            {book.students.length ? <div className="nv-table-wrap"><table className="nv-table grade-table"><thead><tr><th>Nama</th>{book.assessments.map((item) => <th key={item.id}>{item.name}<small>{item.weight}%</small></th>)}<th>Nilai akhir</th><th>Status</th><th><span className="nv-sr-only">Aksi</span></th></tr></thead><tbody>{book.students.map((student) => { const average = calculateStudentAverage(student, book.assessments); return <tr key={student.id}><th>{student.name}</th>{book.assessments.map((assessment) => <td key={assessment.id}><label className="nv-sr-only" htmlFor={`score-${student.id}-${assessment.id}`}>{assessment.name} untuk {student.name}</label><input id={`score-${student.id}-${assessment.id}`} className="input grade-score" type="number" min="0" max="100" step="0.1" value={student.scores[assessment.id] ?? ''} onChange={(event) => updateScore(student, assessment.id, event.target.value)} /></td>)}<td><strong>{average == null ? '—' : average.toFixed(2)}</strong></td><td>{average == null ? 'Belum lengkap' : average >= book.passingScore ? <span className="nv-tag is-ok">Tuntas</span> : <span className="nv-tag is-warn">Tindak lanjut</span>}</td><td><button type="button" className="nv-icon-button is-danger" aria-label={`Hapus siswa ${student.name}`} onClick={() => removeStudent(student)}>×</button></td></tr>; })}</tbody></table></div> : <p className="nv-muted">Belum ada siswa.</p>}
            <div className="nv-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText(gradebookCsv(book), `${safeFileName(`${book.className}-${book.subject}`)}.csv`, 'text/csv;charset=utf-8')} disabled={!book.students.length}>Unduh CSV</button><button type="button" className="btn btn-ghost btn-sm" onClick={print} disabled={!book.students.length}>Cetak / simpan PDF</button></div>
            <div className="nv-print-area nv-closed"><article className="nv-print-sheet"><h1>Rekap Nilai — {book.className}</h1><p>{book.subject} · Batas ketuntasan {book.passingScore}</p><table><thead><tr><th>Nama</th>{book.assessments.map((item) => <th key={item.id}>{item.name} ({item.weight}%)</th>)}<th>Nilai akhir</th><th>Status</th></tr></thead><tbody>{book.students.map((student) => { const avg = calculateStudentAverage(student, book.assessments); return <tr key={student.id}><td>{student.name}</td>{book.assessments.map((item) => <td key={item.id}>{student.scores[item.id] ?? '—'}</td>)}<td>{avg == null ? '—' : avg.toFixed(2)}</td><td>{avg == null ? 'Belum lengkap' : avg >= book.passingScore ? 'Tuntas' : 'Perlu tindak lanjut'}</td></tr>; })}</tbody></table></article></div>
          </Section>
        </> : null}
        <LocalDataPanel title="Cadangan buku nilai" store={store} items={items} setItems={(next) => { setItems(next); setActiveId(next[0]?.id || ''); }} {...meta} fileBase="rekap-nilai" onAfterChange={afterDataChange} available={ready && meta.available} />
      </div>
    </ToolShell>
  );
}
