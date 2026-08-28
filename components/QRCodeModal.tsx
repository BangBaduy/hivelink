"use client";

import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Download, Copy, Check, QrCode } from "lucide-react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortUrl: string;
  slug: string;
}

export default function QRCodeModal({ isOpen, onClose, shortUrl, slug }: QRCodeModalProps) {
  const [copied, setCopied] = React.useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPNG = () => {
    const svgElement = document.getElementById("qr-code-svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      if (ctx) {
        // Draw white background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw SVG image
        ctx.drawImage(img, 20, 20, 360, 360);
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `hivelab-qr-${slug}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-deep/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 sm:p-8 flex flex-col items-center text-center relative transition-transform transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-deep transition-colors p-1 rounded-lg hover:bg-slate-100"
          aria-label="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-2 text-emerald-cta mb-2">
          <QrCode className="w-6 h-6" />
          <span className="font-bold tracking-wide text-xs uppercase text-emerald-600">HiveLab Link QR Code</span>
        </div>
        <h3 className="text-xl font-bold text-slate-deep mb-1">Scan or Share</h3>
        <p className="text-xs text-slate-500 mb-6 truncate max-w-full px-2">{shortUrl}</p>

        {/* QR Code Canvas Frame */}
        <div className="p-4 bg-ivory-100 rounded-xl border border-slate-200 shadow-inner mb-6 flex items-center justify-center">
          <QRCodeSVG
            id="qr-code-svg"
            value={shortUrl}
            size={180}
            bgColor="#FDFBF7"
            fgColor="#1E293B"
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Actions */}
        <div className="w-full space-y-2.5">
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-medium text-sm border border-slate-200 hover:border-slate-300 text-slate-deep bg-ivory-50 hover:bg-white transition-all shadow-sm active:scale-[0.98]"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-cta" />
                <span className="text-emerald-600 font-semibold">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copy Short URL</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadPNG}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-emerald-cta text-white hover:bg-emerald-hover transition-all shadow-md active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG Image</span>
          </button>
        </div>
      </div>
    </div>
  );
}
