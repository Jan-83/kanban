export interface DueDateStatus {
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  isSoon: boolean; // within 48 hours
  formatted: string;
  badgeText: string;
  urgencyLevel: 'safe' | 'warning' | 'urgent' | 'danger';
}

export function evaluateDueDate(dueDateStr: string, isCompleted: boolean = false): DueDateStatus {
  if (!dueDateStr) {
    return {
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      isSoon: false,
      formatted: 'Brak terminu',
      badgeText: 'Brak terminu',
      urgencyLevel: 'safe',
    };
  }

  const now = new Date();
  const due = new Date(dueDateStr);

  // If time is not provided, default to end of day
  if (dueDateStr.length === 10) {
    due.setHours(23, 59, 59, 999);
  }

  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const isTodayDate =
    now.getFullYear() === due.getFullYear() &&
    now.getMonth() === due.getMonth() &&
    now.getDate() === due.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrowDate =
    tomorrow.getFullYear() === due.getFullYear() &&
    tomorrow.getMonth() === due.getMonth() &&
    tomorrow.getDate() === due.getDate();

  const dateOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  const hasSpecificTime = dueDateStr.includes('T');
  let formatted = due.toLocaleDateString('pl-PL', dateOptions);
  if (hasSpecificTime) {
    formatted += `, ${due.toLocaleTimeString('pl-PL', timeOptions)}`;
  }

  if (isCompleted) {
    return {
      isOverdue: false,
      isToday: isTodayDate,
      isTomorrow: isTomorrowDate,
      isSoon: false,
      formatted,
      badgeText: `Termin: ${formatted}`,
      urgencyLevel: 'safe',
    };
  }

  if (diffMs < 0) {
    const overdueDays = Math.max(1, Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24))));
    return {
      isOverdue: true,
      isToday: false,
      isTomorrow: false,
      isSoon: false,
      formatted,
      badgeText: overdueDays === 1 ? 'Przeterminowane (1 dzień)' : `Przeterminowane (${overdueDays} dni)`,
      urgencyLevel: 'danger',
    };
  }

  if (isTodayDate) {
    const hoursLeft = Math.max(0, Math.floor(diffHours));
    return {
      isOverdue: false,
      isToday: true,
      isTomorrow: false,
      isSoon: true,
      formatted,
      badgeText: hasSpecificTime ? `Dzisiaj (${hoursLeft}h pozostało)` : 'Dzisiaj',
      urgencyLevel: 'urgent',
    };
  }

  if (isTomorrowDate) {
    return {
      isOverdue: false,
      isToday: false,
      isTomorrow: true,
      isSoon: true,
      formatted,
      badgeText: 'Jutro',
      urgencyLevel: 'warning',
    };
  }

  if (diffHours <= 48) {
    return {
      isOverdue: false,
      isToday: false,
      isTomorrow: false,
      isSoon: true,
      formatted,
      badgeText: `Za ${diffDays} dni`,
      urgencyLevel: 'warning',
    };
  }

  return {
    isOverdue: false,
    isToday: false,
    isTomorrow: false,
    isSoon: false,
    formatted,
    badgeText: `Za ${diffDays} dni`,
    urgencyLevel: 'safe',
  };
}

export function formatDateTimeForInput(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
