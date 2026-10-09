'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { Metric, NumberField, Notice, Section, SectionHead, SelectField } from '@/components/Ui';
import { downloadText } from '@/lib/fileDownload.mjs';
import { csvLine, formatDateId, formatRupiah, toAmount } from '@/lib/format.mjs';
import { useToast } from '@/context/ToastContext';
import {
  OVERTIME_DAY_TYPES,
  PAYROLL_RULES,
  PTKP_STATUS,
  calcMonthlyPayroll,
  calcOvertime,
  calcThr,
  thrTaxImpact,
} from '@/lib/payrollCalc.mjs';

const TANGGUNGAN_OPTIONS = [0, 1, 2, 3].map((n) => ({ value: String(n), label: `${n} tanggungan` }));

function Row({ label, value, strong = false, muted = false }) {
  return (
    <tr className={strong ? 'nv-row-strong' : undefined}>
      <th scope="row" className={muted ? 'nv-muted' : undefined}>{label}</th>
      <td className="is-num">{value}</td>
    </tr>
  );
}

function Toggle({ id, label, checked, onChange, hint }) {
  return (
    <label className="nv-check" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-describedby={hint ? `${id}-hint` : undefined} />
      <span>{label}{hint ? <small id={`${id}-hint`} className="nv-muted nv-block">{hint}</small> : null}</span>
    </label>
  );
}

export default function KalkulatorGajiPage() {
  const { addToast } = useToast();
  const [gajiPokok, setGajiPokok] = useState('');
  const [tunjanganTetap, setTunjanganTetap] = useState('');
  const [tunjanganTidakTetap, setTunjanganTidakTetap] = useState('');
  const [status, setStatus] = useState('TK');
  const [tanggungan, setTanggungan] = useState('0');
  const [punyaNpwp, setPunyaNpwp] = useState(true);
  const [bpjs, setBpjs] = useState({ jht: true, jp: true, jkes: true });
  const [lemburAktif, setLemburAktif] = useState(false);
  const [lemburHari, setLemburHari] = useState('biasa');
  const [lemburJam, setLemburJam] = useState('2');
  const [lemburKali, setLemburKali] = useState('4');
  const [thrAktif, setThrAktif] = useState(false);
  const [masaKerja, setMasaKerja] = useState('12');

  const upahBase = toAmount(gajiPokok, { max: 1e12 }) + toAmount(tunjanganTetap, { max: 1e12 });

  const overtime = useMemo(() => calcOvertime({
    upahSebulan: upahBase,
    jenisHari: lemburHari,
    jam: toAmount(lemburJam, { max: 24 }),
  }), [upahBase, lemburHari, lemburJam]);

  const lemburPerBulan = lemburAktif ? overtime.total * toAmount(lemburKali, { max: 31 }) : 0;

  const monthly = useMemo(() => calcMonthlyPayroll({
    gajiPokok: toAmount(gajiPokok, { max: 1e12 }),
    tunjanganTetap: toAmount(tunjanganTetap, { max: 1e12 }),
    tunjanganTidakTetap: toAmount(tunjanganTidakTetap, { max: 1e12 }),
    lemburPerBulan,
    status,
    tanggungan: toAmount(tanggungan, { max: 3 }),
    punyaNpwp,
    bpjs,
  }), [gajiPokok, tunjanganTetap, tunjanganTidakTetap, lemburPerBulan, status, tanggungan, punyaNpwp, bpjs]);

  const thr = useMemo(() => calcThr({ masaKerjaBulan: toAmount(masaKerja, { max: 1200 }), upahSebulan: upahBase }), [masaKerja, upahBase]);
  const thrImpact = useMemo(() => (thrAktif && thr.thr > 0 ? thrTaxImpact({ monthly, thr: thr.thr, punyaNpwp }) : 0), [thrAktif, thr, monthly, punyaNpwp]);

  const hasSalary = monthly.bruto > 0;
  const warnings = [];
  if (hasSalary && !punyaNpwp) warnings.push('Tanpa NPWP, PPh 21 dinaikkan 20% (Pasal 21 ayat 5a UU PPh). Jika NIK sudah terdaftar sebagai NPWP, tanyakan ke kantor pajak.');
  if (status === 'K') warnings.push('Status K dihitung sebagai istri tanpa penghasilan digabung. Jika istri juga bekerja, hasilnya bisa berbeda.');
  if (lemburAktif) warnings.push(...overtime.warnings);
  if (hasSalary && monthly.upah > PAYROLL_RULES.bpjs.jpBatasUpah) warnings.push('Dasar JP dibatasi Rp11.086.300 sejak Maret 2026. Angka di atas sudah memakai batas ini.');

  const exportCsv = () => {
    if (!hasSalary) {
      addToast('Isi gaji pokok dulu sebelum mengunduh hasil.', 'warning');
      return;
    }
    const rows = [
      csvLine(['Komponen', 'Nilai (Rp)']),
      csvLine(['Gaji pokok + tunjangan tetap (dasar BPJS)', monthly.upah]),
      csvLine(['Tunjangan tidak tetap', toAmount(tunjanganTidakTetap)]),
      csvLine(['Lembur per bulan', Math.round(lemburPerBulan)]),
      csvLine(['Total bruto per bulan', monthly.bruto]),
      csvLine(['Potongan JHT 2%', monthly.iuranKaryawan.jht]),
      csvLine(['Potongan JP 1%', monthly.iuranKaryawan.jp]),
      csvLine(['Potongan BPJS Kesehatan 1%', monthly.iuranKaryawan.jkes]),
      csvLine(['PPh 21 per bulan (estimasi)', monthly.pphBulan]),
      csvLine(['Take-home per bulan (estimasi)', monthly.takeHome]),
      csvLine(['PTKP', monthly.ptkpKode]),
      csvLine(['Diperiksa aturan pada', PAYROLL_RULES.diperiksaPada]),
    ];
    downloadText(`\uFEFF${rows.join('\r\n')}\r\n`, 'estimasi-gaji-bersih.csv', 'text/csv;charset=utf-8');
    addToast('CSV estimasi diunduh.', 'success');
  };

  return (
    <ToolShell
      title="Gaji Bersih, THR & Lembur"
      desc="Estimasi take-home pay dengan PPh 21, BPJS, THR, dan lembur. Aturan dan sumbernya ditampilkan."
      icon="wallet"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="warn" title="Ini estimasi, bukan slip gaji">
          Hasil memakai aturan yang diperiksa pada {formatDateId(PAYROLL_RULES.diperiksaPada)}. Perusahaan bisa memakai
          tarif TER per bulan dan selisihnya dihitung di Desember. Untuk angka pasti, cocokkan dengan HRD atau payroll.
        </Notice>

        <Section labelledBy="gaji-input">
          <SectionHead id="gaji-input" eyebrow="LANGKAH 1" title="Gaji dan status">
            Gaji pokok dan tunjangan tetap dipakai sebagai dasar BPJS. Tunjangan tidak tetap dan lembur hanya masuk PPh 21.
          </SectionHead>
          <div className="nv-grid-2">
            <NumberField id="gaji-pokok" label="Gaji pokok per bulan" value={gajiPokok} onChange={setGajiPokok} suffix="Rp" placeholder="0" />
            <NumberField id="gaji-tetap" label="Tunjangan tetap per bulan" value={tunjanganTetap} onChange={setTunjanganTetap} suffix="Rp" placeholder="0" hint="Misalnya tunjangan jabatan atau transport yang selalu dibayar." />
            <NumberField id="gaji-tidak-tetap" label="Tunjangan tidak tetap per bulan" value={tunjanganTidakTetap} onChange={setTunjanganTidakTetap} suffix="Rp" placeholder="0" hint="Bonus rutin bulanan. Tidak masuk dasar BPJS." />
          </div>
          <div className="nv-grid-3">
            <SelectField id="gaji-status" label="Status PTKP" value={status} onChange={setStatus} options={PTKP_STATUS} />
            <SelectField id="gaji-tanggungan" label="Jumlah tanggungan" value={tanggungan} onChange={setTanggungan} options={TANGGUNGAN_OPTIONS} hint="Anak atau keluarga yang dibiayai. Maks. 3." />
            <div className="nv-field">
              <span className="label" id="gaji-ptkp-label">PTKP yang dipakai</span>
              <p className="nv-metric-inline" aria-labelledby="gaji-ptkp-label"><strong>{monthly.ptkpKode}</strong> · {formatRupiah(monthly.ptkp)} per tahun</p>
            </div>
          </div>
          <Toggle id="gaji-npwp" label="Saya punya NPWP" checked={punyaNpwp} onChange={setPunyaNpwp} hint="Tanpa NPWP, PPh 21 dinaikkan 20%." />
          <fieldset className="nv-fieldset">
            <legend className="label">Potongan BPJS yang berlaku di kantor Anda</legend>
            <Toggle id="bpjs-jht" label="JHT (pekerja 2%)" checked={bpjs.jht} onChange={(v) => setBpjs((c) => ({ ...c, jht: v }))} />
            <Toggle id="bpjs-jp" label="Jaminan Pensiun / JP (pekerja 1%, dibatasi Rp11.086.300)" checked={bpjs.jp} onChange={(v) => setBpjs((c) => ({ ...c, jp: v }))} />
            <Toggle id="bpjs-jkes" label="BPJS Kesehatan (pekerja 1%, dibatasi Rp12 juta)" checked={bpjs.jkes} onChange={(v) => setBpjs((c) => ({ ...c, jkes: v }))} />
          </fieldset>
        </Section>

        <Section labelledBy="gaji-lembur">
          <SectionHead id="gaji-lembur" eyebrow="OPSIONAL" title="Lembur">
            Upah sejam = dasar ÷ 173. Jam pertama hari kerja biasa 1,5×, jam berikutnya 2×, mengikuti PP 35/2021.
          </SectionHead>
          <Toggle id="lembur-aktif" label="Hitung lembur ikut dalam estimasi bulanan" checked={lemburAktif} onChange={setLemburAktif} />
          {lemburAktif ? (
            <div className="nv-grid-3">
              <SelectField id="lembur-hari" label="Jenis hari" value={lemburHari} onChange={setLemburHari} options={OVERTIME_DAY_TYPES} />
              <NumberField id="lembur-jam" label="Jam lembur per kejadian" value={lemburJam} onChange={setLemburJam} suffix="jam" />
              <NumberField id="lembur-kali" label="Kejadian per bulan" value={lemburKali} onChange={setLemburKali} suffix="kali" hint="Perkiraan rata-rata." />
            </div>
          ) : null}
          {lemburAktif ? (
            <p className="nv-muted">Upah sejam: <strong>{formatRupiah(overtime.upahSejam)}</strong> · lembur per kejadian <strong>{formatRupiah(overtime.total)}</strong> · per bulan <strong>{formatRupiah(lemburPerBulan)}</strong></p>
          ) : null}
        </Section>

        <Section labelledBy="gaji-thr">
          <SectionHead id="gaji-thr" eyebrow="OPSIONAL" title="THR keagamaan">
            Permenaker 6/2016: masa kerja 12 bulan atau lebih dapat 1 bulan upah. Kurang dari itu proporsional.
          </SectionHead>
          <Toggle id="thr-aktif" label="Tampilkan perkiraan THR" checked={thrAktif} onChange={setThrAktif} />
          {thrAktif ? (
            <div className="nv-grid-2">
              <NumberField id="thr-masa" label="Masa kerja (bulan)" value={masaKerja} onChange={setMasaKerja} suffix="bulan" hint="Hitung sejak mulai bekerja sampai H-7 Hari Raya." />
              <div className="nv-field">
                <span className="label" id="thr-hasil-label">Perkiraan THR</span>
                <p className="nv-metric-inline" aria-labelledby="thr-hasil-label"><strong>{formatRupiah(thr.thr)}</strong> · {thr.rumus}</p>
                {thr.thr > 0 ? <p className="hint">Perkiraan tambahan PPh 21 atas THR: {formatRupiah(thrImpact)} (estimasi tahunan).</p> : null}
              </div>
            </div>
          ) : null}
        </Section>

        {warnings.length ? (
          <div className="nv-stack">
            {warnings.map((text) => <Notice key={text} kind="warn">{text}</Notice>)}
          </div>
        ) : null}

        <Section labelledBy="gaji-hasil">
          <SectionHead id="gaji-hasil" eyebrow="HASIL" title="Estimasi per bulan">
            Angka berubah saat Anda mengisi form. Dibulatkan ke rupiah.
          </SectionHead>
          <div className="nv-metrics">
            <Metric label="Total bruto" value={formatRupiah(monthly.bruto)} />
            <Metric label="Potongan BPJS pekerja" value={formatRupiah(monthly.iuranKaryawan.jht + monthly.iuranKaryawan.jp + monthly.iuranKaryawan.jkes)} />
            <Metric label="PPh 21 bulanan" value={formatRupiah(monthly.pphBulan)} tone="warn" hint={`PKP setahun ${formatRupiah(monthly.tahunan.pkp)}`} />
            <Metric label="Take-home (estimasi)" value={formatRupiah(monthly.takeHome)} tone="strong" />
          </div>

          <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
            <table className="nv-table">
              <caption className="nv-sr-only">Rincian estimasi gaji per bulan</caption>
              <thead><tr><th scope="col">Komponen</th><th scope="col" className="is-num">Nilai</th></tr></thead>
              <tbody>
                <Row label="Gaji pokok + tunjangan tetap (dasar BPJS)" value={formatRupiah(monthly.upah)} />
                <Row label="Tunjangan tidak tetap + lembur" value={formatRupiah(monthly.bruto - monthly.upah)} />
                <Row label="Total bruto" value={formatRupiah(monthly.bruto)} strong />
                <Row label="JHT pekerja (2%)" value={`-${formatRupiah(monthly.iuranKaryawan.jht)}`} />
                <Row label="JP pekerja (1%)" value={`-${formatRupiah(monthly.iuranKaryawan.jp)}`} />
                <Row label="BPJS Kesehatan pekerja (1%)" value={`-${formatRupiah(monthly.iuranKaryawan.jkes)}`} />
                <Row label="PPh 21 per bulan (estimasi)" value={`-${formatRupiah(monthly.pphBulan)}`} />
                <Row label="Take-home per bulan (estimasi)" value={formatRupiah(monthly.takeHome)} strong />
              </tbody>
            </table>
          </div>

          <details className="nv-details">
            <summary>Cara hitung PPh 21 dan asumsi</summary>
            <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
              <table className="nv-table">
                <caption className="nv-sr-only">Perhitungan PPh 21 tahunan</caption>
                <tbody>
                  <Row label="Bruto setahun (bulanan × 12)" value={formatRupiah(monthly.tahunan.bruto)} />
                  <Row label="Biaya jabatan 5% (maks. Rp6 juta setahun)" value={`-${formatRupiah(monthly.tahunan.biayaJabatan)}`} />
                  <Row label="Iuran JHT & JP pekerja setahun" value={`-${formatRupiah(monthly.tahunan.iuranPengurang)}`} />
                  <Row label={`PTKP ${monthly.ptkpKode}`} value={`-${formatRupiah(monthly.tahunan.ptkp)}`} />
                  <Row label="Penghasilan kena pajak (dibulatkan ke ribuan)" value={formatRupiah(monthly.tahunan.pkp)} strong />
                  <Row label={`PPh 21 setahun${punyaNpwp ? '' : ' (+20% tanpa NPWP)'}`} value={formatRupiah(monthly.pphSetahun)} />
                </tbody>
              </table>
            </div>
            <ul className="nv-plain-list nv-assumptions">
              <li>Gaji dianggap sama setiap bulan selama 12 bulan.</li>
              <li>JKK tidak dihitung karena tarifnya bergantung kelas risiko usaha.</li>
              <li>Biaya bulanan tidak mengurangi PPh 21 kecuali JHT dan JP pekerja, sesuai PMK 168/2023.</li>
              <li>Iuran perusahaan (JHT 3,7%, JP 2%, JKes 4%, JKM 0,3%) tidak mengurangi take-home pekerja.</li>
            </ul>
          </details>

          <details className="nv-details">
            <summary>Iuran perusahaan (informasi, tidak mengurangi gaji Anda)</summary>
            <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
              <table className="nv-table">
                <caption className="nv-sr-only">Iuran yang ditanggung perusahaan</caption>
                <tbody>
                  <Row label="JHT perusahaan (3,7%)" value={formatRupiah(monthly.iuranPerusahaan.jht)} />
                  <Row label="JP perusahaan (2%)" value={formatRupiah(monthly.iuranPerusahaan.jp)} />
                  <Row label="BPJS Kesehatan perusahaan (4%)" value={formatRupiah(monthly.iuranPerusahaan.jkes)} />
                  <Row label="JKM (0,3%)" value={formatRupiah(monthly.iuranPerusahaan.jkm)} />
                </tbody>
              </table>
            </div>
          </details>
        </Section>

        <Section labelledBy="gaji-sumber">
          <SectionHead id="gaji-sumber" eyebrow="SUMBER" title="Aturan yang dipakai">
            Diperiksa {formatDateId(PAYROLL_RULES.diperiksaPada)}. Aturan dapat berubah; cek ulang sumber resmi sebelum dipakai untuk keputusan.
          </SectionHead>
          <ol className="nv-plain-list nv-sources">
            {PAYROLL_RULES.sumber.map((item) => (
              <li key={item.judul}>
                {item.judul}{' '}
                <a href={item.tautan} target="_blank" rel="noopener noreferrer">sumber <Icon name="link" size={12} /></a>
              </li>
            ))}
          </ol>
          <div className="nv-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}><Icon name="download" size={14} /> Unduh CSV estimasi</button>
          </div>
        </Section>
      </div>
    </ToolShell>
  );
}
