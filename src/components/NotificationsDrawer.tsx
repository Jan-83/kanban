import React, { useState } from 'react';
import { 
  X, 
  Bell, 
  AlertTriangle, 
  Clock, 
  Check, 
  Trash2, 
  Volume2, 
  CheckCheck, 
  ShieldCheck 
} from 'lucide-react';
import { AppNotification, Task } from '../types/kanban';
import { playNotificationSound } from '../utils/sound';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectTask: (taskId: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onClearAll,
  onSelectTask,
}) => {
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const res = await Notification.requestPermission();
      setBrowserPermission(res);
      if (res === 'granted') {
        new Notification('KanbanFlow: Powiadomienia aktywne', {
          body: 'Będziesz otrzymywać natychmiastowe alerty o zbliżających się i przekroczonych terminach zadań.',
        });
        playNotificationSound();
      }
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'due_today':
        return <Clock className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div
        className="w-full max-w-md bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Centrum Powiadomień</h3>
              <p className="text-[11px] text-neutral-400">
                Automatyczny monitoring terminów realizacji
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Permission Banner */}
        {browserPermission !== 'granted' && typeof window !== 'undefined' && 'Notification' in window && (
          <div className="p-3 bg-neutral-950/70 border-b border-neutral-800 flex items-center justify-between gap-3 text-xs">
            <div className="text-neutral-300">
              Włącz alerty systemowe w przeglądarce
            </div>
            <button
              onClick={handleRequestPermission}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium whitespace-nowrap"
            >
              Zezwól
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div className="p-3 bg-neutral-950/40 border-b border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => playNotificationSound()}
              className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors"
              title="Przetestuj dźwięk powiadomienia"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Test dźwięku</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onMarkAllAsRead}
              className="flex items-center gap-1 text-neutral-400 hover:text-indigo-400 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Odczytane</span>
            </button>
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 text-neutral-500 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wyczyść</span>
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-neutral-800/40">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-xs text-neutral-500 space-y-2">
              <ShieldCheck className="w-8 h-8 mx-auto text-neutral-600" />
              <p>Brak nowych powiadomień.</p>
              <p className="text-[11px] text-neutral-600">
                System automatycznie wyśle alert, gdy zbliży się termin któregoś z Twoich zadań.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (notif.taskId) {
                    onSelectTask(notif.taskId);
                    onClose();
                  }
                }}
                className={`pt-2.5 first:pt-0 p-3 rounded-xl transition-colors cursor-pointer ${
                  notif.read
                    ? 'bg-neutral-950/30 opacity-70 hover:opacity-100'
                    : 'bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">{getNotifIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-semibold text-neutral-100">
                        {notif.title}
                      </h4>
                      <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                        {new Date(notif.timestamp).toLocaleTimeString('pl-PL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                      {notif.message}
                    </p>
                    {notif.taskTitle && (
                      <div className="text-[11px] text-indigo-400 font-medium mt-1">
                        👉 Kliknij, aby zobaczyć zadanie
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/60 text-center text-[10px] text-neutral-500 font-mono">
          Automatyczny skaner terminów aktywny
        </div>
      </div>
    </div>
  );
};
