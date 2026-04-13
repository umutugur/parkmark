import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import Table from '../components/Table';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  freemiumExpiresAt: string | null;
  pinCount: number;
  parkingCount: number;
  createdAt: string;
}

function PlanBadge({ user }: { user: User }) {
  const now = new Date();
  const isFreemium = user.freemiumExpiresAt && new Date(user.freemiumExpiresAt) > now;

  if (user.isSubscribed) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/15 text-primary border border-primary/20">
        {user.subscriptionPlan ?? 'Premium'}
      </span>
    );
  }
  if (isFreemium) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/20">
        Freemium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-white/5 text-text-secondary border border-white/10">
      Free
    </span>
  );
}

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [plan, setPlan] = useState('all');
  const limit = 20;

  const fetchUsers = useCallback(() => {
    setIsLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (search) params.search = search;
    if (plan !== 'all') params.plan = plan;

    api.get('/users', { params })
      .then(({ data }) => {
        setUsers(data.users);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [page, search, plan]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (u: User) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-bold">
              {u.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div>
            <p className="font-medium text-text-primary text-sm">{u.name}</p>
            <p className="text-xs text-text-secondary">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (u: User) => <PlanBadge user={u} />,
    },
    {
      key: 'parkingCount',
      header: 'Parkings',
      render: (u: User) => (
        <span className="text-text-primary font-medium">{u.parkingCount}</span>
      ),
    },
    {
      key: 'pinCount',
      header: 'Pins',
      render: (u: User) => (
        <span className="text-text-secondary">{u.pinCount}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (u: User) => (
        <span className="text-text-secondary text-xs">
          {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (u: User) => (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/users/${u.id}`); }}
          className="text-xs text-accent hover:text-accent/80 font-medium"
        >
          View
        </button>
      ),
    },
  ];

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-bg-card border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-primary text-bg-deep rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-text-secondary flex-shrink-0" />
          <select
            value={plan}
            onChange={(e) => { setPlan(e.target.value); setPage(1); }}
            className="bg-bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/40"
          >
            <option value="all">All Plans</option>
            <option value="premium">Premium</option>
            <option value="free">Free</option>
            <option value="freemium">Freemium</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {total.toLocaleString()} user{total !== 1 ? 's' : ''} found
        </p>
        {(search || plan !== 'all') && (
          <button
            onClick={() => { setSearch(''); setSearchInput(''); setPlan('all'); setPage(1); }}
            className="text-xs text-accent hover:text-accent/80"
          >
            Clear filters
          </button>
        )}
      </div>

      <Table
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No users found"
        onRowClick={(u) => navigate(`/users/${u.id}`)}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        total={total}
      />
    </div>
  );
}
