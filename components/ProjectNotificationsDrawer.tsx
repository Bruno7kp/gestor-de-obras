import React, { useMemo, useState } from 'react';
import { Bell, CheckCheck, Filter, Trash2, X } from 'lucide-react';
import { UserNotification } from '../types';
import {
  getNotificationSubtype,
  getNotificationSubtypeClasses,
  getNotificationSubtypeLabel,
  getNotificationType,
  getNotificationTypeClasses,
  getNotificationTypeLabel,
  NOTIFICATION_FILTERS,
  NotificationFilterEntry,
  NotificationTypeKey,
} from '../utils/notificationPresentation';

interface ProjectNotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: UserNotification[];
  loading: boolean;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  deletingId?: string | null;
  /** When provided, only these filters are shown (permission-filtered). Falls back to all filters. */
  visibleFilters?: NotificationFilterEntry[];
}

export const ProjectNotificationsDrawer: React.FC<ProjectNotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  loading,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  deletingId,
  visibleFilters,
}) => {
  const filters = visibleFilters ?? NOTIFICATION_FILTERS;
  const [filter, setFilter] = useState<NotificationTypeKey | 'TODOS'>('TODOS');

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const filteredNotifications = useMemo(() => {
    if (filter === 'TODOS') return notifications;
    return notifications.filter((notification) => getNotificationType(notification) === filter);
  }, [filter, notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[140]"
        onClick={onClose}
      />
      <aside className="fixed top-0 right-0 h-screen w-full sm:w-[430px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-[150] shadow-2xl flex flex-col">
        <header className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
              <Bell size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 truncate">
                Notificações da obra
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {unreadCount} não lidas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <div className="flex flex-wrap gap-2">
              {filters.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setFilter(option.key)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    filter === option.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-indigo-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              unreadCount > 0
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCheck size={14} />
            Marcar tudo como lido
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">Carregando notificações...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">Nenhuma notificação para este filtro.</div>
          ) : (
            filteredNotifications.map((notification) => {
              const type = getNotificationType(notification);
              const classes = getNotificationTypeClasses(type);
              const subtype = getNotificationSubtype(notification);
              const subtypeClasses = getNotificationSubtypeClasses(subtype, notification);
              return (
                <article
                  key={notification.id}
                  className={`border border-slate-200 dark:border-slate-800 rounded-2xl p-4 border-l-4 ${subtypeClasses.border} ${
                    notification.isRead ? 'opacity-70' : 'bg-slate-50/70 dark:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${classes.badge}`}>
                          {getNotificationTypeLabel(type)}
                        </span>
                        <span className={`inline-flex px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${subtypeClasses.badge}`}>
                          {getNotificationSubtypeLabel(subtype)}
                        </span>
                      </div>
                      <h4 className="mt-2 text-xs font-black text-slate-800 dark:text-slate-100 leading-tight">
                        {notification.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!notification.isRead && (
                        <button
                          onClick={() => onMarkRead(notification.id)}
                          className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700"
                        >
                          Marcar lida
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(notification.id)}
                        disabled={deletingId === notification.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remover notificação"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{notification.body}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {notification.actor?.name ? (
                      <div className="flex items-center gap-2 min-w-0">
                        {notification.actor.profileImage ? (
                          <img
                            src={notification.actor.profileImage}
                            alt={notification.actor.name}
                            className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-[9px] font-black flex items-center justify-center">
                            {getInitials(notification.actor.name)}
                          </div>
                        )}
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                          {notification.actor.name}
                        </span>
                      </div>
                    ) : (
                      <span />
                    )}
                    <p className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                      {new Date(notification.triggeredAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
