import React, { useEffect, useState } from 'react';
import { BellIcon, PaperAirplaneIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useToast } from '../components/Toast';
import api from '../services/api';

interface NotificationLog {
  id: string;
  adminUser: string;
  details: {
    title: string;
    body: string;
    target: string;
    userId?: string;
    sent: number;
    total: number;
  };
  createdAt: string;
}

interface UserSuggestion {
  id: string;
  name: string;
  email: string;
}

const targetLabels: Record<string, string> = {
  all: 'All Users',
  premium: 'Premium Only',
  free: 'Free Users',
  user: 'Specific User',
};

export default function Notifications() {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [userId, setUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const loadHistory = () => {
    setIsLoadingHistory(true);
    api.get('/notifications/history')
      .then(({ data }) => setHistory(data.notifications))
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  };

  useEffect(() => { loadHistory(); }, []);

  // User search autocomplete
  useEffect(() => {
    if (target !== 'user' || userSearch.length < 2) {
      setUserSuggestions([]);
      return;
    }
    const timeout = setTimeout(() => {
      api.get('/users', { params: { search: userSearch, limit: '5' } })
        .then(({ data }) => setUserSuggestions(data.users.map((u: any) => ({ id: u.id, name: u.name, email: u.email }))))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timeout);
  }, [userSearch, target]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      showToast('Title and body are required', 'error');
      return;
    }
    if (target === 'user' && !userId) {
      showToast('Please select a user', 'error');
      return;
    }

    setIsSending(true);
    try {
      const { data } = await api.post('/push/send', {
        title: title.trim(),
        body: body.trim(),
        target,
        userId: target === 'user' ? userId : undefined,
      });
      showToast(`Successfully sent to ${data.sent} device(s)`);
      setTitle('');
      setBody('');
      setTarget('all');
      setUserId('');
      setUserSearch('');
      setSelectedUser(null);
      loadHistory();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to send notification', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Form */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
          <h3 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-primary" />
            Send Push Notification
          </h3>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Target Audience
              </label>
              <select
                value={target}
                onChange={(e) => { setTarget(e.target.value); setUserId(''); setSelectedUser(null); setUserSearch(''); }}
                className="w-full bg-bg-deep border border-white/10 rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-primary/40"
              >
                <option value="all">All Users</option>
                <option value="premium">Premium Only</option>
                <option value="free">Free Users</option>
                <option value="user">Specific User</option>
              </select>
            </div>

            {target === 'user' && (
              <div className="relative">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Search User
                </label>
                {selectedUser ? (
                  <div className="flex items-center justify-between bg-bg-deep border border-primary/30 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm text-text-primary font-medium">{selectedUser.name}</p>
                      <p className="text-xs text-text-secondary">{selectedUser.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedUser(null); setUserId(''); setUserSearch(''); }}
                      className="text-xs text-error hover:text-error/80"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full bg-bg-deep border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary/40"
                    />
                    {userSuggestions.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-bg-card border border-white/10 rounded-xl overflow-hidden shadow-xl">
                        {userSuggestions.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => { setSelectedUser(u); setUserId(u.id); setUserSearch(''); setUserSuggestions([]); }}
                            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                          >
                            <p className="text-sm text-text-primary">{u.name}</p>
                            <p className="text-xs text-text-secondary">{u.email}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Notification Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New Feature Available!"
                required
                className="w-full bg-bg-deep border border-white/10 rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Message Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your notification message here..."
                required
                rows={4}
                className="w-full bg-bg-deep border border-white/10 rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary/40 resize-none"
              />
            </div>

            {/* Preview */}
            {(title || body) && (
              <div className="bg-bg-deep border border-white/5 rounded-xl p-4">
                <p className="text-xs text-text-secondary mb-2">Preview</p>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-bg-deep font-bold text-sm flex-shrink-0">
                    P
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{title || 'Title'}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{body || 'Message body...'}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-primary hover:bg-primary-dark text-bg-deep font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
              {isSending ? 'Sending...' : `Send to ${targetLabels[target] || 'All Users'}`}
            </button>
          </form>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Notification Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-deep rounded-xl p-4">
                <p className="text-2xl font-bold text-text-primary">{history.length}</p>
                <p className="text-xs text-text-secondary mt-1">Total Sent</p>
              </div>
              <div className="bg-bg-deep rounded-xl p-4">
                <p className="text-2xl font-bold text-primary">
                  {history.reduce((sum, n) => sum + (n.details?.sent ?? 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-text-secondary mt-1">Total Deliveries</p>
              </div>
            </div>
          </div>

          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Target Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(
                history.reduce<Record<string, number>>((acc, n) => {
                  const t = n.details?.target ?? 'all';
                  acc[t] = (acc[t] ?? 0) + 1;
                  return acc;
                }, {}),
              ).map(([t, count]) => (
                <div key={t} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{targetLabels[t] ?? t}</span>
                  <span className="text-text-primary font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Notification History</h3>
        {isLoadingHistory ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-center py-8 text-text-secondary text-sm">No notifications sent yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Title', 'Body', 'Target', 'Sent / Total', 'Sent By', 'Date'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((n) => (
                  <tr key={n.id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                    <td className="px-4 py-3 text-sm text-text-primary font-medium max-w-xs truncate">
                      {n.details?.title ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary max-w-xs truncate">
                      {n.details?.body ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-md">
                        {targetLabels[n.details?.target] ?? n.details?.target ?? 'all'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-success">{n.details?.sent ?? 0}</span>
                      <span className="text-text-secondary"> / {n.details?.total ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{n.adminUser}</td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {n.createdAt ? format(new Date(n.createdAt), 'MMM d, HH:mm') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
