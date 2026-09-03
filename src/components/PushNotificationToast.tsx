import React, { useState, useEffect } from 'react';
import { DiagnosticFault } from '../types';
import { AlertOctagon, X, Bell, ExternalLink } from 'lucide-react';
import { benchAudio } from '../utils/audioSynthesizer';

interface PushNotificationToastProps {
  fault: DiagnosticFault | null;
  onDismiss: () => void;
  onNavigateDiagnostics: () => void;
}

export const PushNotificationToast: React.FC<PushNotificationToastProps> = ({
  fault,
  onDismiss,
  onNavigateDiagnostics
}) => {
  const [hasBrowserPushPermission, setHasBrowserPushPermission] = useState<boolean>(false);

  // Request browser Notification API permission if available
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setHasBrowserPushPermission(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          setHasBrowserPushPermission(perm === 'granted');
        });
      }
    }
  }, []);

  // When a new critical fault triggers, play sound and trigger browser notification if allowed
  useEffect(() => {
    if (fault && fault.severity === 'critical') {
      benchAudio.playWarningBeep();

      if (hasBrowserPushPermission && 'Notification' in window) {
        try {
          new Notification(`ALERTA CRÍTICO: ${fault.componentTag}`, {
            body: fault.message,
            icon: '/favicon.ico'
          });
        } catch {
          // Ignored if background tab restrictions apply
        }
      }
    }
  }, [fault, hasBrowserPushPermission]);

  if (!fault) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-bounce-short">
      <div className="bg-red-950/95 border-2 border-red-500 rounded-2xl p-4 text-white shadow-2xl shadow-red-950/80 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-red-900/80 shrink-0 text-red-300">
              <AlertOctagon className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-900 text-red-100">
                  PUSH NOTIFICATION
                </span>
                <span className="text-xs font-mono font-bold text-red-200">
                  [{fault.componentTag}]
                </span>
              </div>

              <h4 className="text-xs font-bold text-white mt-1">
                {fault.message}
              </h4>

              <p className="text-[11px] text-red-200/90 mt-1 line-clamp-2">
                {fault.symptom}
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="text-red-300 hover:text-white transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 pt-2.5 border-t border-red-800/80 flex items-center justify-between">
          <span className="text-[10px] text-red-300 flex items-center gap-1 font-mono">
            <Bell className="w-3 h-3 text-red-400" />
            Alerta Crítico em Tempo Real
          </span>

          <button
            onClick={() => {
              onNavigateDiagnostics();
              onDismiss();
            }}
            className="flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 transition"
          >
            <span>Ver Telemetria</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
