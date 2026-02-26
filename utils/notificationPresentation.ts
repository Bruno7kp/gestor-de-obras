import { UserNotification } from '../types';

export type NotificationTypeKey =
  | 'SUPRIMENTO'
  | 'MAO_DE_OBRA'
  | 'PLANEJAMENTO'
  | 'DIARIO'
  | 'REPOSITORIO'
  | 'OUTROS';

export type NotificationSubtypeKey =
  | 'COMPRA'
  | 'PAGAMENTO'
  | 'ENTREGA'
  | 'NO_LOCAL'
  | 'CONTRATO_CRIADO'
  | 'STATUS_CONTRATO'
  | 'PAGAMENTO_MO'
  | 'TAREFA_CRIADA'
  | 'STATUS_TAREFA'
  | 'DIARIO_CRIADO'
  | 'DIARIO_ATUALIZADO'
  | 'ARQUIVO_CRIADO'
  | 'ARQUIVO_ATUALIZADO'
  | 'OUTROS';

export const NOTIFICATION_FILTERS: Array<{ key: NotificationTypeKey | 'TODOS'; label: string }> = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'SUPRIMENTO', label: 'Suprimentos' },
  { key: 'PLANEJAMENTO', label: 'Planejamento' },
  { key: 'MAO_DE_OBRA', label: 'M.O.' },
  { key: 'DIARIO', label: 'Diário' },
  { key: 'REPOSITORIO', label: 'Repositório' },
];

export const getNotificationType = (notification: UserNotification): NotificationTypeKey => {
  if (
    notification.eventType === 'LABOR_CONTRACT_CREATED' ||
    notification.eventType === 'LABOR_CONTRACT_STATUS_CHANGED' ||
    notification.eventType === 'LABOR_PAYMENT_RECORDED' ||
    notification.category === 'WORKFORCE'
  ) {
    return 'MAO_DE_OBRA';
  }

  if (
    notification.eventType === 'TASK_CREATED' ||
    notification.eventType === 'TASK_STATUS_CHANGED' ||
    notification.category === 'PLANNING'
  ) {
    return 'PLANEJAMENTO';
  }

  if (
    notification.eventType === 'EXPENSE_PAID' ||
    notification.eventType === 'EXPENSE_DELIVERED' ||
    notification.eventType === 'MATERIAL_ON_SITE_CONFIRMED' ||
    notification.category === 'FINANCIAL' ||
    notification.category === 'SUPPLIES'
  ) {
    return 'SUPRIMENTO';
  }

  if (
    notification.eventType === 'JOURNAL_ENTRY_CREATED' ||
    notification.eventType === 'JOURNAL_ENTRY_UPDATED' ||
    notification.category === 'JOURNAL'
  ) {
    return 'DIARIO';
  }

  if (
    notification.eventType === 'PROJECT_ASSET_CREATED' ||
    notification.eventType === 'PROJECT_ASSET_UPDATED' ||
    notification.category === 'REPOSITORY'
  ) {
    return 'REPOSITORIO';
  }

  return 'OUTROS';
};

export const getNotificationSubtype = (notification: UserNotification): NotificationSubtypeKey => {
  if (notification.eventType === 'SUPPLY_ORDERED') return 'COMPRA';
  if (notification.eventType === 'EXPENSE_PAID') return 'PAGAMENTO';
  if (notification.eventType === 'EXPENSE_DELIVERED') return 'ENTREGA';
  if (notification.eventType === 'MATERIAL_ON_SITE_CONFIRMED') return 'NO_LOCAL';
  if (notification.eventType === 'LABOR_CONTRACT_CREATED') return 'CONTRATO_CRIADO';
  if (notification.eventType === 'LABOR_CONTRACT_STATUS_CHANGED') return 'STATUS_CONTRATO';
  if (notification.eventType === 'LABOR_PAYMENT_RECORDED') return 'PAGAMENTO_MO';
  if (notification.eventType === 'TASK_CREATED') return 'TAREFA_CRIADA';
  if (notification.eventType === 'TASK_STATUS_CHANGED') return 'STATUS_TAREFA';
  if (notification.eventType === 'JOURNAL_ENTRY_CREATED') return 'DIARIO_CRIADO';
  if (notification.eventType === 'JOURNAL_ENTRY_UPDATED') return 'DIARIO_ATUALIZADO';
  if (notification.eventType === 'PROJECT_ASSET_CREATED') return 'ARQUIVO_CRIADO';
  if (notification.eventType === 'PROJECT_ASSET_UPDATED') return 'ARQUIVO_ATUALIZADO';

  if (notification.category === 'FINANCIAL') return 'PAGAMENTO';
  if (notification.category === 'SUPPLIES') return 'ENTREGA';
  if (notification.category === 'WORKFORCE') return 'STATUS_CONTRATO';
  if (notification.category === 'PLANNING') return 'STATUS_TAREFA';
  if (notification.category === 'JOURNAL') return 'DIARIO_ATUALIZADO';
  if (notification.category === 'REPOSITORY') return 'ARQUIVO_ATUALIZADO';

  return 'OUTROS';
};

export const getNotificationTypeLabel = (type: NotificationTypeKey) => {
  if (type === 'SUPRIMENTO') return 'Suprimentos';
  if (type === 'MAO_DE_OBRA') return 'M.O.';
  if (type === 'PLANEJAMENTO') return 'Planejamento';
  if (type === 'DIARIO') return 'Diário';
  if (type === 'REPOSITORIO') return 'Repositório';
  return 'Outros';
};

export const getNotificationSubtypeLabel = (subtype: NotificationSubtypeKey) => {
  if (subtype === 'COMPRA') return 'Compra';
  if (subtype === 'PAGAMENTO') return 'Pagamento';
  if (subtype === 'ENTREGA') return 'Entrega';
  if (subtype === 'NO_LOCAL') return 'No local';
  if (subtype === 'CONTRATO_CRIADO') return 'Contrato criado';
  if (subtype === 'STATUS_CONTRATO') return 'Status do contrato';
  if (subtype === 'PAGAMENTO_MO') return 'Pagamento';
  if (subtype === 'TAREFA_CRIADA') return 'Tarefa criada';
  if (subtype === 'STATUS_TAREFA') return 'Status da tarefa';
  if (subtype === 'DIARIO_CRIADO') return 'Entrada criada';
  if (subtype === 'DIARIO_ATUALIZADO') return 'Entrada atualizada';
  if (subtype === 'ARQUIVO_CRIADO') return 'Arquivo criado';
  if (subtype === 'ARQUIVO_ATUALIZADO') return 'Arquivo atualizado';
  return 'Ação';
};

export const getNotificationTypeClasses = (type: NotificationTypeKey) => {
  if (type === 'SUPRIMENTO') {
    return {
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      border: 'border-l-amber-500',
    };
  }

  if (type === 'MAO_DE_OBRA') {
    return {
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      border: 'border-l-indigo-500',
    };
  }

  if (type === 'PLANEJAMENTO') {
    return {
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      border: 'border-l-cyan-500',
    };
  }

  if (type === 'DIARIO') {
    return {
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      border: 'border-l-lime-500',
    };
  }

  if (type === 'REPOSITORIO') {
    return {
      badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      border: 'border-l-violet-500',
    };
  }

  return {
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    border: 'border-l-slate-400',
  };
};

const getTaskStatusColor = (status: string | undefined) => {
  if (status === 'todo') {
    return {
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      border: 'border-l-amber-500',
    };
  }
  if (status === 'doing') {
    return {
      badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      border: 'border-l-indigo-500',
    };
  }
  if (status === 'done') {
    return {
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      border: 'border-l-emerald-500',
    };
  }
  return null;
};

export const getNotificationSubtypeClasses = (subtype: NotificationSubtypeKey, notification?: UserNotification) => {
  if (subtype === 'COMPRA') {
    return {
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      border: 'border-l-rose-500',
    };
  }

  if (subtype === 'PAGAMENTO') {
    return {
      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      border: 'border-l-orange-500',
    };
  }

  if (subtype === 'ENTREGA') {
    return {
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      border: 'border-l-emerald-500',
    };
  }

  if (subtype === 'NO_LOCAL') {
    return {
      badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
      border: 'border-l-teal-500',
    };
  }

  if (subtype === 'CONTRATO_CRIADO') {
    return {
      badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      border: 'border-l-indigo-500',
    };
  }

  if (subtype === 'STATUS_CONTRATO') {
    return {
      badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      border: 'border-l-violet-500',
    };
  }

  if (subtype === 'PAGAMENTO_MO') {
    return {
      badge: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
      border: 'border-l-fuchsia-500',
    };
  }

  if (subtype === 'TAREFA_CRIADA') {
    const status = notification?.metadata?.status as string | undefined;
    const statusColor = getTaskStatusColor(status);
    if (statusColor) return statusColor;
    return {
      badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
      border: 'border-l-cyan-500',
    };
  }

  if (subtype === 'STATUS_TAREFA') {
    const newStatus = notification?.metadata?.newStatus as string | undefined;
    const statusColor = getTaskStatusColor(newStatus);
    if (statusColor) return statusColor;
    return {
      badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
      border: 'border-l-sky-500',
    };
  }

  if (subtype === 'DIARIO_CRIADO') {
    return {
      badge: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
      border: 'border-l-lime-500',
    };
  }

  if (subtype === 'DIARIO_ATUALIZADO') {
    return {
      badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      border: 'border-l-green-500',
    };
  }

  if (subtype === 'ARQUIVO_CRIADO') {
    return {
      badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      border: 'border-l-violet-500',
    };
  }

  if (subtype === 'ARQUIVO_ATUALIZADO') {
    return {
      badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      border: 'border-l-purple-500',
    };
  }

  return {
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    border: 'border-l-slate-400',
  };
};
