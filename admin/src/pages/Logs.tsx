import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardDocumentListIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import api from '../services/api';

interface AuditLog {
  id: string;
  adminUser: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: Record<string, any>;
  createdAt: string;
}

interface WebhookEvent {
  id: string;
  action: string;
  targetId?: string;
  details: {
    product_id?: string;
    raw_event_type?: string;
  };
  createdAt: string;
}

const actionColors: Record<string, string> = {
  delete_user: 'bg-error/15 text-error border-error/20',
  delete_parking: 'bg-error/15 text-error border-error/20',
  update_user: 'bg-accent/15 text-accent border-accent/20',
  update_config: 'bg-warning/15 text-warning border-warning/20',
  send_push: 'bg-success/15 text-success border-success/20',
};

const webhookColors: Record<string, string> = {
  INITIAL_PURCHASE: 'bg-success/15 text-success border-success/20',
  RENEWAL: 'bg-accent/15 text-accent border-accent/20',
  EXPIRATION: 'bg-error/15 text-error border-error/20',
  CANCELLATION: 'bg-warning/15 text-warning border-warning/20',
};

export default function Logs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'webhooks'>('audit');
  const limit = 20;

  const fetchLogs = useCallback(() => {
    setIsLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (actionFilter) params.action = actionFilter;

    api.get('/logs', { params })
      .then(({ data }) => { setLogs(data.logs); setTotal(data.total); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    api.get('/webhook-events')
      .then(({ data }) => setWebhookEvents(data.events))
      .catch(() => {})
      .finally(() => setIsLoadingWebhooks(false));
  }, []);

  const totalPages = Math.ceil(total / limit);

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-bg-card border border-white/10 rounded-xl p-1 w-fit">
        {[
          { id: 'audit', label: 'Audit Logs', icon: ClipboardDocumentListIcon },
          { id: 'webhooks', label: 'Webhook Events', icon: GlobeAltIcon },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as 'audit' | 'webhooks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-primary text-bg-deep'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'audit' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="bg-bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/40"
            >
              <option value="">All Actions</option>
              {[
                'delete_user',
                'update_user',
                'delete_parking',
                'update_config',
                'send_push',
              ].map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            <p className="text-sm text-text-secondary ml-2">
              {total.toLocaleString()} log{total !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Admin', 'Action', 'Target Type', 'Target ID', 'Details', 'Time'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-text-secondary text-sm">
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                              <span className="text-primary text-xs font-bold">
                                {log.adminUser?.[0]?.toUpperCase() ?? 'A'}
                              </span>
                            </div>
                            <span className="text-sm text-text-primary">{log.adminUser}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                              actionColors[log.action] ?? 'bg-white/5 text-text-secondary border-white/10'
                            }`}
                          >
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary capitalize">
                          {log.targetType}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary font-mono truncate max-w-[100px]">
                          {log.targetId ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary max-w-[200px]">
                          <details>
                            <summary className="cursor-pointer hover:text-text-primary text-text-secondary/60">
                              View details
                            </summary>
                            <pre className="mt-2 text-xs bg-bg-deep rounded-lg p-2 overflow-x-auto max-w-xs">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          {log.createdAt ? format(new Date(log.createdAt), 'MMM d, HH:mm') : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                <p className="text-xs text-text-secondary">{total} total records</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs hover:bg-white/5 text-text-secondary disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1.5 text-xs text-text-primary">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs hover:bg-white/5 text-text-secondary disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'webhooks' && (
        <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Event Type', 'User ID', 'Product', 'Date'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoadingWebhooks ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                      </div>
                    </td>
                  </tr>
                ) : webhookEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-text-secondary text-sm">
                      No webhook events recorded
                    </td>
                  </tr>
                ) : (
                  webhookEvents.map((event) => (
                    <tr key={event.id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                            webhookColors[event.action] ?? 'bg-white/5 text-text-secondary border-white/10'
                          }`}
                        >
                          {event.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary font-mono truncate max-w-[150px]">
                        {event.targetId ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {event.details?.product_id ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {event.createdAt ? format(new Date(event.createdAt), 'MMM d, HH:mm') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
