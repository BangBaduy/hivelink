"use client";

import React, { useState } from "react";
import { Link2, Sparkles, ShieldCheck, AlertCircle, Copy, Check, QrCode, ArrowRight, Loader2, Lock, LogIn } from "lucide-react";
import QRCodeModal from "./QRCodeModal";

interface ShortenerFormProps {
  isAuthenticated: boolean;
  userId: string | null;
  onSignInClick: () => void;
  onUrlCreated: () => void;
}

export default function ShortenerForm({ isAuthenticated, userId, onSignInClick, onUrlCreated }: ShortenerFormProps) {
  const [url, setUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ shortUrl: string; slug: string; originalUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResult(null);

    if (!url.trim()) {
      setErrorMsg("Please enter a valid URL.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          customSlug: customSlug.trim(),
          title: title.trim(),
          userId: isAuthenticated ? userId : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "An error occurred while creating the short URL.");
      } else {
        const fullShortUrl = `${window.location.origin}/${data.data.short_slug}`;
        setResult({
          shortUrl: fullShortUrl,
          slug: data.data.short_slug,
          originalUrl: data.data.original_url,
        });
        setUrl("");
        setCustomSlug("");
        setTitle("");
        onUrlCreated();
      }
    } catch (err: any) {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Shortener Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-5 sm:p-8 lg:p-10 relative overflow-hidden transition-all duration-300">
        {/* Decorative soft emerald background element */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-emerald-soft/40 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-soft rounded-xl text-emerald-cta">
              <Link2 className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-deep text-sm sm:text-base">Shorten Link</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1 bg-ivory-200 rounded-full text-slate-500 text-xs font-medium border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-cta" />
            <span>Malware & SSRF Filter Active</span>
          </div>
        </div>

        {/* Shortener Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Destination URL Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Destination URL <span className="text-emerald-cta">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="https://uinjkt.ac.id/events/annual-seminar-2026"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-4 pr-12 py-3.5 bg-ivory-100/60 border border-slate-200 focus:border-emerald-cta focus:ring-2 focus:ring-emerald-cta/20 rounded-2xl text-slate-deep placeholder-slate-400 text-sm sm:text-base outline-none transition-all"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Sparkles className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Grid: Custom Alias & Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Custom Alias */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Custom Alias / Slug <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="flex items-center bg-ivory-100/60 border border-slate-200 focus-within:border-emerald-cta focus-within:ring-2 focus-within:ring-emerald-cta/20 rounded-2xl overflow-hidden transition-all">
                <span className="pl-4 pr-1 text-slate-400 text-xs font-mono select-none hidden sm:inline">
                  hsc.link/
                </span>
                <input
                  type="text"
                  placeholder="seminar-2026"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value)}
                  className="w-full px-3 py-3 bg-transparent text-slate-deep placeholder-slate-400 text-sm outline-none font-mono"
                />
              </div>
            </div>

            {/* Optional Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Link Title <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Tech Seminar 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-ivory-100/60 border border-slate-200 focus:border-emerald-cta focus:ring-2 focus:ring-emerald-cta/20 rounded-2xl text-slate-deep placeholder-slate-400 text-sm outline-none transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full md:w-auto md:min-w-[200px] flex items-center justify-center space-x-2 py-3.5 px-8 rounded-2xl font-bold text-sm sm:text-base text-white bg-emerald-cta hover:bg-emerald-hover active:scale-[0.99] transition-all shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Short URL...</span>
                </>
              ) : (
                <>
                  <span>Shorten URL</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Validation & Error Messages (e.g. Duplicate Alias 409) */}
        {errorMsg && (
          <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start space-x-3 text-xs sm:text-sm animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Result Container */}
        {result && (
          <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-emerald-soft/30 border border-emerald-cta/30 animate-fadeIn space-y-4">
            <div className="flex items-center space-x-2 text-emerald-700 font-bold text-xs sm:text-sm uppercase tracking-wide">
              <Check className="w-4 h-4 text-emerald-cta" />
              <span>Link Created Successfully!</span>
            </div>

            {/* Link Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white rounded-xl p-3.5 border border-emerald-cta/20 shadow-sm gap-3">
              <div className="truncate min-w-0 flex-1">
                <div className="text-xs text-slate-400 font-medium">Shortened URL</div>
                <a
                  href={result.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-base sm:text-lg text-emerald-600 hover:underline truncate block"
                >
                  {result.shortUrl}
                </a>
              </div>

              {/* Interaction Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleCopy}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 py-2 px-4 rounded-xl text-xs font-semibold border border-slate-200 hover:border-slate-300 text-slate-deep bg-ivory-100 hover:bg-white transition-all active:scale-95 shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-cta" />
                      <span className="text-emerald-600 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* QR Code Action (Unlocked for Authenticated, Lock Prompt for Guests) */}
                {isAuthenticated ? (
                  <button
                    onClick={() => setIsQrOpen(true)}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 py-2 px-4 rounded-xl text-xs font-semibold bg-emerald-cta text-white hover:bg-emerald-hover transition-all shadow-sm active:scale-95"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QR Code</span>
                  </button>
                ) : (
                  <button
                    onClick={onSignInClick}
                    className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 py-2 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all border border-slate-200 active:scale-95"
                    title="Sign in to unlock QR code downloads"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Unlock QR Code</span>
                  </button>
                )}
              </div>
            </div>

            {/* Subtle Banner for Guest Users */}
            {!isAuthenticated && (
              <div className="p-3 bg-white/80 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-cta" />
                  <span>Sign in to track link clicks and download high-resolution QR codes.</span>
                </div>
                <button
                  onClick={onSignInClick}
                  className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center space-x-1"
                >
                  <span>Sign In Now</span>
                  <LogIn className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {result && (
        <QRCodeModal
          isOpen={isQrOpen}
          onClose={() => setIsQrOpen(false)}
          shortUrl={result.shortUrl}
          slug={result.slug}
        />
      )}
    </div>
  );
}
