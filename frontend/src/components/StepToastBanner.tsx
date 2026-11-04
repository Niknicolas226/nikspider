import React, { useEffect } from 'react';
import { useScanStore, scanStore } from '../store/scanStore';
import { CheckCircle2, AlertCircle, Info, ArrowRight, X } from 'lucide-react';

export const StepToastBanner: React.FC = () => {
  const toast = useScanStore((s) => s.toast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      scanStore.dispatch({ type: 'DISMISS_TOAST' });
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast?.id]);

  if (!toast) return null;

  const handleAction = () => {
    if (toast.actionStep) {
      scanStore.dispatch({ type: 'GO_TO_STEP', payload: toast.actionStep });
    }
    scanStore.dispatch({ type: 'DISMISS_TOAST' });
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full p-4 rounded-2xl bg-[#0e061c]/95 border border-purple-500/50 shadow-[0_0_35px_rgba(168,85,247,0.4)] backdrop-blur-md animate-stagger-1 text-xs font-mono"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          )}

          <div className="space-y-1">
            <span className="text-white font-semibold leading-relaxed">
              {toast.message}
            </span>
            {toast.actionStep && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleAction}
                  className="px-3 py-1 rounded-lg bg-purple-600/40 hover:bg-purple-600/70 border border-purple-400/50 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition"
                >
                  <span>Go to Step {toast.actionStep}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => scanStore.dispatch({ type: 'DISMISS_TOAST' })}
          className="text-zinc-400 hover:text-white p-1 cursor-pointer transition shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

