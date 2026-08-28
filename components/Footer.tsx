"use client";

import React, { useState } from "react";
import { X, ShieldCheck, FileText, MapPin, Building2, Heart } from "lucide-react";

export default function Footer() {
  const [activeModal, setActiveModal] = useState<"privacy" | "terms" | null>(null);

  return (
    <footer className="w-full bg-white border-t border-slate-200/80 mt-20 pt-12 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 pb-8 border-b border-slate-100">
          {/* Organization Info */}
          <div className="space-y-3 max-w-md">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-deep text-white flex items-center justify-center font-bold text-sm shadow-sm">
                <span className="text-emerald-cta">H</span>SC
              </div>
              <div>
                <span className="font-extrabold text-base text-slate-deep tracking-tight block">
                  HSC TI UIN Jakarta
                </span>
                <span className="text-xs text-emerald-600 font-semibold">
                  Himpunan Student Club Teknik Informatika
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Official URL Shortener and digital link management platform for students, faculty, and research initiatives.
            </p>
          </div>

          {/* Campus Address & Contacts */}
          <div className="space-y-2 text-xs text-slate-500 max-w-xs">
            <div className="flex items-start space-x-2">
              <MapPin className="w-4 h-4 text-emerald-cta shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-deep font-semibold block">Secretariat & Secretariat Address:</strong>
                Kampus 1, Jl. Ir. H. Djuanda No. 95, Ciputat, Kota Tangerang Selatan, Banten 15412
              </span>
            </div>
          </div>

          {/* Links & Legal Modals */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-slate-deep uppercase tracking-wider text-[11px]">Legal & Governance</h4>
            <ul className="space-y-1.5 font-medium">
              <li>
                <button
                  onClick={() => setActiveModal("privacy")}
                  className="text-slate-600 hover:text-emerald-cta transition-colors inline-flex items-center space-x-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Privacy Policy</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveModal("terms")}
                  className="text-slate-600 hover:text-emerald-cta transition-colors inline-flex items-center space-x-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Terms of Service</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Credits Line */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center space-x-1.5 font-medium text-slate-500">
            <span>Presented by</span>
            <strong className="text-slate-deep font-semibold">HSC TI UIN Jakarta</strong>
          </div>
          <div className="flex items-center space-x-1 font-medium text-emerald-600">
            <span>Built with heart from HIVE!</span>
          </div>
        </div>
      </div>

      {/* PRIVACY POLICY MODAL */}
      {activeModal === "privacy" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-deep/60 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 sm:p-8 relative max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-deep transition-colors p-1 rounded-xl hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 text-emerald-cta mb-2">
              <ShieldCheck className="w-5 h-5" />
              <span className="font-bold text-xs uppercase tracking-wider">HSC Governance</span>
            </div>
            <h3 className="text-xl font-bold text-slate-deep mb-4">Privacy Policy</h3>
            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                At <strong>HSC TI UIN Jakarta</strong>, we respect student privacy and data integrity. This Privacy Policy outlines how short link metrics are collected and secured.
              </p>
              <h4 className="font-bold text-slate-deep">1. Data Collection</h4>
              <p>
                We store the destination URL, created custom aliases, creation timestamps, and anonymized hit counter statistics to provide link performance analytics.
              </p>
              <h4 className="font-bold text-slate-deep">2. Security Standards</h4>
              <p>
                All URLs pass through automated security filters blocking malware, SSRF targets, and malicious protocol injections.
              </p>
              <h4 className="font-bold text-slate-deep">3. Third-Party Sharing</h4>
              <p>
                HSC TI UIN Jakarta does not sell, rent, or distribute link analytics to external commercial entities.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 text-right">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2.5 bg-emerald-cta hover:bg-emerald-hover text-white font-semibold text-xs rounded-xl transition-all shadow-sm"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TERMS OF SERVICE MODAL */}
      {activeModal === "terms" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-deep/60 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 sm:p-8 relative max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-deep transition-colors p-1 rounded-xl hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 text-emerald-cta mb-2">
              <FileText className="w-5 h-5" />
              <span className="font-bold text-xs uppercase tracking-wider">HSC Governance</span>
            </div>
            <h3 className="text-xl font-bold text-slate-deep mb-4">Terms of Service</h3>
            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                By using the <strong>HSC TI UIN Jakarta</strong> URL Shortener, you agree to comply with academic integrity policies and web security guidelines.
              </p>
              <h4 className="font-bold text-slate-deep">1. Acceptable Use</h4>
              <p>
                Users may not create short links targeting phishing pages, malware downloads, illegal content, or internal campus network IPs.
              </p>
              <h4 className="font-bold text-slate-deep">2. Custom Alias Ownership</h4>
              <p>
                Custom aliases are reserved on a first-come, first-served basis. HSC administrators reserve the right to reclaim system-critical or offensive aliases.
              </p>
              <h4 className="font-bold text-slate-deep">3. Rate Limits</h4>
              <p>
                To maintain service availability, automated URL generation is subject to standard rate limits per IP address.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 text-right">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2.5 bg-emerald-cta hover:bg-emerald-hover text-white font-semibold text-xs rounded-xl transition-all shadow-sm"
              >
                Accept Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
