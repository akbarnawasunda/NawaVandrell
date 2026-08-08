// components/SkeletonLoader.js

'use client';

/**
 * Skeleton loading states.
 *
 * Props:
 * - type: 'text' | 'quiz' | 'image' | 'cards' | 'video' | 'result' | 'stats'
 * - lines: jumlah baris untuk type 'text' (default 3)
 * - animate: boolean (default true) — set false kalau mau static
 */
export default function SkeletonLoader({ type = 'text', lines = 3, animate = true }) {
  const baseStyle = animate ? undefined : { animation: 'none', opacity: 0.5 };

  /* ---------- QUIZ / GAME ---------- */
  if (type === 'quiz') {
    return (
      <div aria-hidden="true" aria-busy="true" style={{ display: 'grid', gap: 12 }}>
        {/* Question block */}
        <div className="skel" style={{ height: 116, borderRadius: 20, ...baseStyle }} />

        {/* Answer input */}
        <div className="skel" style={{ height: 48, borderRadius: 12, ...baseStyle }} />

        {/* Two action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skel" style={{ height: 48, flex: 1, borderRadius: 12, ...baseStyle }} />
          <div className="skel" style={{ height: 48, flex: 1, borderRadius: 12, ...baseStyle }} />
        </div>
      </div>
    );
  }

  /* ---------- IMAGE / CANVAS ---------- */
  if (type === 'image') {
    return (
      <div
        className="skel"
        aria-hidden="true"
        aria-busy="true"
        style={{ width: '100%', height: 280, borderRadius: 16, ...baseStyle }}
      />
    );
  }

  /* ---------- CARD GRID ---------- */
  if (type === 'cards') {
    return (
      <div className="grid-cards" aria-hidden="true" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skel" style={{ height: 116, borderRadius: 14, ...baseStyle }} />
        ))}
      </div>
    );
  }

  /* ---------- VIDEO / DOWNLOADER ---------- */
  if (type === 'video') {
    return (
      <div aria-hidden="true" aria-busy="true" style={{ display: 'grid', gap: 12 }}>
        {/* Thumbnail */}
        <div className="skel" style={{ height: 200, borderRadius: 12, ...baseStyle }} />

        {/* Title */}
        <div className="skel" style={{ height: 18, width: '75%', ...baseStyle }} />

        {/* Author / meta */}
        <div className="skel" style={{ height: 14, width: '45%', ...baseStyle }} />

        {/* Download buttons */}
        <div style={{ display: 'grid', gap: 9 }}>
          <div className="skel" style={{ height: 48, borderRadius: 12, ...baseStyle }} />
          <div className="skel" style={{ height: 48, borderRadius: 12, opacity: 0.7, ...baseStyle }} />
          <div className="skel" style={{ height: 48, borderRadius: 12, opacity: 0.5, ...baseStyle }} />
        </div>
      </div>
    );
  }

  /* ---------- RESULT / OUTPUT ---------- */
  if (type === 'result') {
    return (
      <div
        aria-hidden="true"
        aria-busy="true"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 15,
          display: 'grid',
          gap: 10,
        }}
      >
        {/* Header label */}
        <div className="skel" style={{ height: 12, width: '30%', ...baseStyle }} />

        {/* Content lines */}
        <div className="skel" style={{ height: 14, width: '100%', ...baseStyle }} />
        <div className="skel" style={{ height: 14, width: '88%', ...baseStyle }} />
        <div className="skel" style={{ height: 14, width: '62%', ...baseStyle }} />

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <div className="skel" style={{ height: 38, flex: 1, borderRadius: 10, ...baseStyle }} />
          <div className="skel" style={{ height: 38, width: 90, borderRadius: 10, ...baseStyle }} />
        </div>
      </div>
    );
  }

  /* ---------- STATS / LEADERBOARD ---------- */
  if (type === 'stats') {
    return (
      <div aria-hidden="true" aria-busy="true" style={{ display: 'grid', gap: 8 }}>
        {/* Stat row */}
        <div style={{ display: 'flex', gap: 9 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="skel"
              style={{ height: 64, flex: 1, borderRadius: 12, ...baseStyle }}
            />
          ))}
        </div>

        {/* Leaderboard rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`row-${i}`}
            className="skel"
            style={{
              height: 46,
              borderRadius: 12,
              opacity: 1 - i * 0.12,
              ...baseStyle,
            }}
          />
        ))}
      </div>
    );
  }

  /* ---------- DEFAULT: TEXT LINES ---------- */
  return (
    <div aria-hidden="true" aria-busy="true" style={{ display: 'grid', gap: 9 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skel"
          style={{
            height: 14,
            width: i === lines - 1 ? '62%' : '100%',
            ...baseStyle,
          }}
        />
      ))}
    </div>
  );
}
