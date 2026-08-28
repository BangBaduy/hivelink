"use client";

import React, { useState } from "react";
import { UrlRecord } from "@/lib/db";
import { BarChart2, ExternalLink, Copy, Check, QrCode, Calendar, MousePointerClick, RefreshCw, Lock, LogIn, Search } from "lucide-react";
import QRCodeModal from "./QRCodeModal";

interface DashboardProps {
  isAuthenticated: boolean;
  links: UrlRecord[];
  isLoading: boolean;
  onSignInClick: () => void;
  onRefresh: () => void;
}

export default function Dashboard({ isAuthenticated, links, isLoading, onSignInClick, onRefresh }: DashboardProps) {
  const [activeQrLink, setActiveQrLink] = useState<{ shortUrl: string; slug: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const getOrigin = () => {
    if (typeof window !== "undefined") return window.location.origin;
    return "https://hsc.link";
  };

  const handleCopy = (id: string, slug: string) => {
    const fullUrl = `${getOrigin()}/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const filteredLinks = links.filter((link) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      link.short_slug.toLowerCase().includes(query) ||
      link.original_url.toLowerCase().includes(query) ||
      (link.title || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="w-full max-w-4xl mx-auto mt-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6 px-1 flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-deep text-white rounded-2xl shadow-sm">
            <BarChart2 className="w-5 h-5 text-emerald-cta" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-deep">Link Analytics & Management</h2>
            <p className="text-xs text-slate-500">Track click counters and manage short links</p>
          </div>
        </div>

        {/* Refresh button */}
        {isAuthenticated && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center space-x-1.5 py-2 px-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-deep shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-cta" : "text-slate-500"}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* GUEST VIEW: CTA Banner & Locked Dashboard Preview */}
      {!isAuthenticated ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center shadow-card relative overflow-hidden">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 bg-emerald-soft rounded-2xl flex items-center justify-center mx-auto text-emerald-cta shadow-sm">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-deep">Analytics & Dashboard Locked</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Sign in to track real-time click counters, manage your links, and download high-resolution QR codes.
              </p>
            </div>

            <button
              onClick={onSignInClick}
              className="inline-flex items-center space-x-2 py-3 px-6 rounded-2xl font-bold text-sm text-white bg-emerald-cta hover:bg-emerald-hover transition-all shadow-glow active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Unlock Analytics</span>
            </button>
          </div>
        </div>
      ) : (
        /* AUTHENTICATED VIEW: Full Dashboard */
        <div className="space-y-4">
          {/* Search Filter Bar */}
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-2 shadow-sm">
            <div className="flex items-center space-x-2 px-3 flex-1">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by alias, title, or target URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs text-slate-deep placeholder-slate-400 bg-transparent outline-none py-1.5"
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 px-3">
              {filteredLinks.length} {filteredLinks.length === 1 ? "link" : "links"}
            </span>
          </div>

          {filteredLinks.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-card">
              <p className="text-xs text-slate-500">No links found matching your search query.</p>
            </div>
          ) : (
            <>
              {/* MOBILE VIEW (<768px): Responsive Card List */}
              <div className="block md:hidden space-y-3">
                {filteredLinks.map((link) => {
                  const fullShortUrl = `${getOrigin()}/${link.short_slug}`;
                  return (
                    <div
                      key={link.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-soft space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate flex-1">
                          <h3 className="font-bold text-slate-deep text-sm truncate">
                            {link.title || link.short_slug}
                          </h3>
                          <a
                            href={fullShortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono font-semibold text-emerald-600 hover:underline truncate block mt-0.5"
                          >
                            /{link.short_slug}
                          </a>
                        </div>
                        {/* Clicks Counter Badge */}
                        <div className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-soft rounded-full text-emerald-800 text-xs font-bold shrink-0">
                          <MousePointerClick className="w-3 h-3 text-emerald-cta" />
                          <span>{link.clicks} clicks</span>
                        </div>
                      </div>

                      {/* Destination target */}
                      <div className="text-xs text-slate-500 truncate bg-ivory-100 p-2 rounded-lg font-mono border border-slate-200/50">
                        {link.original_url}
                      </div>

                      {/* Footer Info & Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(link.created_at)}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleCopy(link.id, link.short_slug)}
                            className="p-2 bg-ivory-200 hover:bg-slate-200 text-slate-deep rounded-lg text-xs transition-colors"
                            aria-label="Copy Short URL"
                          >
                            {copiedId === link.id ? (
                              <Check className="w-4 h-4 text-emerald-cta" />
                            ) : (
                              <Copy className="w-4 h-4 text-slate-600" />
                            )}
                          </button>

                          <button
                            onClick={() => setActiveQrLink({ shortUrl: fullShortUrl, slug: link.short_slug })}
                            className="p-2 bg-emerald-cta text-white hover:bg-emerald-hover rounded-lg text-xs transition-colors"
                            aria-label="Show QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TABLET / DESKTOP VIEW (>=768px): Structured Table */}
              <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-ivory-200/60 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 px-6">Short Link & Alias</th>
                        <th className="py-3.5 px-6">Original Destination</th>
                        <th className="py-3.5 px-4 text-center">Total Clicks</th>
                        <th className="py-3.5 px-6">Created</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredLinks.map((link) => {
                        const fullShortUrl = `${getOrigin()}/${link.short_slug}`;
                        return (
                          <tr key={link.id} className="hover:bg-ivory-100/50 transition-colors group">
                            {/* Short Link */}
                            <td className="py-4 px-6 max-w-[220px]">
                              <div className="font-semibold text-slate-deep text-sm truncate">
                                {link.title || link.short_slug}
                              </div>
                              <a
                                href={fullShortUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono font-bold text-xs text-emerald-600 hover:underline inline-flex items-center space-x-1"
                              >
                                <span>/{link.short_slug}</span>
                                <ExternalLink className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            </td>

                            {/* Destination */}
                            <td className="py-4 px-6 max-w-[280px]">
                              <div
                                className="text-xs text-slate-500 truncate font-mono bg-ivory-100 px-2.5 py-1 rounded-lg border border-slate-200/60"
                                title={link.original_url}
                              >
                                {link.original_url}
                              </div>
                            </td>

                            {/* Click Metric */}
                            <td className="py-4 px-4 text-center">
                              <span className="inline-flex items-center space-x-1 py-1 px-3 bg-emerald-soft/80 text-emerald-800 text-xs font-bold rounded-full border border-emerald-cta/20">
                                <MousePointerClick className="w-3 h-3 text-emerald-cta" />
                                <span>{link.clicks}</span>
                              </span>
                            </td>

                            {/* Creation Date */}
                            <td className="py-4 px-6 text-xs text-slate-400 whitespace-nowrap">
                              {formatDate(link.created_at)}
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-6 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleCopy(link.id, link.short_slug)}
                                  className="p-2 bg-ivory-100 hover:bg-slate-200 text-slate-deep rounded-xl text-xs transition-all active:scale-95 border border-slate-200"
                                  title="Copy Short URL"
                                >
                                  {copiedId === link.id ? (
                                    <Check className="w-4 h-4 text-emerald-cta" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-slate-600" />
                                  )}
                                </button>

                                <button
                                  onClick={() => setActiveQrLink({ shortUrl: fullShortUrl, slug: link.short_slug })}
                                  className="p-2 bg-emerald-cta text-white hover:bg-emerald-hover rounded-xl text-xs transition-all shadow-sm active:scale-95"
                                  title="Generate QR Code"
                                >
                                  <QrCode className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      {activeQrLink && (
        <QRCodeModal
          isOpen={!!activeQrLink}
          onClose={() => setActiveQrLink(null)}
          shortUrl={activeQrLink.shortUrl}
          slug={activeQrLink.slug}
        />
      )}
    </div>
  );
}
