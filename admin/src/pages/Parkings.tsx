import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, TrashIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import Table from '../components/Table';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import api from '../services/api';

interface Parking {
  id: string;
  address: string | null;
  latitude: number;
  longitude: number;
  isActive: boolean;
  parkedAt: string;
  photoCloudStoragePath: string | null;
  user: { _id: string; name: string; email: string } | null;
  userId: string;
}

export default function Parkings() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filterActive, setFilterActive] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const limit = 20;

  const fetchParkings = useCallback(() => {
    setIsLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (filterActive !== 'all') params.isActive = filterActive;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    api.get('/parkings', { params })
      .then(({ data }) => {
        setParkings(data.parkings);
        setTotal(data.total);
      })
      .catch(() => showToast('Failed to load parkings', 'error'))
      .finally(() => setIsLoading(false));
  }, [page, filterActive, dateFrom, dateTo]);

  useEffect(() => { fetchParkings(); }, [fetchParkings]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/parkings/${deleteId}`);
      showToast('Parking deleted successfully');
      setDeleteId(null);
      fetchParkings();
    } catch {
      showToast('Failed to delete parking', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculate duration from parkedAt to now
  const getDuration = (parkedAt: string) => {
    const diff = Date.now() - new Date(parkedAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const columns = [
    {
      key: 'address',
      header: 'Location',
      render: (p: Parking) => (
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-4 h-4 text-text-secondary flex-shrink-0" />
          <span className="text-text-primary text-sm truncate max-w-xs">
            {p.address || `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}
          </span>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (p: Parking) => (
        p.user ? (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/users/${p.userId}`); }}
            className="text-left hover:text-accent"
          >
            <p className="text-sm text-text-primary">{p.user.name}</p>
            <p className="text-xs text-text-secondary">{p.user.email}</p>
          </button>
        ) : (
          <span className="text-text-secondary text-xs">—</span>
        )
      ),
    },
    {
      key: 'parkedAt',
      header: 'Parked At',
      render: (p: Parking) => (
        <div>
          <p className="text-sm text-text-primary">
            {p.parkedAt ? format(new Date(p.parkedAt), 'MMM d, HH:mm') : '—'}
          </p>
          {p.isActive && (
            <p className="text-xs text-text-secondary">{getDuration(p.parkedAt)} ago</p>
          )}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (p: Parking) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
            p.isActive
              ? 'bg-success/15 text-success border border-success/20'
              : 'bg-white/5 text-text-secondary border border-white/10'
          }`}
        >
          {p.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'photo',
      header: 'Photo',
      render: (p: Parking) => (
        <span className="text-xs text-text-secondary">
          {p.photoCloudStoragePath ? '📷 Yes' : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: Parking) => (
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
          className="p-1.5 rounded-lg hover:bg-error/10 text-text-secondary hover:text-error transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterActive}
          onChange={(e) => { setFilterActive(e.target.value); setPage(1); }}
          className="bg-bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/40"
        >
          <option value="all">All Parkings</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>

        <div className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="bg-bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="bg-bg-card border border-white/10 rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/40"
          />
        </div>

        {(filterActive !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => { setFilterActive('all'); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="text-xs text-accent hover:text-accent/80 px-3 py-2"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {total.toLocaleString()} parking{total !== 1 ? 's' : ''} found
        </p>
      </div>

      <Table
        columns={columns}
        data={parkings}
        isLoading={isLoading}
        emptyMessage="No parking records found"
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        total={total}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Delete Parking Record"
        message="Are you sure you want to delete this parking record? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}
