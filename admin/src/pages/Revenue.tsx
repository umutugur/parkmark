import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import { CurrencyDollarIcon, UserGroupIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import StatCard from '../components/StatCard';
import api from '../services/api';

interface RevenueData {
  mrrEstimate: number;
  totalSubscribers: number;
  planBreakdown: { plan: string; count: number; price: number }[];
  recentEvents: {
    id: string;
    eventType: string;
    userId: string;
    details: {
      product_id?: string;
      expiration_at_ms?: number;
    };
    createdAt: string;
  }[];
}

const planColors: Record<string, string> = {
  monthly: '#FFC107',
  sixMonth: '#2196F3',
  yearly: '#4CAF50',
};

const planLabels: Record<string, string> = {
  monthly: 'Monthly ($2.99)',
  sixMonth: '6 Month ($12.99)',
  yearly: 'Yearly ($19.99)',
};

const eventTypeColors: Record<string, string> = {
  INITIAL_PURCHASE: 'bg-success/15 text-success border-success/20',
  RENEWAL: 'bg-accent/15 text-accent border-accent/20',
  EXPIRATION: 'bg-error/15 text-error border-error/20',
  CANCELLATION: 'bg-warning/15 text-warning border-warning/20',
};

export default function Revenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/revenue')
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-text-secondary">Failed to load revenue data.</div>;
  }

  const arrEstimate = data.mrrEstimate * 12;

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="MRR Estimate"
          value={`$${data.mrrEstimate.toFixed(2)}`}
          subtitle="Monthly Recurring Revenue"
          icon={<CurrencyDollarIcon className="w-5 h-5" />}
          color="primary"
        />
        <StatCard
          title="ARR Estimate"
          value={`$${arrEstimate.toFixed(2)}`}
          subtitle="Annual Run Rate"
          icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
          color="success"
        />
        <StatCard
          title="Total Subscribers"
          value={data.totalSubscribers.toLocaleString()}
          subtitle="Active paid plans"
          icon={<UserGroupIcon className="w-5 h-5" />}
          color="accent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution Bar Chart */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Plan Distribution</h3>
          {data.planBreakdown.every((p) => p.count === 0) ? (
            <div className="flex items-center justify-center h-48 text-text-secondary text-sm">
              No subscribers yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.planBreakdown.map((p) => ({
                  name: p.plan,
                  count: p.count,
                  revenue: Math.round(
                    p.plan === 'monthly'
                      ? p.count * 2.99
                      : p.plan === 'sixMonth'
                      ? (p.count * 12.99) / 6
                      : (p.count * 19.99) / 12,
                  ),
                }))}
                margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  tickFormatter={(v) => planLabels[v]?.split(' ')[0] ?? v}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ background: '#232A3B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F5F5F5' }}
                  formatter={(value, name) => [value, name === 'count' ? 'Subscribers' : 'MRR ($)']}
                  labelFormatter={(l) => planLabels[l] ?? l}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.planBreakdown.map((p, i) => (
                    <Cell key={i} fill={planColors[p.plan] ?? '#FFC107'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Plan Breakdown Cards */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Revenue Breakdown</h3>
          <div className="space-y-4">
            {data.planBreakdown.map((plan) => {
              const mrrContribution =
                plan.plan === 'monthly'
                  ? plan.count * 2.99
                  : plan.plan === 'sixMonth'
                  ? (plan.count * 12.99) / 6
                  : (plan.count * 19.99) / 12;

              const pct = data.mrrEstimate > 0 ? (mrrContribution / data.mrrEstimate) * 100 : 0;

              return (
                <div key={plan.plan} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ background: planColors[plan.plan] ?? '#FFC107' }}
                      />
                      <span className="text-text-primary">{planLabels[plan.plan] ?? plan.plan}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-text-primary font-semibold">{plan.count}</span>
                      <span className="text-text-secondary text-xs ml-1">subs</span>
                      <span className="text-text-secondary text-xs ml-2">
                        ${mrrContribution.toFixed(2)}/mo
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: planColors[plan.plan] ?? '#FFC107' }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="border-t border-white/10 pt-4 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Total MRR</span>
                <span className="text-primary font-bold text-base">${data.mrrEstimate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-text-secondary">Total ARR</span>
                <span className="text-text-primary font-semibold">${arrEstimate.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Subscription Events */}
      <div className="bg-bg-card border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Recent Subscription Events</h3>
        {data.recentEvents.length === 0 ? (
          <p className="text-center py-8 text-text-secondary text-sm">
            No webhook events recorded yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Event', 'User ID', 'Product', 'Date'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.map((event) => (
                  <tr key={event.id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                          eventTypeColors[event.eventType] ?? 'bg-white/5 text-text-secondary border-white/10'
                        }`}
                      >
                        {event.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary font-mono truncate max-w-[120px]">
                      {event.userId ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {event.details?.product_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {event.createdAt ? format(new Date(event.createdAt), 'MMM d, HH:mm') : '—'}
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
