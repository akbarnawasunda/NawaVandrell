'use client';

import { useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import { useToast } from '@/context/ToastContext';
import Icon from '@/components/icons';

const TEMPLATES = [
  { id: 'kurir', label: 'Chat Kurir', text: 'Halo kak, paket saya sudah sampai mana ya? Mohon info tracking-nya. Terima kasih.' },
  { id: 'olshop', label: 'Tanya Olshop', text: 'Halo kak, mau tanya untuk produk ini stok masih ready? Bisa kirim hari ini?' },
  { id: 'shareloc', label: 'Kirim Shareloc', text: 'Halo, posisi saya sudah saya shareloc ya. Ditunggu kedatangannya, terima kasih.' },
  { id: 'sopan', label: 'Basa-basi Sopan', text: 'Halo, selamat siang. Maaf mengganggu waktunya, boleh minta tolong sebentar?' },
];

function normalizeNumber(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  else if (!digits.startsWith('62')) return '';
  if (digits.length < 10 || digits.length > 15) return '';
  return digits;
}

export default function WaDirectPage() {
  const { addToast } = useToast();
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [activeTpl, setActiveTpl] = useState('');

  const normalized = useMemo(() => normalizeNumber(number), [number]);

  const applyTemplate = (tpl) => {
    setMessage(tpl.text);
    setActiveTpl(tpl.id);
    addToast(`Template "${tpl.label}" dipakai`, 'info');
  };

  const openWa = () => {
    if (!normalized) {
      addToast('Nomor tidak valid. Contoh: 0812xxxxxxx', 'error');
      return;
    }
    const url = `https://wa.me/${normalized}${
      message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ''
    }`;
    window.open(url, '_blank', 'noopener');
    addToast('Membuka WhatsApp...', 'success');
  };

  return (
    <ToolShell
      title="WA Direct Chat"
      desc="Chat WhatsApp tanpa save nomor. Pilih template, klik, langsung terhubung."
      icon="chat"
    >
      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="wa-number">
            Nomor WhatsApp
          </label>
          <input
            id="wa-number"
            className="input"
            inputMode="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="0812xxxxxxx / 62812xxxxxxx"
          />
          {number ? (
            <p className="hint">
              {normalized
                ? `Terformat: +${normalized}`
                : 'Nomor belum valid. Mulai dengan 08 / 8 / 62.'}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="label">Template cepat</label>
          <div className="chips" style={{ justifyContent: 'flex-start' }}>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="chip"
                aria-pressed={activeTpl === t.id}
                onClick={() => applyTemplate(t)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="wa-message">
            Pesan (opsional)
          </label>
          <textarea
            id="wa-message"
            className="textarea"
            style={{ minHeight: 110 }}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setActiveTpl('');
            }}
            placeholder="Ketik pesan atau pakai template di atas..."
          />
        </div>

        <button type="button" className="btn btn-primary btn-full" onClick={openWa}>
          <Icon name="link" size={16} />
          Buka WhatsApp
        </button>

        <p className="hint">
          Nomor tidak disimpan ke server. Semua diproses langsung di browser kamu.
        </p>
      </div>
    </ToolShell>
  );
}
