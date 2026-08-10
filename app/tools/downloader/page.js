'use client';

import { useState, useCallback } from 'react';

const GATEWAYS = {
  instagram: [
    {
      label: 'fastdl Direct',
      url: 'https://fastdl/',
      builder: (raw) => `https://fastdl/?url=${encodeURIComponent(raw)}`,
      primary: true,
    },
  ],
};

export default function DownloaderPage() {
  const [inputUrl, setInputUrl] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const isValidInstagramUrl = (url) => {
    try {
      const u = new URL(url);
      return u.hostname.includes('instagram.com');
    } catch {
      return false;
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback: ignore or alert
      console.warn('Clipboard write failed');
    }
  };

  const handleDownload = useCallback(() => {
    const url = inputUrl.trim();
    if (!url) {
      showToast('Masukkan link Instagram terlebih dahulu');
      return;
    }
    if (!isValidInstagramUrl(url)) {
      showToast('URL Instagram tidak valid');
      return;
    }

    const primaryGateway = GATEWAYS.instagram.find((g) => g.primary);
    if (!primaryGateway) {
      showToast('Gateway utama tidak ditemukan');
      return;
    }

    if (typeof primaryGateway.builder === 'function') {
      const finalLink = primaryGateway.builder(url);
      window.open(finalLink, '_blank');
    } else {
      // fallback: open base url with query (just in case)
      window.open(primaryGateway.url + encodeURIComponent(url), '_blank');
    }

    copyToClipboard(url);
    showToast('Link disalin, tinggal paste jika belum otomatis terisi');
  }, [inputUrl]);

  const handleAlternative = useCallback(
    (gateway) => {
      const url = inputUrl.trim();
      if (!url) {
        showToast('Masukkan link Instagram terlebih dahulu');
        return;
      }
      if (!isValidInstagramUrl(url)) {
        showToast('URL Instagram tidak valid');
        return;
      }

      if (typeof gateway.builder === 'function') {
        const finalLink = gateway.builder(url);
        window.open(finalLink, '_blank');
      } else if (gateway.url) {
        window.open(gateway.url + encodeURIComponent(url), '_blank');
      }

      copyToClipboard(url);
      showToast('Link disalin, tinggal paste jika belum otomatis terisi');
    },
    [inputUrl],
  );

  const alternativeGateways = GATEWAYS.instagram.filter((g) => !g.primary);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-800">
          Instagram Downloader
        </h1>

        {/* Toast */}
        {toast && (
          <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg text-sm text-center transition-opacity duration-300">
            {toast}
          </div>
        )}

        {/* Input area */}
        <div className="space-y-2">
          <label htmlFor="ig-url" className="block text-sm font-medium text-gray-600">
            Paste link Instagram
          </label>
          <input
            id="ig-url"
            type="url"
            placeholder="https://www.instagram.com/p/..."
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-shadow text-sm sm:text-base"
          />
        </div>

        {/* Primary download button */}
        <button
          onClick={handleDownload}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-md hover:shadow-lg text-sm sm:text-base"
        >
          Download
        </button>

        {/* Alternative gateways (if any) */}
        {alternativeGateways.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Gateway Alternatif
            </p>
            <div className="flex flex-wrap gap-2">
              {alternativeGateways.map((gateway, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAlternative(gateway)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  {gateway.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Link akan otomatis disalin ke clipboard sebagai cadangan.
        </p>
      </div>
    </main>
  );
}
