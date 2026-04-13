import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'primary' | 'accent' | 'success' | 'error' | 'warning';
  trend?: { value: number; label: string };
}

const colorMap = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  accent: 'bg-accent/10 text-accent border-accent/20',
  success: 'bg-success/10 text-success border-success/20',
  error: 'bg-error/10 text-error border-error/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
  trend,
}: StatCardProps) {
  return (
    <div className="bg-bg-card border border-white/10 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-lg ${
              trend.value >= 0
                ? 'bg-success/10 text-success'
                : 'bg-error/10 text-error'
            }`}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value}% {trend.label}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-text-primary mb-1">{value}</p>
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {subtitle && <p className="text-xs text-text-secondary/70 mt-1">{subtitle}</p>}
    </div>
  );
}
