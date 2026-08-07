'use client';

export default function SkeletonLoader({ type = 'text', lines = 3 }) {
  if (type === 'quiz') {
    return (
      <div aria-hidden="true" style={{ display: 'grid', gap: 12 }}>
        <div className="skel" style={{ height: 116, borderRadius: 20 }} />
        <div className="skel" style={{ height: 48, borderRadius: 12 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="skel" style={{ height: 48, flex: 1, borderRadius: 12 }} />
          <div className="skel" style={{ height: 48, flex: 1, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  if (type === 'image') {
    return <div className="skel" aria-hidden="true" style={{ width: '100%', height: 280, borderRadius: 16 }} />;
  }

  if (type === 'cards') {
    return (
      <div className="grid-cards" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skel" style={{ height: 116, borderRadius: 14 }} />
        ))}
      </div>
    );
  }

  return (
    <div aria-hidden="true" style={{ display: 'grid', gap: 9 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skel"
          style={{ height: 14, width: i === lines - 1 ? '62%' : '100%' }}
        />
      ))}
    </div>
  );
}
