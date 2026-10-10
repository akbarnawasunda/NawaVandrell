'use client';

import { useEffect, useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Metric, Notice, Section, SectionHead, TextAreaField, TextField } from '@/components/Ui';
import { useLocalCollection } from '@/components/useLocalCollection';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { createLocalCollection, newId } from '@/lib/localData.mjs';
import { addIsoDays, createShiftPlan, generateShiftAssignments, sanitizeShiftPlan, shiftCsv } from '@/lib/workTools.mjs';
import { printNvDocument } from '@/lib/printDoc.mjs';

const store = createLocalCollection({ name: 'jadwal-shift', version: 1, sanitize: sanitizeShiftPlan, maxItems: 30 });
const weekDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function JadwalShiftPage() {
  const { items, setItems, meta, ready, save, afterDataChange } = useLocalCollection(store);
  const [activeId, setActiveId] = useState('');
  const [employeeText, setEmployeeText] = useState('');
  const plan = items.find((item) => item.id === activeId) || items[0] || null;
  useEffect(() => { setEmployeeText(plan?.employees.join('\\n') || ''); }, [plan?.id]);
  const scheduled = useMemo(() => plan?.assignments.flat().filter(Boolean).length || 0, [plan]);
  const gaps = plan ? plan.assignments.flat().filter((name) => !name).length : 0;
  const create = () => {
    const fresh = { ...createShiftPlan(), id: newId('shift') };
    if (save([fresh, ...items])) { setActiveId(fresh.id); setEmployeeText(''); }
  };
  const update = (patch) => plan && save(items.map((item) => item.id === plan.id ? sanitizeShiftPlan({ ...item, ...patch }) : item));
  const updateCell = (day, shift, employee) => { const assignments = plan.assignments.map((row, index) => index === day ? row.map((name, slot) => slot === shift ? employee : name) : row); update({ assignments }); };
  const generate = () => {
    if (!plan) return;
    const employees = [...new Set(employeeText.split(/\r?\n/).map((name) => name.trim()).filter(Boolean))];
    if (!employees.length) return;
    update({ employees, assignments: generateShiftAssignments(employees, plan.shifts) });
  };
  const updateShift = (index, patch) => update({ shifts: plan.shifts.map((shift, slot) => slot === index ? { ...shift, ...patch } : shift) });
  const addShift = () => { if (plan.shifts.length < 5) update({ shifts: [...plan.shifts, { id: newId('shift-type'), label: `Shift ${plan.shifts.length + 1}`, time: '' }], assignments: plan.assignments.map((row) => [...row, '']) }); };
  const removeShift = (index) => { if (plan.shifts.length <= 1) return; update({ shifts: plan.shifts.filter((_, slot) => slot !== index), assignments: plan.assignments.map((row) => row.filter((_, slot) => slot !== index)) }); };
  const print = () => { document.body.classList.add('nv-printing'); printNvDocument(); };
  return (
    <ToolShell title="Jadwal Shift & Roster Tim" desc="Susun rotasi kerja 7 hari untuk tim toko, layanan, atau operasional. Atur jadwal otomatis lalu sesuaikan secara manual." icon="🗓️" className="nv-tool-wide">
      <div className="nv-stack">
        <Notice kind="warn" title="Periksa aturan kerja sebelum membagikan">Rotasi ini alat bantu penyusunan, bukan penentu kepatuhan. Tinjau jam istirahat, batas jam kerja, hari libur, dan kebijakan tempat kerja.</Notice>
        <Section labelledBy="shift-plan"><SectionHead id="shift-plan" eyebrow="ROSTER MINGGUAN" title="Siapkan jadwal">Pilih rentang mulai, masukkan nama tim satu per baris, lalu buat rotasi yang bisa disunting.</SectionHead>
          <div className="nv-actions"><button type="button" className="btn btn-primary" onClick={create} disabled={!ready || !meta.available || meta.corrupt}>+ Jadwal baru</button><select className="select meeting-select" aria-label="Pilih jadwal" value={plan?.id || ''} onChange={(event) => setActiveId(event.target.value)}><option value="">Pilih jadwal…</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.weekStart}</option>)}</select></div>
          {plan ? <>
            <div className="nv-grid-2"><TextField id="shift-name" label="Nama jadwal" value={plan.name} onChange={(value) => update({ name: value })} maxLength={100} /><TextField id="shift-week" type="date" label="Mulai minggu" value={plan.weekStart} onChange={(value) => update({ weekStart: value })} /></div>
            <TextAreaField id="shift-staff" label="Anggota tim (satu nama per baris)" value={employeeText} onChange={setEmployeeText} rows={4} maxLength={10000} placeholder={'Ani Wijaya\nBudi Santoso\nCitra'} hint="Jika mengubah daftar tim, tekan Buat / perbarui rotasi. Penugasan lama tidak diubah sebelum tombol ditekan." />
            <div className="nv-actions"><button type="button" className="btn btn-primary" onClick={generate} disabled={!employeeText.trim()}>Buat / perbarui rotasi</button></div>
            <div className="shift-types"><h3>Jenis shift</h3>{plan.shifts.map((shift, index) => <div className="shift-type-row" key={shift.id}><TextField id={`shift-label-${shift.id}`} label={`Nama shift ${index + 1}`} value={shift.label} onChange={(value) => updateShift(index, { label: value })} maxLength={40} /><TextField id={`shift-time-${shift.id}`} label="Jam kerja" value={shift.time} onChange={(value) => updateShift(index, { time: value })} maxLength={32} placeholder="07.00–15.00" />{plan.shifts.length > 1 ? <button type="button" className="nv-icon-button is-danger" aria-label={`Hapus ${shift.label}`} onClick={() => removeShift(index)}>×</button> : null}</div>)}{plan.shifts.length < 5 ? <button type="button" className="btn btn-ghost btn-sm" onClick={addShift}>+ Tambah shift</button> : null}</div>
          </> : <p className="nv-muted">Buat jadwal baru untuk memulai.</p>}
        </Section>
        {plan ? <Section labelledBy="shift-table"><SectionHead id="shift-table" eyebrow="CEK CAKUPAN" title="Jadwal 7 hari">Ubah penugasan lewat pilihan di tiap sel. Rotasi otomatis membagi urutan secara bergilir.</SectionHead>
          <div className="nv-metrics"><Metric label="Shift terisi" value={scheduled} /><Metric label="Belum terisi" value={gaps} tone={gaps ? 'warn' : 'strong'} /><Metric label="Anggota tim" value={plan.employees.length} /></div>
          {plan.employees.length ? <><div className="nv-table-wrap shift-table-wrap"><table className="nv-table shift-table"><thead><tr><th>Hari</th>{plan.shifts.map((shift) => <th key={shift.id}>{shift.label}<small>{shift.time}</small></th>)}</tr></thead><tbody>{weekDays.map((_, index) => <tr key={index}><th>{new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${addIsoDays(plan.weekStart, index)}T12:00:00Z`))}<small>{addIsoDays(plan.weekStart, index)}</small></th>{plan.shifts.map((shift, shiftIndex) => <td key={shift.id}><label className="nv-sr-only" htmlFor={`roster-${index}-${shift.id}`}>{day}, {shift.label}</label><select id={`roster-${index}-${shift.id}`} className="select" value={plan.assignments[index]?.[shiftIndex] || ''} onChange={(event) => updateCell(index, shiftIndex, event.target.value)}><option value="">Belum ditugaskan</option>{plan.employees.map((employee) => <option key={employee} value={employee}>{employee}</option>)}</select></td>)}</tr>)}</tbody></table></div>
            <div className="nv-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText(shiftCsv(plan), `${safeFileName(plan.name)}.csv`, 'text/csv;charset=utf-8')}>Unduh CSV</button><button type="button" className="btn btn-ghost btn-sm" onClick={print}>Cetak / simpan PDF</button></div>
            <div className="nv-print-area nv-closed"><article className="nv-print-sheet"><h1>{plan.name}</h1><p>Minggu mulai {plan.weekStart}</p><table><thead><tr><th>Hari</th>{plan.shifts.map((shift) => <th key={shift.id}>{shift.label} {shift.time}</th>)}</tr></thead><tbody>{weekDays.map((_, index) => <tr key={index}><th>{new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${addIsoDays(plan.weekStart, index)}T12:00:00Z`))} · {addIsoDays(plan.weekStart, index)}</th>{plan.shifts.map((shift, slot) => <td key={shift.id}>{plan.assignments[index]?.[slot] || '-'}</td>)}</tr>)}</tbody></table></article></div>
          </> : <p className="nv-muted">Tambahkan tim lalu buat rotasi untuk menampilkan tabel jadwal.</p>}
        </Section> : null}
        <LocalDataPanel title="Cadangan jadwal shift" store={store} items={items} setItems={(next) => { setItems(next); setActiveId(next[0]?.id || ''); }} {...meta} fileBase="jadwal-shift" onAfterChange={afterDataChange} available={ready && meta.available} />
      </div>
    </ToolShell>
  );
}
