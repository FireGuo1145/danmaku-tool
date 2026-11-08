import { formatGold } from '../lib/format';
import type { GiftToast } from '../types';
import { IconGift } from './icons';

export function GiftToasts({ toasts }: { toasts: GiftToast[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="gift-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div className="gift-toast" key={toast.id}>
          <span className="toast-icon">
            {toast.icon ? <img src={toast.icon} alt="" referrerPolicy="no-referrer" /> : <IconGift size={20} />}
          </span>
          <div className="toast-body">
            <strong>{toast.user.name}</strong>
            <span>
              送出 {toast.giftName} ×{toast.num}
            </span>
          </div>
          <span className="toast-gold">{formatGold(toast.gold)}</span>
        </div>
      ))}
    </div>
  );
}
