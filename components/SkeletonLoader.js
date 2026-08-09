'use client';
export default function SkeletonLoader({ type = 'text', lines = 3, animate = true }) {
  const baseStyle = animate ? undefined : { animation: 'none', opacity: 0.5 };

  if (type === 'quiz') {
    return (
      <div aria-hidden="true" aria-busy="true" style={{ display: 'grid', gap: 12 }}>
        <div className="skel" style={{ height: 116, borderRadius: 20, ...baseStyle }} />
        <div className="skel" style={{ height: 48, borderRadius: 12, ...baseStyle }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skel" style={{ height: 48, flex: 1, borderRadius: 12, ...baseStyle }} />
          <div className="skel" style={{ height: 48, flex: 1, borderRadius: 12, ...baseStyle }} />
        </div>
      </div>
    );
  }

  if (type === 'image') return <div className="skel" aria-hidden="true" aria-busy="true" style={{ width: '100%', height: 280, borderRadius: 16, ...baseStyle }} />;

  if (type === 'cards') {
    return (
      <div className="grid-cards" aria-hidden="true" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel" style={{ height: 116, borderRadius: 14, ...baseStyle }} />)}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div aria-hidden="true" aria-busy="true" style={{ display: 'grid', gap: 12 }}>
        <div className="skel" style={{ height: 200, borderRadius: 12, ...baseStyle }} />
        <div className="skel" style={{ height: 18, width: '75%', ...baseStyle }} />
        <div className="skel" style={{ height: 14, width: '45%', ...baseStyle }} />
        <div style={{ display: 'grid', gap: 9 }}>
          <div className="skel" style={{ height: 48, borderRadius: 12, ...baseStyle }} />
          <div className="skel" style={{ height: 48, borderRadius: 12, opacity: 0.7, ...baseStyle }} />
        </div>
      </div>
    );
  }

  if (type === 'result') {
    return (
      <div aria-hidden="true" aria-busy="true" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 15, display: 'grid', gap: 10 }}>
        <div className="skel" style={{ height: 12, width: '30%', ...baseStyle }} />
        <div className="skel" style={{ height: 14, width: '100%', ...baseStyle }} />
        <div className="skel" style={{ height: 14, width: '88%', ...baseStyle }} />
        <div className="skel" style={{ height: 14, width: '62%', ...baseStyle }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <div className="skel" style={{ height: 38, flex: 1, borderRadius: 10, ...baseStyle }} />
          <div className="skel" style={{ height: 38, width: 90, borderRadius: 10, ...baseStyle }} />
        </div>
      </div>
    );
  }

  if (type === 'stats') {
    return (
      <div aria-hidden="true" aria-busy="true" style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 9 }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skel" style={{ height: 64, flex: 1, borderRadius: 12, ...baseStyle }} />)}
        </div>
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skel" style={{ height: 46, borderRadius: 12, opacity: 1 - i * 0.12, ...baseStyle }} />)}
      </div>
    );
  }

  return (
    <div aria-hidden="true" aria-busy="true" style={{ display: 'grid', gap: 9 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skel" style={{ height: 14, width: i === lines - 1 ? '62%' : '100%', ...baseStyle }} />
      ))}
    </div>
  );
}
