'use client';

import { useState } from 'react';

const GATEWAYS = {
  instagram: [
    { label: 'fastdl Direct', url: 'https://fastdl/', builder: (raw) => `https://fastdl/?url=${encodeURIComponent(raw)}`, primary: true }
  ]
};

export default function DownloaderPage() {
  const [url, setUrl] = useState('');
  const [toast, setToast] = useState('');

  const handleDownload = () => {
    if (!url.trim()) {
      alert('Masukkan link Instagram terlebih dahulu.');
      return;
    }
    const gateways = GATEWAYS.instagram;
    const primaryGateway = gateways.find(g => g.primary);
    if (primaryGateway) {
      const finalUrl = primaryGateway.builder(url);
      window.open(finalUrl, '_blank');
    } else {
      alert('Tidak ada gateway primary.');
      return;
    }
    // copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setToast('Link disalin, tinggal paste jika belum otomatis terisi');
        setTimeout(() => setToast(''), 3000);
      }).catch(() => {
        alert('Link: ' + url);
      });
    } else {
      alert('Link: ' + url);
    }
  };

  const handleGatewayClick = (gateway) => {
    if (!url.trim()) {
      alert('Masukkan link Instagram terlebih dahulu.');
      return;
    }
    const finalUrl = gateway.builder(url);
    window.open(finalUrl, '_blank');
    // copy juga
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setToast('Link disalin, tinggal paste jika belum otomatis terisi');
        setTimeout(() => setToast(''), 3000);
      }).catch(() => {
        alert('Link: ' + url);
      });
    } else {
      alert('Link: ' + url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Instagram Downloader</h1>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Paste link Instagram di sini..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleDownload}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition duration-200"
        >
          Download
        </button>

        <div className="mt-6">
          <p className="text-sm text-gray-600 mb-2">Gateway Alternatif:</p>
          <div className="flex flex-wrap gap-2">
            {GATEWAYS.instagram.map((gateway, idx) => (
              <button
                key={idx}
                onClick={() => handleGatewayClick(gateway)}
                className={`px-4 py-2 text-sm rounded-md border transition ${
                  gateway.primary
                    ? 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {gateway.label}
              </button>
            ))}
          </div>
        </div>

        {toast && (
          <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-sm">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
