"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Link2,
  Copy,
  Check,
  QrCode,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  BarChart3,
  Search,
  Trash2,
  ExternalLink,
  Mail,
  Lock,
  Clock,
  RefreshCw,
  LogOut,
  User,
  X,
  Download,
  AlertCircle,
  CheckCircle2,
  Globe,
  Zap,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { evaluatePasswordStrength, PasswordStrengthResult } from "@/lib/security";

interface UrlItem {
  id: string;
  originalUrl: string;
  shortSlug: string;
  fullShortUrl: string;
  clicks: number;
  createdAt: string;
}

interface UserState {
  id: string;
  email: string;
}

type AuthTab = "otp" | "password_login" | "password_register" | "forgot_password";

export default function HiveApp() {
  // App State
  const [user, setUser] = useState<UserState | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Shortener Form State
  const [originalUrl, setOriginalUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [isShortening, setIsShortening] = useState(false);
  const [shortenerError, setShortenerError] = useState("");
  const [latestShortLink, setLatestShortLink] = useState<UrlItem | null>(null);

  // User Dashboard State
  const [userLinks, setUserLinks] = useState<UrlItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>("otp");

  // Form Fields
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP State
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(180);
  const [otpSent, setOtpSent] = useState(false);

  // Loading & Message States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccessMsg, setAuthSuccessMsg] = useState("");

  // Toast & QR State
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [qrModalItem, setQrModalItem] = useState<UrlItem | null>(null);

  // Legal Modals
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password strength score
  const passwordStrength: PasswordStrengthResult = evaluatePasswordStrength(passwordInput);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setLoadingUser(true);
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
        fetchUserLinks();
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  const fetchUserLinks = async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch("/api/urls");
      const data = await res.json();
      if (data.success) {
        setUserLinks(data.links);
      }
    } catch {
      // Handled
    } finally {
      setLoadingLinks(false);
    }
  };

  // 180-second countdown timer for OTP
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (showAuthModal && otpSent && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showAuthModal, otpSent, otpTimer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const triggerToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 3000);
  };

  const copyToClipboard = (text: string, slug?: string) => {
    navigator.clipboard.writeText(text);
    if (slug) {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    }
    triggerToast("Link copied to clipboard!");
  };

  const handleOpenQrModal = (item: UrlItem) => {
    if (!user) {
      resetAuthModal();
      setAuthTab("otp");
      setShowAuthModal(true);
      triggerToast("Please sign in or register to generate and download QR codes.");
      return;
    }
    setQrModalItem(item);
  };

  const handleShortenUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setShortenerError("");
    setLatestShortLink(null);

    if (!originalUrl || !originalUrl.trim()) {
      setShortenerError("Please paste a valid web link starting with https://");
      return;
    }

    setIsShortening(true);

    try {
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: originalUrl.trim(),
          customSlug: customSlug.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setShortenerError(data.message || "Unable to shorten link right now.");
        setIsShortening(false);
        return;
      }

      setLatestShortLink(data.data);
      setOriginalUrl("");
      setCustomSlug("");
      triggerToast("Short link created successfully!");

      if (user) {
        fetchUserLinks();
      }
    } catch {
      setShortenerError("Network error. Please check your connection.");
    } finally {
      setIsShortening(false);
    }
  };

  // ----------------------------------------------------
  // AUTHENTICATION HANDLERS
  // ----------------------------------------------------
  const handleSendOtp = async (type: "auth" | "forgot_password" = "auth") => {
    setAuthError("");
    setAuthSuccessMsg("");

    if (!emailInput || !emailInput.includes("@")) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), type }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.message || "We could not send your verification code.");
        setIsSubmitting(false);
        return;
      }

      setOtpSent(true);
      setOtpTimer(180);
      setOtpDigits(["", "", "", "", "", ""]);
      setAuthSuccessMsg("3-minute verification code sent to your email!");

      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const code = otpDigits.join("");
    if (code.length !== 6) {
      setAuthError("Please enter all 6 digits of your verification code.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          code,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.message || "Verification code has expired or is incorrect.");
        setIsSubmitting(false);
        return;
      }

      setUser(data.user);
      setShowAuthModal(false);
      triggerToast("Welcome back to HiVE!");
      fetchUserLinks();
    } catch {
      setAuthError("Verification failed. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!passwordStrength.valid) {
      setAuthError(passwordStrength.error || "Password does not meet strength requirements.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.message || "Registration failed.");
        setIsSubmitting(false);
        return;
      }

      setUser(data.user);
      setShowAuthModal(false);
      triggerToast("Account created successfully!");
      fetchUserLinks();
    } catch {
      setAuthError("Registration failed. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.message || "Incorrect email or password.");
        setIsSubmitting(false);
        return;
      }

      setUser(data.user);
      setShowAuthModal(false);
      triggerToast("Welcome back to HiVE!");
      fetchUserLinks();
    } catch {
      setAuthError("Login failed. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const code = otpDigits.join("");
    if (code.length !== 6) {
      setAuthError("Please enter all 6 digits of your verification code.");
      return;
    }

    if (!passwordStrength.valid) {
      setAuthError(passwordStrength.error || "New password does not meet requirements.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          code,
          newPassword: passwordInput,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.message || "Failed to reset password.");
        setIsSubmitting(false);
        return;
      }

      setUser(data.user);
      setShowAuthModal(false);
      triggerToast("Password reset successfully!");
      fetchUserLinks();
    } catch {
      setAuthError("Password reset failed. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setUserLinks([]);
      triggerToast("Signed out successfully.");
    } catch {
      // Handled
    }
  };

  const handleDeleteLink = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/urls/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setUserLinks((prev) => prev.filter((item) => item.id !== id));
        triggerToast("Link deleted.");
      } else {
        triggerToast(data.message || "Failed to delete link.");
      }
    } catch {
      triggerToast("Failed to delete link.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredLinks = userLinks.filter(
    (item) =>
      item.shortSlug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.originalUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClicks = userLinks.reduce((acc, curr) => acc + curr.clicks, 0);

  // QR Exports
  const downloadQrPng = () => {
    if (!qrModalItem) return;
    const svgElement = document.getElementById("hive-qr-svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 500;
      canvas.height = 500;
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, 500, 500);
        ctx.drawImage(img, 25, 25, 450, 450);
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `HiVE-QR-${qrModalItem.shortSlug}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        triggerToast("QR Code downloaded as PNG!");
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const downloadQrSvg = () => {
    if (!qrModalItem) return;
    const svgElement = document.getElementById("hive-qr-svg");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = blobUrl;
    downloadLink.download = `HiVE-QR-${qrModalItem.shortSlug}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(blobUrl);
    triggerToast("QR Code downloaded as SVG!");
  };

  const resetAuthModal = () => {
    setAuthError("");
    setAuthSuccessMsg("");
    setPasswordInput("");
    setConfirmPasswordInput("");
    setOtpSent(false);
    setOtpDigits(["", "", "", "", "", ""]);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B] flex flex-col font-sans selection:bg-[#10B981]/20">
      {/* ---------------------------------------------------- */}
      {/* Header */}
      {/* ---------------------------------------------------- */}
      <header className="sticky top-0 z-30 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#1E293B] flex items-center justify-center shadow-md shadow-slate-900/10">
              <span className="text-emerald-400 font-extrabold text-xl tracking-wider">H!</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl text-slate-900 tracking-tight">HiVE!</span>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                  hiveuin.tech
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">HSC TI UIN Jakarta</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {loadingUser ? (
              <div className="w-24 h-9 bg-slate-200/70 animate-pulse rounded-lg" />
            ) : user ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-700 max-w-[160px] truncate">{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-2 text-slate-600 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors shadow-sm"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  resetAuthModal();
                  setAuthTab("otp");
                  setShowAuthModal(true);
                }}
                className="flex items-center space-x-2 text-xs font-bold text-white bg-[#10B981] hover:bg-[#059669] px-4 py-2.5 rounded-xl shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* Main Content */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* HERO SECTION / GUEST SHORTENER */}
        <section className="text-center space-y-6 pt-4 pb-2">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-full text-emerald-800 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fast &bull; Secure &bull; Reliable URL Shortener</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight max-w-3xl mx-auto">
            Shorten Links with <span className="text-emerald-600 underline decoration-emerald-300 decoration-wavy underline-offset-4">Confidence</span>
          </h1>

          <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto font-normal leading-relaxed">
            Create clean short links and instant QR codes for your campus events, projects, and social media.
          </p>

          {/* Form */}
          <div className="max-w-2xl mx-auto bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-900/5 transition-all">
            <form onSubmit={handleShortenUrl} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Globe className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  placeholder="Paste your long link starting with https://"
                  className="w-full pl-11 pr-4 py-3.5 bg-[#FDFBF7] text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs font-semibold text-slate-400">
                    hiveuin.tech/
                  </div>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="CustomAlias (optional)"
                    className="w-full pl-28 pr-4 py-3 bg-[#FDFBF7] text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isShortening}
                  className="w-full sm:w-auto px-7 py-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                >
                  {isShortening ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Shortening...</span>
                    </>
                  ) : (
                    <>
                      <span>Shorten Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {shortenerError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center space-x-2 animate-slide-up">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{shortenerError}</span>
              </div>
            )}
          </div>

          {/* Short Link Card */}
          {latestShortLink && (
            <div className="max-w-2xl mx-auto bg-gradient-to-br from-emerald-50/60 to-white p-5 rounded-2xl border border-emerald-200 shadow-md animate-slide-up text-left space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Short Link Ready!</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Just now</span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white border border-emerald-100 rounded-xl">
                <div className="truncate max-w-full">
                  <a
                    href={latestShortLink.fullShortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-base font-extrabold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
                  >
                    <span>{latestShortLink.fullShortUrl}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <p className="text-xs text-slate-400 truncate max-w-md mt-0.5">{latestShortLink.originalUrl}</p>
                </div>

                <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => copyToClipboard(latestShortLink.fullShortUrl, latestShortLink.shortSlug)}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
                  >
                    {copiedSlug === latestShortLink.shortSlug ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenQrModal(latestShortLink)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors"
                    title="View & Export QR Code"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {!user && (
            <div className="max-w-2xl mx-auto p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center space-x-2 text-left">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Pro Tip:</strong> Sign in or register to generate & download QR codes and track link analytics.
                </span>
              </div>
              <button
                onClick={() => {
                  resetAuthModal();
                  setAuthTab("otp");
                  setShowAuthModal(true);
                }}
                className="shrink-0 ml-3 font-bold text-amber-800 underline hover:text-amber-950"
              >
                Sign In / Register
              </button>
            </div>
          )}
        </section>

        {/* Dashboard */}
        {user && (
          <section className="space-y-6 pt-6 border-t border-slate-200/80 animate-slide-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  <span>My Short Links</span>
                </h2>
                <p className="text-xs text-slate-500">Manage your created links and track real-time engagement analytics.</p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm">
                  Links: <span className="text-emerald-600 font-extrabold">{userLinks.length}</span>
                </div>
                <div className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm">
                  Total Clicks: <span className="text-emerald-600 font-extrabold">{totalClicks}</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search links by slug or destination URL..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm transition-all"
              />
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {loadingLinks ? (
                <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Loading your links...</span>
                </div>
              ) : filteredLinks.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Link2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">No links found</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    {searchQuery ? "No short links match your search query." : "Shorten your first web link using the form above!"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 px-4">Short Slug</th>
                        <th className="py-3.5 px-4">Original Destination</th>
                        <th className="py-3.5 px-4 text-center">Clicks</th>
                        <th className="py-3.5 px-4">Created Date</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredLinks.map((item) => (
                        <tr key={item.id} className="hover:bg-emerald-50/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                            <a
                              href={item.fullShortUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
                            >
                              <span>{item.shortSlug}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs truncate text-slate-600" title={item.originalUrl}>
                            {item.originalUrl}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[11px] border border-emerald-200/60">
                              {item.clicks}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => copyToClipboard(item.fullShortUrl, item.shortSlug)}
                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Copy Short Link"
                              >
                                {copiedSlug === item.shortSlug ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>

                              <button
                                onClick={() => handleOpenQrModal(item)}
                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Download QR Code"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteLink(item.id)}
                                disabled={deletingId === item.id}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Delete Link"
                              >
                                {deletingId === item.id ? (
                                  <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ---------------------------------------------------- */}
      {/* AUTH MODAL (OTP, Password Login, Register & Forgot Password) */}
      {/* ---------------------------------------------------- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-slide-up overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 shadow-2xl relative my-8">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-200 mb-6 gap-2">
              <button
                onClick={() => {
                  resetAuthModal();
                  setAuthTab("otp");
                }}
                className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
                  authTab === "otp"
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                OTP Code
              </button>
              <button
                onClick={() => {
                  resetAuthModal();
                  setAuthTab("password_login");
                }}
                className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
                  authTab === "password_login"
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Password Sign In
              </button>
              <button
                onClick={() => {
                  resetAuthModal();
                  setAuthTab("password_register");
                }}
                className={`pb-2.5 text-xs font-bold transition-all border-b-2 ${
                  authTab === "password_register"
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Register
              </button>
            </div>

            {/* TAB 1: Passwordless OTP */}
            {authTab === "otp" && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Sign In with OTP Code</h3>
                  <p className="text-xs text-slate-500">Enter your registered email to receive a 3-minute verification code.</p>
                </div>

                {!otpSent ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSendOtp("auth"); }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="name@domain.com"
                        required
                        className="w-full px-4 py-3 bg-[#FDFBF7] border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    {authError && (
                      <div className="space-y-2">
                        <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{authError}</p>
                        {authError.toLowerCase().includes("no account") && (
                          <p className="text-xs text-center text-slate-500">
                            Don&apos;t have an account?{" "}
                            <button
                              type="button"
                              onClick={() => { resetAuthModal(); setAuthTab("password_register"); }}
                              className="font-bold text-emerald-600 hover:underline"
                            >
                              Register here
                            </button>
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2"
                    >
                      {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send Code</span>}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-5">
                    <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <span>Code Expires In:</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-emerald-900">{formatTimer(otpTimer)}</span>
                    </div>

                    <div className="flex items-center justify-center space-x-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => { otpInputRefs.current[idx] = el; }}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => {
                            if (!/^\d*$/.test(e.target.value)) return;
                            const newDigits = [...otpDigits];
                            newDigits[idx] = e.target.value.slice(-1);
                            setOtpDigits(newDigits);
                            if (e.target.value && idx < 5) otpInputRefs.current[idx + 1]?.focus();
                          }}
                          className="w-11 h-13 text-center text-xl font-bold bg-[#FDFBF7] border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500"
                        />
                      ))}
                    </div>

                    {authError && (
                      <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 text-center">{authError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center"
                    >
                      {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Confirm OTP</span>}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: Password Login */}
            {authTab === "password_login" && (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Sign In with Password</h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@domain.com"
                    required
                    className="w-full px-4 py-2.5 bg-[#FDFBF7] border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        resetAuthModal();
                        setAuthTab("forgot_password");
                      }}
                      className="text-[11px] font-bold text-emerald-600 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-4 pr-10 py-2.5 bg-[#FDFBF7] border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{authError}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Sign In</span>}
                </button>
              </form>
            )}

            {/* TAB 3: Password Registration (With Password Strength Indicator) */}
            {authTab === "password_register" && (
              <form onSubmit={handlePasswordRegister} className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Create HiVE! Account</h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@domain.com"
                    required
                    className="w-full px-4 py-2.5 bg-[#FDFBF7] border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      className="w-full pl-4 pr-10 py-2.5 bg-[#FDFBF7] border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Meter */}
                {passwordInput && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs animate-slide-up">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Password Strength:</span>
                      <span
                        className={`font-extrabold uppercase text-[11px] px-2 py-0.5 rounded-md ${
                          passwordStrength.label === "Strong"
                            ? "bg-emerald-100 text-emerald-800"
                            : passwordStrength.label === "Medium"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passwordStrength.label === "Strong"
                            ? "w-full bg-emerald-500"
                            : passwordStrength.label === "Medium"
                            ? "w-2/3 bg-amber-500"
                            : "w-1/3 bg-red-500"
                        }`}
                      />
                    </div>

                    {/* Requirements Checklist */}
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 pt-1">
                      <div className={`flex items-center space-x-1 ${passwordStrength.checks.minLength ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                        <span>{passwordStrength.checks.minLength ? "✓" : "○"} 8+ characters</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${passwordStrength.checks.hasNumber ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                        <span>{passwordStrength.checks.hasNumber ? "✓" : "○"} Number (0-9)</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${passwordStrength.checks.hasUppercase ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                        <span>{passwordStrength.checks.hasUppercase ? "✓" : "○"} Uppercase (A-Z)</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${passwordStrength.checks.hasLowercase ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                        <span>{passwordStrength.checks.hasLowercase ? "✓" : "○"} Lowercase (a-z)</span>
                      </div>
                    </div>
                  </div>
                )}

                {authError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{authError}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !passwordStrength.valid}
                  className="w-full py-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Create Account</span>}
                </button>
              </form>
            )}

            {/* TAB 4: Forgot Password Flow */}
            {authTab === "forgot_password" && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Forgot Password</h3>
                  <p className="text-xs text-slate-500">Reset your password using a 3-minute OTP verification code.</p>
                </div>

                {!otpSent ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleSendOtp("forgot_password"); }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="name@domain.com"
                        required
                        className="w-full px-4 py-2.5 bg-[#FDFBF7] border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-500"
                      />
                    </div>

                    {authError && (
                      <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{authError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center"
                    >
                      {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send Reset Code</span>}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <span>Code Expires In:</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-emerald-900">{formatTimer(otpTimer)}</span>
                    </div>

                    <div className="flex items-center justify-center space-x-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => { otpInputRefs.current[idx] = el; }}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => {
                            if (!/^\d*$/.test(e.target.value)) return;
                            const newDigits = [...otpDigits];
                            newDigits[idx] = e.target.value.slice(-1);
                            setOtpDigits(newDigits);
                            if (e.target.value && idx < 5) otpInputRefs.current[idx + 1]?.focus();
                          }}
                          className="w-11 h-13 text-center text-xl font-bold bg-[#FDFBF7] border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500"
                        />
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Min. 8 chars (uppercase, lowercase, number)"
                        required
                        className="w-full px-4 py-2.5 bg-[#FDFBF7] border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-emerald-500"
                      />
                    </div>

                    {/* Password strength indicator */}
                    {passwordInput && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-600">Strength:</span>
                          <span className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${passwordStrength.label === "Strong" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {passwordStrength.label}
                          </span>
                        </div>
                      </div>
                    )}

                    {authError && (
                      <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{authError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || !passwordStrength.valid}
                      className="w-full py-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center disabled:opacity-50"
                    >
                      {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Reset Password & Sign In</span>}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-slide-up">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl relative text-center space-y-5">
            <button
              onClick={() => setQrModalItem(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-900">QR Code Generator</h3>
              <p className="text-xs text-slate-500 truncate max-w-xs mx-auto mt-0.5">{qrModalItem.fullShortUrl}</p>
            </div>

            <div className="p-4 bg-[#FDFBF7] border border-slate-200 rounded-2xl inline-block shadow-inner">
              <QRCodeSVG
                id="hive-qr-svg"
                value={qrModalItem.fullShortUrl}
                size={220}
                bgColor="#FDFBF7"
                fgColor="#1E293B"
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={downloadQrPng}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG Image</span>
              </button>
              <button
                onClick={downloadQrSvg}
                className="px-4 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SVG Vector</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xl flex items-center space-x-2.5 border border-slate-700 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl relative space-y-4 max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Privacy Policy</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">Effective Date: January 1, 2026</p>
            <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>At <strong>HiVE!</strong>, we are committed to protecting your privacy. This policy outlines how we handle and protect your personal information.</p>
              <p><strong>Data We Collect:</strong> We collect your email address for authentication purposes only. We also save shortened links and aggregated click performance data tied to your account.</p>
              <p><strong>How We Use It:</strong> Your email is strictly used for sending verification codes and account management. We do not sell, share, or disclose your personal data to third parties.</p>
              <p><strong>Security:</strong> We implement enterprise-grade security protocols, including cryptographic password protection, secure session management, and encrypted data storage to ensure your information remains safe.</p>
              <p><strong>Data Ownership:</strong> You have full control over your links and may delete them at any time from your personal dashboard.</p>
              <p><strong>Contact:</strong> For questions regarding your data privacy, reach out to the HSC TI UIN JKT team via official communication channels.</p>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl relative space-y-4 max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setShowTermsModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <Lock className="w-5 h-5 text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Terms of Service</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">Effective Date: January 1, 2026</p>
            <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>By using <strong>HiVE!</strong>, you agree to the following terms. Please read them carefully before using the platform.</p>
              <p><strong>Acceptable Use:</strong> HiVE! is intended for legitimate academic, campus, and professional purposes. You agree not to shorten links that lead to phishing, malware, illegal content, spam, or any harmful material.</p>
              <p><strong>Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your account credentials. Any activity under your account is your responsibility.</p>
              <p><strong>Link Removal:</strong> We reserve the right to remove any shortened link that violates these terms without prior notice.</p>
              <p><strong>No Warranty:</strong> HiVE! is provided as-is. We do not guarantee 100% uptime and are not liable for any losses resulting from service interruptions.</p>
              <p><strong>Modifications:</strong> We may update these terms at any time. Continued use of the platform constitutes acceptance of the updated terms.</p>
              <p><strong>Contact:</strong> Questions about these terms may be directed to the HSC TI UIN Jakarta organization.</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white/60 py-8 text-slate-600 text-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 rounded-md bg-slate-900 text-emerald-400 flex items-center justify-center text-xs font-bold">
              H!
            </div>
            <span className="font-semibold text-slate-700">HiVE! &bull; HSC TI UIN JKT</span>
          </div>

          <div className="flex items-center space-x-6">
            <button onClick={() => setShowPrivacyModal(true)} className="hover:text-slate-900 transition-colors font-medium">
              Privacy Policy
            </button>
            <button onClick={() => setShowTermsModal(true)} className="hover:text-slate-900 transition-colors font-medium">
              Terms of Service
            </button>
            <div className="flex items-center space-x-1.5 text-emerald-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>All Systems Operational</span>
            </div>
          </div>

          <p className="text-slate-400 text-[11px]">© 2026 HiVE! HSC TI UIN JKT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
