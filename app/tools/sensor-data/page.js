'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { Metric, Notice, Section, SectionHead, SelectField, TextAreaField } from '@/components/NvUi';
import { useToast } from '@/context/ToastContext';
import { downloadText } from '@/lib/fileDownload.mjs';
import { REDACTION_TYPES, redactText, redactionLabel } from '@/lib/redaction.mjs';

const STYLE_OPTIONS = [
  { value: 'label', label: 'Tulis jenis data, misalnya [NIK disensor]' },
  { value: 'bintang', label: 'Ganti semua karakter dengan bintang' },
  { value: 'akhir4', label: 'Sisakan 4 digit terakhir' },
];

export default function SensorDataPage() {
  const { addToast } = useToast();
  const [input, setInput] = useState('');
  const [types, setTypes] = useState(() => REDACTION_TYPES.filter((t) => t.default).map((t) => t.id));
  const [style, setStyle] = useState('label');

  const result = useMemo(() => redactText(input, { types, style }), [input, types, style]);
  const toggle = (id) => setTypes((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]));

  const copy = async () => {
    if (!input.trim()) {
      addToast('Tempel teks dulu.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(result.output);
      addToast('Teks yang sudah disensor tersalin.', 'success');
    } catch {
      addToast('Gagal menyalin. Unduh .txt sebagai gantinya.', 'error');
    }
  };

  const downloadTxt = () => {
    if (!input.trim()) return;
    downloadText(result.output, 'dokumen-tersensor.txt', 'text/plain;charset=utf-8');
  };

  return (
    <ToolShell
      title="Sensor Data Sebelum Dibagikan"
      desc="Cari dan sensor NIK, NPWP, nomor telepon, dan email di dalam teks sebelum dibagikan. Diproses di perangkat ini."
      icon="shield"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="warn" title="Periksa hasilnya sebelum dibagikan">
          Pencarian memakai pola, jadi bisa ada data yang terlewat atau angka biasa yang ikut tersensor. Teks tidak dikirim
          ke server dan tidak disimpan. Sensor tidak menghapus data dari file asli atau dari foto.
        </Notice>

        <Section labelledBy="sensor-input">
          <SectionHead id="sensor-input" eyebrow="LANGKAH 1" title="Tempel teks">
            Salin isi dokumen, catatan, atau pesan ke sini. Foto dan PDF belum didukung di alat ini.
          </SectionHead>
          <TextAreaField id="sensor-teks" label="Teks asli" value={input} onChange={setInput} rows={8} maxLength={60000} placeholder="Contoh: Nama, NIK, nomor telepon, atau email yang ingin dihapus sebelum dikirim." />
        </Section>

        <Section labelledBy="sensor-pilihan">
          <SectionHead id="sensor-pilihan" eyebrow="LANGKAH 2" title="Yang akan disensor">
            Centang jenis data. Nomor rekening tidak aktif secara default karena deret angka lain bisa ikut terbaca.
          </SectionHead>
          <div className="nv-chip-group" role="group" aria-label="Jenis data yang disensor">
            {REDACTION_TYPES.map((item) => (
              <button key={item.id} type="button" className="chip" aria-pressed={types.includes(item.id)} onClick={() => toggle(item.id)}>{item.label}</button>
            ))}
          </div>
          <SelectField id="sensor-gaya" label="Cara menyensor" value={style} onChange={setStyle} options={STYLE_OPTIONS} />
        </Section>

        <div className="nv-metrics">
          <Metric label="Data ditemukan" value={result.count} tone={result.count ? 'warn' : 'default'} />
          {Object.entries(result.byType).map(([type, n]) => <Metric key={type} label={redactionLabel(type)} value={n} />)}
        </div>

        <Section labelledBy="sensor-hasil">
          <SectionHead id="sensor-hasil" eyebrow="LANGKAH 3" title="Hasil sensor">
            Periksa ulang sebelum menyalin. Jika ada data yang belum tersensor, tambahkan jenisnya atau sensor manual.
          </SectionHead>
          <label className="label" htmlFor="sensor-keluaran">Teks setelah disensor</label>
          <textarea id="sensor-keluaran" className="textarea" rows={8} readOnly value={result.output} />
          <div className="nv-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={copy}><Icon name="copy" size={14} /> Salin hasil</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={downloadTxt} disabled={!input.trim()}><Icon name="download" size={14} /> Unduh .txt</button>
          </div>
          {result.matches.length ? (
            <ul className="nv-plain-list nv-findings" aria-label="Daftar temuan">
              {result.matches.slice(0, 50).map((m, index) => (
                <li key={`${m.start}-${index}`}><span className="nv-tag is-warn">{redactionLabel(m.type)}</span> <span className="nv-muted">posisi {m.start + 1}</span></li>
              ))}
            </ul>
          ) : null}
        </Section>
      </div>
    </ToolShell>
  );
}
