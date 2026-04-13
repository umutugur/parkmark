import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  UsersIcon, MapPinIcon, StarIcon, FolderIcon,
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import StatCard from '../components/StatCard';
import api from '../services/api';

interface Stats {
  totalUsers: number;
  totalParkings: number;
  activeParkings: number;
  totalFiles: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  premiumUsers: number;
  freeUsers: number;
  freemiumUsers: number;
  userGrowth: { date: string; count: number }[];
  recentActivity: { type: string; user: string; detail: string; createdAt: string }[];
}

const CHART_COLORS = ['#FFC107', '#2196F3', '#4CAF50'];

const actionLabels: Record<string, string> = {
  delete_user: 'Deleted user',
  update_user: 'Updated user',
  delete_parking: 'Deleted parking',
  update_config: 'Updated config',
  send_push: 'Sent push notification',
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/stats')
      .then(({ data }) => setStats(data))
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

  if (!stats) {
    return (
      <div className="text-center py-20 text-text-secondary">
        Failed to load dashboard stats.
      </div>
    );
  }

  const pieData = [
    { name: 'Free', value: stats.freeUsers },
    { name: 'Premium', value: stats.premiumUsers },
    { name: 'Freemium', value: stats.freemiumUsers },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          subtitle={`+${stats.newUsersToday} today`}
          icon={<UsersIcon className="w-5 h-5" />}
          color="primary"
        />
        <StatCard
          title="Active Parkings"
          value={stats.activeParkings.toLocaleString()}
          subtitle={`${stats.totalParkings.toLocaleString()} total`}
          icon={<MapPinIcon className="w-5 h-5" />}
          color="accent"
        />
        <StatCard
          title="Premium Users"
          value={stats.premiumUsers.toLocaleString()}
          subtitle={`${stats.totalUsers > 0 ? ((stats.premiumUsers / stats.totalUsers) * 100).toFixed(1) : 0}% of all users`}
          icon={<StarIcon className="w-5 h-5" />}
          color="success"
        />
        <StatCard
          title="Total Files"
          value={stats.totalFiles.toLocaleString()}
          subtitle="Uploaded photos"
          icon={<FolderIcon className="w-5 h-5" />}
          color="warning"
        />
      </div>

      {/* Growth + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line Chart */}
        <div className="lg:col-span-2 bg-bg-card border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            User Growth — Last 30 Days
          </h3>
          {stats.userGrowth.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-text-secondary text-sm">
              No growth data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.userGrowth} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => {
                    try { return format(parseISO(d), 'MMM d'); } catch { return d; }
                  }}
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
                  labelFormatter={(d) => {
                    try { return format(parseISO(d as string), 'MMM d, yyyy'); } catch { return d; }
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#FFC107"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: '#FFC107' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Subscription Breakdown
          </h3>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-text-secondary text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  formatter={(value) => <span style={{ color: '#94A3B8', fontSize: 12 }}>{value}</span>}
                />
                <Tooltip
                  contentStyle={{ background: '#232A3B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#F5F5F5' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* This week stats + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mini stats */}
        <div className="bg-bg-card border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">New Users</h3>
          <div className="space-y-4">
            {[
              { label: 'Today', value: stats.newUsersToday },
              { label: 'This Week', value: stats.newUsersThisWeek },
              { label: 'This Month', value: stats.newUsersThisMonth },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-primary/20 w-24 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${stats.newUsersThisMonth > 0 ? (value / stats.newUsersThisMonth) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-text-primary w-6 text-right">{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-bg-card border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Recent Activity</h3>
          {stats.recentActivity.length === 0 ? (
            <p className="text-text-secondary text-sm py-8 text-center">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {stats.recentActivity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary text-xs font-bold">
                      {item.user?.[0]?.toUpperCase() ?? 'A'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">
                      <span className="font-medium">{item.user}</span>{' '}
                      <span className="text-text-secondary">
                        {actionLabels[item.type] ?? item.type}
                      </span>
                    </p>
                    <p className="text-xs text-text-secondary/60 mt-0.5">
                      {item.createdAt
                        ? format(new Date(item.createdAt), 'MMM d, HH:mm')
                        : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
