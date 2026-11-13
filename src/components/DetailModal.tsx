import { useEffect, useState } from 'react';
import { Check, Copy, MapPin, Mic, ShieldCheck, X } from 'lucide-react';
import type { Article, PressConference } from '../data/intelData';

interface DetailModalProps {
  countryName: string | null;
  article: Article | null;
  pressConference: PressConference | null;
  onClose: () => void;
}

export default function DetailModal({
  countryName,
  article,
  pressConference,
  onClose,
}: DetailModalProps) {
  const [copied, setCopied] = useState(false);
  const displayScope = countryName ?? 'Global Overview';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!article && !pressConference) return null;

  const handleCopy = () => {
    const text = article
      ? `[${displayScope}] ${article.title}\n${article.source} · ${article.time}\n\n${article.fullReport}`
      : pressConference
        ? `[${displayScope}] ${pressConference.title}\nSpeaker: ${pressConference.speaker}\n\n${pressConference.transcript
            .map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`)
            .join('\n')}`
        : '';

    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-cyan-500/40 rounded-xl shadow-[0_0_60px_rgba(6,182,212,0.18)] overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs font-mono text-cyan-400">
            {article ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <Mic className="w-4 h-4 text-cyan-400" />}
            <span className="font-bold tracking-wider uppercase">
              {article ? `DISPATCH DOSSIER // ${displayScope}` : `OFFICIAL TRANSCRIPT // ${displayScope}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-4">
          {article && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="text-cyan-400 font-semibold">{article.source}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">{article.time}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300">{article.category}</span>
                <span className="text-slate-600">·</span>
                <span
                  className={
                    article.sentiment === 'Critical'
                      ? 'text-rose-400'
                      : article.sentiment === 'Positive'
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                  }
                >
                  Sentiment {article.sentiment} ({article.sentimentScore})
                </span>
              </div>

              <h3 className="text-lg font-bold text-white leading-snug">{article.title}</h3>

              <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 text-sm text-slate-200 leading-relaxed">
                {article.fullReport}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">COORDS: {article.coordinates}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>RELIABILITY: {article.reliability}</span>
                </div>
              </div>
            </>
          )}

          {pressConference && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold">
                  {pressConference.status}
                </span>
                <span className="text-slate-400">{pressConference.time}</span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white leading-snug">{pressConference.title}</h3>
                <p className="text-xs font-mono text-slate-400 mt-1">SPEAKER: {pressConference.speaker}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/70 border-l-2 border-cyan-400 text-xs text-slate-200 italic">
                {pressConference.keyQuote}
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  VERIFIED AUDIO-TO-TEXT TRANSCRIPT
                </div>
                {pressConference.transcript.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-cyan-400 font-semibold">{line.speaker}</span>
                      <span className="text-slate-500 tabular-nums">{line.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{line.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
