'use client';

import { useEffect, useMemo, useState } from 'react';
import ToolShell from '@/components/ToolShell';
import Icon from '@/components/icons';
import LocalDataPanel from '@/components/LocalDataPanel';
import { Metric, Notice, Section, SectionHead, SelectField, TextAreaField, TextField } from '@/components/NvUi';
import { useToast } from '@/context/ToastContext';
import { downloadText, safeFileName } from '@/lib/fileDownload.mjs';
import { todayIso } from '@/lib/format.mjs';
import { createLocalCollection } from '@/lib/localData.mjs';
import {
  GRADES,
  MAX_CARDS_PER_DECK,
  createDeck,
  deckCsv,
  deckStats,
  dueCards,
  newCard,
  parseCardsText,
  previewIntervals,
  review,
  sanitizeDeck,
} from '@/lib/flashcards.mjs';

const store = createLocalCollection({ name: 'flashcard', version: 1, sanitize: sanitizeDeck, maxItems: 50 });

function dayLabel(days) {
  if (days === 0) return 'hari ini';
  if (days === 1) return 'besok';
  return `${days} hari lagi`;
}

export default function FlashcardPage() {
  const { addToast } = useToast();
  const [decks, setDecks] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [meta, setMeta] = useState({ available: true, corrupt: false, updatedAt: '' });
  const [today, setToday] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [sessionDone, setSessionDone] = useState(0);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [bulk, setBulk] = useState('');
  const [newDeckName, setNewDeckName] = useState('');
  const [liveMessage, setLiveMessage] = useState('');

  useEffect(() => {
    const loaded = store.load();
    setDecks(loaded.items);
    setMeta({ available: loaded.available, corrupt: loaded.corrupt, updatedAt: loaded.updatedAt });
    setActiveId(loaded.items[0]?.id || '');
    setToday(todayIso());
  }, []);

  const active = decks.find((deck) => deck.id === activeId) || null;
  const stats = useMemo(() => (active ? deckStats(active.cards, today) : { total: 0, due: 0, baru: 0, dikuasai: 0 }), [active, today]);
  const queue = useMemo(() => (active ? dueCards(active.cards, today) : []), [active, today]);
  const current = queue[0] || null;
  const totalToday = sessionDone + queue.length;

  const persist = (next) => {
    try {
      const clean = store.save(next);
      setDecks(clean);
      return true;
    } catch (error) {
      addToast(error.message, 'error', 6000);
      return false;
    }
  };

  const updateActive = (mutate) => {
    if (!active) return false;
    const nextDeck = { ...mutate(active), diubah: new Date().toISOString() };
    return persist(decks.map((deck) => (deck.id === active.id ? nextDeck : deck)));
  };

  const grade = (value) => {
    if (!current || !revealed) return;
    const updated = review(current, value, today);
    const label = GRADES.find((g) => g.value === value)?.label;
    if (updateActive((deck) => ({ ...deck, cards: deck.cards.map((card) => (card.id === current.id ? updated : card)) }))) {
      setSessionDone((n) => n + 1);
      setRevealed(false);
      const preview = previewIntervals(updated, today).find((row) => row.grade === value);
      setLiveMessage(`${label}. Kartu berikutnya. ${preview ? `Kartu ini muncul lagi ${dayLabel(preview.days)}.` : ''}`);
    }
  };

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
      if ((event.key === ' ' || event.key === 'Enter') && current && !revealed) {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        const grade2 = GRADES[Number(event.key) - 1];
        if (grade2) grade(grade2.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, revealed, active, decks]);

  const createNewDeck = () => {
    if (decks.length >= 50) {
      addToast('Batas 50 dek per perangkat.', 'warning');
      return;
    }
    const deck = createDeck(newDeckName || 'Dek baru');
    if (persist([deck, ...decks])) {
      setActiveId(deck.id);
      setNewDeckName('');
      setSessionDone(0);
      addToast('Dek dibuat.', 'success');
    }
  };

  const renameDeck = () => {
    if (!active) return;
    const name = window.prompt('Nama dek baru:', active.nama);
    if (name === null) return;
    updateActive((deck) => ({ ...deck, nama: name.trim().slice(0, 80) || deck.nama }));
  };

  const deleteDeck = () => {
    if (!active) return;
    if (!window.confirm(`Hapus dek “${active.nama}” beserta ${active.cards.length} kartunya dari perangkat ini?`)) return;
    persist(decks.filter((deck) => deck.id !== active.id));
    setActiveId('');
    addToast('Dek dihapus dari perangkat ini.', 'success');
  };

  const addCard = () => {
    if (!active) {
      addToast('Buat dek dulu.', 'warning');
      return;
    }
    if (!front.trim() || !back.trim()) {
      addToast('Isi bagian depan dan belakang kartu.', 'warning');
      return;
    }
    if (active.cards.length >= MAX_CARDS_PER_DECK) {
      addToast(`Maksimal ${MAX_CARDS_PER_DECK} kartu per dek.`, 'warning');
      return;
    }
    if (updateActive((deck) => ({ ...deck, cards: [...deck.cards, newCard(front, back, today)] }))) {
      setFront('');
      setBack('');
      addToast('Kartu ditambahkan. Muncul hari ini.', 'success');
    }
  };

  const importBulk = () => {
    if (!active) {
      addToast('Buat dek dulu.', 'warning');
      return;
    }
    const { cards, skipped } = parseCardsText(bulk);
    if (!cards.length) {
      addToast('Tidak ada baris yang bisa dibaca. Pakai format “depan;belakang”.', 'warning', 5200);
      return;
    }
    const room = MAX_CARDS_PER_DECK - active.cards.length;
    const toAdd = cards.slice(0, Math.max(0, room));
    if (updateActive((deck) => ({ ...deck, cards: [...deck.cards, ...toAdd.map((c) => newCard(c.depan, c.belakang, today))] }))) {
      setBulk('');
      addToast(`${toAdd.length} kartu ditambahkan${skipped ? `, ${skipped} baris dilewati` : ''}${cards.length > toAdd.length ? '. Sisanya melebihi batas 500 kartu.' : '.'}`, 'success', 6000);
    }
  };

  const deleteCard = (id) => {
    updateActive((deck) => ({ ...deck, cards: deck.cards.filter((card) => card.id !== id) }));
  };

  const resetSchedule = () => {
    if (!active) return;
    if (!window.confirm('Ulangi jadwal dek ini dari awal? Semua kartu kembali menjadi kartu baru untuk hari ini.')) return;
    updateActive((deck) => ({ ...deck, cards: deck.cards.map((card) => ({ ...card, ef: 2.5, interval: 0, reps: 0, lapses: 0, due: today })) }));
    setSessionDone(0);
  };

  const downloadCsv = () => {
    if (!active) return;
    downloadText(deckCsv(active), `${safeFileName(active.nama)}.csv`, 'text/csv;charset=utf-8');
    addToast('CSV dek diunduh.', 'success');
  };

  const previews = current && revealed ? previewIntervals(current, today) : [];

  return (
    <ToolShell
      title="Flashcard Pengulangan"
      desc="Hafalkan kosakata, rumus, atau materi dengan jadwal ulang otomatis. Data hanya tersimpan di perangkat ini."
      icon="book"
      className="nv-tool-wide"
    >
      <div className="nv-stack">
        <Notice kind="info" title="Cara pakai">
          Buka jawaban, lalu nilai seberapa mudah Anda mengingatnya. Kartu yang sulit muncul lebih sering. Tekan Spasi untuk membuka, lalu 1–4 untuk menilai.
        </Notice>

        <Section labelledBy="fc-dek">
          <SectionHead id="fc-dek" eyebrow="DEK" title="Pilih atau buat dek">
            Satu dek untuk satu topik, misalnya “Kosakata Inggris” atau “Pasal KUHP”.
          </SectionHead>
          <div className="nv-grid-2">
            <SelectField id="fc-pilih" label="Dek aktif" value={activeId} onChange={(v) => { setActiveId(v); setRevealed(false); setSessionDone(0); }} options={decks.length ? decks.map((d) => ({ value: d.id, label: `${d.nama} (${d.cards.length} kartu)` })) : [{ value: '', label: 'Belum ada dek' }]} />
            <TextField id="fc-dek-baru" label="Nama dek baru" value={newDeckName} onChange={setNewDeckName} maxLength={80} placeholder="Contoh: Kosakata Bahasa Inggris" />
          </div>
          <div className="nv-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={createNewDeck} disabled={!meta.available}><Icon name="plus" size={14} /> Buat dek</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={renameDeck} disabled={!active}><Icon name="edit" size={14} /> Ganti nama</button>
            <button type="button" className="btn btn-ghost btn-sm nv-danger-button" onClick={deleteDeck} disabled={!active}><Icon name="trash" size={14} /> Hapus dek</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={downloadCsv} disabled={!active || !active.cards.length}><Icon name="download" size={14} /> Unduh CSV</button>
          </div>
        </Section>

        {active ? (
          <>
            <div className="nv-metrics">
              <Metric label="Jatuh tempo hari ini" value={stats.due} tone={stats.due ? 'warn' : 'default'} />
              <Metric label="Kartu baru" value={stats.baru} />
              <Metric label="Sudah kuat (≥ 21 hari)" value={stats.dikuasai} tone="strong" />
              <Metric label="Total kartu" value={stats.total} />
            </div>

            <Section labelledBy="fc-belajar">
              <SectionHead id="fc-belajar" eyebrow="BELAJAR" title={stats.due ? `Sisa ${queue.length} kartu hari ini` : 'Tidak ada kartu jatuh tempo'}>
                {sessionDone ? `Sudah ${sessionDone} kartu hari ini dari ${totalToday}.` : 'Kartu yang jatuh tempo akan muncul di sini.'}
              </SectionHead>
              <div className="nv-sr-only" aria-live="polite">{liveMessage}</div>
              {current ? (
                <article className="nv-flashcard" aria-label="Kartu aktif">
                  <p className="nv-eyebrow">DEPAN</p>
                  <p className="nv-flashcard-text">{current.depan}</p>
                  {revealed ? (
                    <>
                      <hr className="nv-flashcard-rule" />
                      <p className="nv-eyebrow">BELAKANG</p>
                      <p className="nv-flashcard-text">{current.belakang}</p>
                    </>
                  ) : null}
                </article>
              ) : active.cards.length ? (
                <p className="nv-notice is-ok" role="status">Semua kartu hari ini sudah diulang. Kembali besok untuk sesi berikutnya.</p>
              ) : (
                <p className="nv-muted">Dek ini masih kosong. Tambahkan kartu di bawah.</p>
              )}

              {current && !revealed ? (
                <button type="button" className="btn btn-primary btn-full" onClick={() => setRevealed(true)}>Lihat jawaban <span className="nv-kbd" aria-hidden="true">Spasi</span></button>
              ) : null}

              {current && revealed ? (
                <div className="nv-grade-grid" role="group" aria-label="Nilai ingatan">
                  {GRADES.map((item, index) => {
                    const preview = previews.find((row) => row.grade === item.value);
                    return (
                      <button key={item.value} type="button" className={`nv-grade is-${item.value}`} onClick={() => grade(item.value)}>
                        <span className="nv-grade-key" aria-hidden="true">{index + 1}</span>
                        <strong>{item.label}</strong>
                        <small>{preview ? `muncul ${dayLabel(preview.days)}` : item.hint}</small>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </Section>

            <Section labelledBy="fc-kartu">
              <SectionHead id="fc-kartu" eyebrow="KARTU" title="Tambah dan kelola kartu">
                Tambah satu kartu, atau tempel banyak sekaligus dengan format “depan;belakang” per baris.
              </SectionHead>
              <div className="nv-grid-2">
                <TextField id="fc-depan" label="Depan" value={front} onChange={setFront} maxLength={500} />
                <TextField id="fc-belakang" label="Belakang" value={back} onChange={setBack} maxLength={500} />
              </div>
              <div className="nv-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={addCard}><Icon name="plus" size={14} /> Tambah kartu</button>
              </div>
              <TextAreaField id="fc-massal" label="Tempel banyak kartu (satu per baris)" value={bulk} onChange={setBulk} rows={4} maxLength={20000} placeholder={'apple;apel\nbook;buku'} hint="Pemisah yang dikenali: titik koma, tab, atau “ | ”." />
              <div className="nv-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={importBulk} disabled={!bulk.trim()}><Icon name="upload" size={14} /> Tambahkan dari teks</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={resetSchedule} disabled={!active.cards.length}><Icon name="refresh" size={14} /> Ulangi jadwal dari awal</button>
              </div>
              {active.cards.length ? (
                <div className="nv-table-wrap" tabIndex={0} role="region" aria-label="Tabel, geser ke samping bila perlu">
                  <table className="nv-table">
                    <caption className="nv-sr-only">Kartu dalam dek ini</caption>
                    <thead><tr><th scope="col">Depan</th><th scope="col">Belakang</th><th scope="col">Jatuh tempo</th><th scope="col"><span className="nv-sr-only">Aksi</span></th></tr></thead>
                    <tbody>
                      {active.cards.slice(0, 200).map((card) => (
                        <tr key={card.id}>
                          <td>{card.depan}</td>
                          <td>{card.belakang}</td>
                          <td>{card.due <= today ? 'Hari ini' : card.due}</td>
                          <td><button type="button" className="nv-icon-button is-danger" onClick={() => deleteCard(card.id)} aria-label={`Hapus kartu ${card.depan}`}><Icon name="trash" size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {active.cards.length > 200 ? <p className="hint">Menampilkan 200 kartu pertama. Semua kartu tetap ikut dalam sesi belajar dan ekspor.</p> : null}
                </div>
              ) : null}
            </Section>
          </>
        ) : (
          <Notice kind="info" title="Mulai dengan satu dek">
            Buat dek baru di atas, lalu tambahkan kartu. Semua kartu tersimpan di perangkat ini.
          </Notice>
        )}

        {meta.corrupt ? <Notice kind="bad" title="Data tidak terbaca">Data lama tidak diubah. Gunakan panel cadangan di bawah untuk mengekspor atau menghapusnya.</Notice> : null}

        {today ? (
          <LocalDataPanel
            title="Cadangan dek flashcard"
            store={store}
            items={decks}
            setItems={(items) => { setDecks(items); setActiveId((id) => (items.some((d) => d.id === id) ? id : items[0]?.id || '')); }}
            corrupt={meta.corrupt}
            available={meta.available}
            updatedAt={meta.updatedAt}
            fileBase="flashcard"
          />
        ) : null}
      </div>
    </ToolShell>
  );
}
