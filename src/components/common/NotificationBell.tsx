import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getApplicationNotifications, markApplicationNotificationRead } from '@/db/api';
import type { ApplicationNotification } from '@/types/types';

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ApplicationNotification[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setNotifications(await getApplicationNotifications(user.id));
  }, [user]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const openNotification = async (item: ApplicationNotification) => {
    if (!item.read_at) {
      await markApplicationNotificationRead(item.id);
      setNotifications((current) => current.map((notification) =>
        notification.id === item.id ? { ...notification, read_at: new Date().toISOString() } : notification
      ));
    }
    setOpen(false);
    navigate(`/history/${item.cover_letter_id}`);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative" aria-label={`${unreadCount} unread notifications`}>
          {unreadCount > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">Application reminders from the last seven days</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You’re all caught up.</p>
          ) : notifications.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => void openNotification(item)}
              className={`w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/60 ${item.read_at ? 'opacity-75' : 'bg-accent/5'}`}
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-accent/10 p-2 text-accent"><Bell className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.role_name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Current status: {item.application_status}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
                </span>
                {!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
