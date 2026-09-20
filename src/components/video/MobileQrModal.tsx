import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  Smartphone, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  ShieldCheck, 
  Globe 
} from 'lucide-react';

interface MobileQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileQrModal: React.FC<MobileQrModalProps> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Initialize and track current website URL
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location) {
      const currentUrl = window.location.href;
      setUrl(currentUrl);
    }
  }, [isOpen]);

  // Generate QR code whenever the URL changes or modal opens
  useEffect(() => {
    if (!isOpen || !url) return;

    QRCode.toDataURL(url, {
      width: 260,
      margin: 2,
      color: {
        dark: '#030712', // Deep near-black for maximum contrast
        light: '#ffffff', // Pure white background for camera autofocus
      },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        setQrDataUrl(dataUrl);
        setQrError(null);
      })
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
        setQrError('Unable to generate QR code for this URL');
      });
  }, [isOpen, url]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b1018] border border-cyan-800/80 rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col text-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-qr-title"
      >
        {/* Header */}
        <div className="bg-[#0e1624] border-b border-[#1e293b] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 id="mobile-qr-title" className="text-sm font-bold font-mono-tech tracking-wide text-slate-100 flex items-center gap-2">
                MOBILE WORKSTATION ACCESS
                <span className="text-[10px] bg-cyan-950 border border-cyan-600/60 text-cyan-300 px-1.5 py-0.2 rounded">
                  QR SCAN
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Scan with your phone camera to open this live website on mobile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col items-center gap-4">
          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-xl shadow-lg border-2 border-cyan-500/40 flex flex-col items-center justify-center">
            {qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="QR code to open this website on mobile" 
                className="w-56 h-56 block rounded select-none"
              />
            ) : qrError ? (
              <div className="w-56 h-56 flex items-center justify-center text-rose-500 text-xs font-mono-tech text-center p-2">
                {qrError}
              </div>
            ) : (
              <div className="w-56 h-56 flex flex-col items-center justify-center gap-2 text-slate-400">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono-tech text-slate-600">Generating QR...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono-tech text-cyan-300/90 bg-cyan-950/40 border border-cyan-900/60 px-3 py-1 rounded-full">
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>Point iPhone or Android camera at code</span>
          </div>

          {/* URL & Copy Bar */}
          <div className="w-full space-y-1.5">
            <label className="text-[11px] font-mono-tech uppercase text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                Website URL:
              </span>
              <span className="text-[10px] text-slate-500">Live Active Endpoint</span>
            </label>

            <div className="flex items-center gap-1.5 bg-[#060a11] border border-[#1e293b] rounded-lg p-1.5">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                title="Website URL to encode into QR code"
                className="flex-1 bg-transparent px-2 py-0.5 text-xs font-mono-tech text-slate-200 focus:outline-none truncate selection:bg-cyan-800"
              />
              <button
                onClick={handleCopy}
                className={`px-2.5 py-1 rounded text-xs font-mono-tech flex items-center gap-1 transition-all cursor-pointer ${
                  copied 
                    ? 'bg-emerald-600 text-white font-semibold' 
                    : 'bg-cyan-950 hover:bg-cyan-900 text-cyan-200 border border-cyan-700'
                }`}
                title="Copy website URL"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>COPIED!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY</span>
                  </>
                )}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Instructions */}
          <div className="w-full bg-[#080e18] border border-[#1e293b] rounded-lg p-3 text-xs text-slate-300 space-y-1.5">
            <div className="text-[11px] font-mono-tech text-slate-400 font-semibold uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              How to Connect:
            </div>
            <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-1 leading-relaxed pl-1">
              <li>Open your phone's built-in <span className="text-slate-200">Camera</span> app.</li>
              <li>Scan the QR code on your computer screen.</li>
              <li>Tap the pop-up notification link to load this workstation.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#090f1a] border-t border-[#1e293b] px-5 py-3 flex items-center justify-between text-xs">
          <span className="text-[10px] font-mono-tech text-slate-500">
            SECURE REVERSE PROXY ACCESS (PORT 3000)
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-mono-tech text-xs transition-colors cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
