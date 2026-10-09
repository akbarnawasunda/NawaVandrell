'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import { ErrorList, Metric, NumberField, Notice, Section, SectionHead, SelectField } from '@/components/NvUi';
import { useToast } from '@/context/ToastContext';
import { downloadText } from '@/lib/fileDownload.mjs';
import { csvLine, formatPercent, formatRupiah } from '@/lib/format.mjs';
import { LOAN_METHODS, calcLoan, calcSavingsGoal, monthsToGoal } from '@/lib/loanSavings.mjs';

export default function CicilanTabunganPage() {
  const { addToast } = useToast();
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [months, setMonths] = useState('12');
  const [method, setMethod] = useState('anuitas');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [goalMonths, setGoalMonths] = useState('12');
  const [goalRate, setGoalRate] = useState('0');
  const [monthlySaving, setMonthlySaving] = useState('');

  const loan = useMemo(() => calcLoan({
    principal,
    annualRatePct: rate,
    months,
    method,
  }), [principal, rate, months, method]);

  const goal = useMemo(() => calcSavingsGoal({ target, saved, months: goalMonths, annualRatePct: goalRate }), [target, saved, goalMonths, goalRate]);
  const monthsNeeded = useMemo(() => monthsToGoal({ target, saved, monthlySaving, annualRatePct: goalRate }), [target, saved, monthlySaving, goalRate]);

  // Error hanya ditampilkan setelah pengguna mengisi kolom terkait, agar halaman awal tidak terasa penuh merah.
  const loanErrors = loan.valid || (!principal && !rate) ? [] : loan.errors;
  const goalErrors = !target && !saved ? [] : goal.errors || [];

  const exportSchedule = () => {
    if (!loan.valid) {
      addToast('Lengkapi data cicilan dulu.', 'warning');
      return;
    }
    const rows = [
      csvLine(['Bulan', 'Angsuran (Rp)', 'Bunga (Rp)', 'Pokok (Rp)', 'Sisa pokok (Rp)']),
      ...loan.schedule.map((row) => csvLine([row.bulan, Math.round(row.angsuran), Math.round(row.bunga), Math.round(row.pokok), Math.round(row.sisa)])),
    ];
    downloadText(`\uFEFF${rows.join('\r\n')}\r\n`, 'jadwal-cicilan-estimasi.csv', 'text/csv;charset=utf-8');
    addToast('Jadwal cicilan diunduh.', 'success');
  };

  const previewRows = loan.valid ? loan.schedule.slice(0, 12) : [];

  return (
    <ToolShell
      title="Cicilan & Target Tabungan"
      desc="Hitung angsuran per bulan, total bunga, dan setoran tabungan untuk mencapai target. Hasil berupa estimasi."
      icon="chart"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="warn" title="Estimasi, bukan penawaran kredit">
          Angka bisa berbeda dengan penawaran lembaga pembiayaan (biaya admin, asuransi, denda, dan pembulatan).
          Minta simulasi tertulis sebelum memutuskan. Ini bukan nasihat keuangan.
        </Notice>

        <Section labelledBy="cicilan-hitung">
          <SectionHead id="cicilan-hitung" eyebrow="BAGIAN 1" title="Cicilan pinjaman">
            Pilih metode bunga sesuai penawaran. Bunga flat dan anuitas bisa menghasilkan total yang berbeda.
          </SectionHead>
          <ErrorList errors={loanErrors} />
          <div className="nv-grid-2">
            <NumberField id="cicilan-pokok" label="Jumlah pinjaman" value={principal} onChange={setPrincipal} suffix="Rp" placeholder="0" />
            <NumberField id="cicilan-bunga" label="Bunga per tahun" value={rate} onChange={setRate} suffix="%" placeholder="0" hint="Angka tahunan dari penawaran." />
            <NumberField id="cicilan-bulan" label="Jangka waktu" value={months} onChange={setMonths} suffix="bulan" hint="Maksimal 360 bulan." />
            <SelectField id="cicilan-metode" label="Metode bunga" value={method} onChange={setMethod} options={LOAN_METHODS} />
          </div>

          {loan.valid ? (
            <>
              <div className="nv-metrics">
                <Metric label="Angsuran per bulan" value={formatRupiah(loan.monthly)} tone="strong" />
                <Metric label="Total bunga" value={formatRupiah(loan.totalBunga)} tone="warn" />
                <Metric label="Total dibayar" value={formatRupiah(loan.totalBayar)} />
                <Metric label="Perkiraan bunga efektif" value={formatPercent(loan.effectiveAnnualPct, 2)} hint="per tahun" />
              </div>
              {method === 'flat' ? (
                <Notice kind="info" title="Catatan bunga flat">
                  Bunga flat dihitung dari pokok awal, bukan sisa pokok. Karena itu bunga efektifnya lebih tinggi dari angka yang tertulis.
                </Notice>
              ) : null}
              <details className="nv-details">
                <summary>Jadwal angsuran (12 bulan pertama)</summary>
                <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
                  <table className="nv-table">
                    <caption className="nv-sr-only">Jadwal angsuran estimasi</caption>
                    <thead><tr><th scope="col">Bulan</th><th scope="col" className="is-num">Angsuran</th><th scope="col" className="is-num">Bunga</th><th scope="col" className="is-num">Pokok</th><th scope="col" className="is-num">Sisa pokok</th></tr></thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.bulan}>
                          <td>{row.bulan}</td>
                          <td className="is-num">{formatRupiah(row.angsuran)}</td>
                          <td className="is-num">{formatRupiah(row.bunga)}</td>
                          <td className="is-num">{formatRupiah(row.pokok)}</td>
                          <td className="is-num">{formatRupiah(row.sisa)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="nv-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={exportSchedule}><Icon name="download" size={14} /> Unduh jadwal lengkap (CSV)</button>
                </div>
              </details>
            </>
          ) : null}
        </Section>

        <Section labelledBy="tabungan-hitung">
          <SectionHead id="tabungan-hitung" eyebrow="BAGIAN 2" title="Target tabungan">
            Hitung setoran bulanan yang dibutuhkan, atau berapa lama waktu yang diperlukan dengan setoran tertentu.
          </SectionHead>
          <ErrorList errors={goalErrors} />
          <div className="nv-grid-2">
            <NumberField id="tabungan-target" label="Target tabungan" value={target} onChange={setTarget} suffix="Rp" placeholder="0" />
            <NumberField id="tabungan-sudah" label="Sudah terkumpul" value={saved} onChange={setSaved} suffix="Rp" placeholder="0" />
            <NumberField id="tabungan-bulan" label="Target waktu" value={goalMonths} onChange={setGoalMonths} suffix="bulan" />
            <NumberField id="tabungan-bunga" label="Bunga tabungan per tahun (opsional)" value={goalRate} onChange={setGoalRate} suffix="%" hint="Isi 0 bila tidak ada bunga." />
          </div>
          {target ? (
            <div className="nv-metrics">
              <Metric label="Setoran per bulan" value={formatRupiah(goal.monthlyNeeded)} tone="strong" hint={`untuk ${goalMonths || 0} bulan`} />
              <Metric label="Sisa yang harus dikumpulkan" value={formatRupiah(goal.remaining)} />
              <Metric label="Total setoran" value={formatRupiah(goal.totalSetor)} />
              <Metric label="Perkiraan bunga" value={formatRupiah(goal.bungaEstimasi)} hint="bila ada bunga tabungan" />
            </div>
          ) : null}
          <div className="nv-grid-2">
            <NumberField id="tabungan-setoran" label="Atau: setoran per bulan yang bisa Anda sisihkan" value={monthlySaving} onChange={setMonthlySaving} suffix="Rp" placeholder="0" />
            <div className="nv-field">
              <span className="label" id="tabungan-lama-label">Perkiraan waktu mencapai target</span>
              <p className="nv-metric-inline" aria-labelledby="tabungan-lama-label">
                {!target ? <strong>Isi target tabungan dulu</strong> : monthsNeeded === null ? <strong>Isi setoran per bulan</strong> : monthsNeeded === 0 ? <strong>Target sudah tercapai</strong> : <strong>{monthsNeeded} bulan</strong>}
              </p>
            </div>
          </div>
        </Section>

        <section className="nv-section nv-no-print" aria-labelledby="cicilan-asumsi">
          <SectionHead id="cicilan-asumsi" eyebrow="ASUMSI" title="Cara hitung" />
          <ul className="nv-plain-list nv-assumptions">
            <li>Anuitas: angsuran tetap setiap bulan. Bunga dihitung dari sisa pokok tiap bulan (bunga per tahun ÷ 12).</li>
            <li>Flat: bunga total = pokok × bunga per tahun × tahun. Angsuran = (pokok + bunga total) ÷ jumlah bulan.</li>
            <li>Tabungan: setoran dianggap dilakukan di akhir setiap bulan dan bunga dihitung bulanan.</li>
            <li>Hasil tidak mempertimbangkan biaya administrasi, asuransi, pajak bunga, atau kenaikan harga.</li>
          </ul>
        </section>
      </div>
    </ToolShell>
  );
}
