import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, MapPinIcon, TrashIcon, BellIcon,
  CheckBadgeIcon, UserCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import api from '../services/api';

interface UserData {
  id: string;
  name: string;
  email: string;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  freemiumExpiresAt: string | null;
  pinCount: number;
  pushToken: string | null;
  marketingNotificationsEnabled: boolean;
  createdAt: string;
  googleId: string | null;
  appleId: string | null;
}

interface Parking {
  id: string;
  address: string | null;
  latitude: number;
  longitude: number;
  isActive: boolean;
  parkedAt: string;
  photoCloudStoragePath: string | null;
  notes: string | null;
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [user, setUser] = useState<UserData | null>(null);
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingPush, setIsSendingPush] = useState(false);

  // Subscription edit state
  const [subForm, setSubForm] = useState({
    isSubscribed: false,
    plan: '',
    expiresAt: '',
  });

  // Push form
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/users/${id}`)
      .then(({ data }) => {
        setUser(data.user);
        setParkings(data.parkings);
        setSubForm({
          isSubscribed: data.user.isSubscribed,
          plan: data.user.subscriptionPlan ?? '',
          expiresAt: data.user.subscriptionExpiresAt
            ? format(new Date(data.user.subscriptionExpiresAt), "yyyy-MM-dd'T'HH:mm")
            : '',
        });
      })
      .catch(() => showToast('Failed to load user', 'error'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleSaveSubscription = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      await api.patch(`/users/${id}`, {
        isSubscribed: subForm.isSubscribed,
        plan: subForm.plan || null,
        expiresAt: subForm.expiresAt || null,
      });
      showToast('Subscription updated successfully');
      // Refresh
      const { data } = await api.get(`/users/${id}`);
      setUser(data.user);
    } catch {
      showToast('Failed to update subscription', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/users/${id}`);
      showToast('User deleted successfully');
      navigate('/users');
    } catch {
      showToast('Failed to delete user', 'error');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSendPush = async () => {
    if (!id || !pushTitle || !pushBody) {
      showToast('Title and body are required', 'error');
      return;
    }
    setIsSendingPush(true);
    try {
      const { data } = await api.post('/push/send', {
        title: pushTitle,
        body: pushBody,
        target: 'user',
        userId: id,
      });
      showToast(`Push sent to ${data.sent} device(s)`);
      setPushTitle('');
      setPushBody('');
    } catch {
      showToast('Failed to send push notification', 'error');
    } finally {
      setIsSendingPush(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-text-secondary">User not found.</div>
    );
  }

  const authMethod = user.googleId ? 'Google' : user.appleId ? 'Apple' : 'Email';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/users')}
          className="p-2 rounded-lg hover:bg-white/5 text-text-secondary hover:text-text-primary"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
            <span className="text-primary text-xl font-bold">
              {user.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{user.name}</h2>
            <p className="text-sm text-text-secondary">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* User Info */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <UserCircleIcon className="w-4 h-4 text-text-secondary" /> User Info
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Auth Method', value: authMethod },
                { label: 'Pin Count', value: user.pinCount },
                { label: 'Push Token', value: user.pushToken ? 'Registered' : 'None' },
                { label: 'Marketing Notifications', value: user.marketingNotificationsEnabled ? 'Enabled' : 'Disabled' },
                {
                  label: 'Joined',
                  value: user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—',
                },
                {
                  label: 'Freemium Until',
                  value: user.freemiumExpiresAt
                    ? format(new Date(user.freemiumExpiresAt), 'MMM d, yyyy HH:mm')
                    : 'N/A',
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-text-secondary">{label}</span>
                  <span className="text-text-primary font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription Management */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <CheckBadgeIcon className="w-4 h-4 text-text-secondary" /> Subscription
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Active</span>
                <button
                  onClick={() => setSubForm((f) => ({ ...f, isSubscribed: !f.isSubscribed }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    subForm.isSubscribed ? 'bg-success' : 'bg-surface'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      subForm.isSubscribed ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Plan</label>
                <select
                  value={subForm.plan}
                  onChange={(e) => setSubForm((f) => ({ ...f, plan: e.target.value }))}
                  className="w-full bg-bg-deep border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/40"
                >
                  <option value="">None</option>
                  <option value="monthly">Monthly</option>
                  <option value="sixMonth">6 Month</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">Expires At</label>
                <input
                  type="datetime-local"
                  value={subForm.expiresAt}
                  onChange={(e) => setSubForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full bg-bg-deep border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/40"
                />
              </div>

              <button
                onClick={handleSaveSubscription}
                disabled={isSaving}
                className="w-full bg-primary hover:bg-primary-dark text-bg-deep font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save Subscription'}
              </button>
            </div>
          </div>

          {/* Send Push */}
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <BellIcon className="w-4 h-4 text-text-secondary" /> Send Push
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="Title"
                className="w-full bg-bg-deep border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary/40"
              />
              <textarea
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                placeholder="Message body..."
                rows={3}
                className="w-full bg-bg-deep border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary/40 resize-none"
              />
              <button
                onClick={handleSendPush}
                disabled={isSendingPush || !user.pushToken}
                className="w-full bg-accent hover:bg-accent/80 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {isSendingPush ? 'Sending...' : user.pushToken ? 'Send Notification' : 'No Push Token'}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-error/5 border border-error/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-error mb-3 flex items-center gap-2">
              <TrashIcon className="w-4 h-4" /> Danger Zone
            </h3>
            <p className="text-xs text-text-secondary mb-4">
              Permanently delete this user and all their data. This cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full bg-error/10 hover:bg-error/20 text-error border border-error/20 font-medium py-2 rounded-lg text-sm transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>

        {/* Right column — Parkings */}
        <div className="lg:col-span-2">
          <div className="bg-bg-card border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-text-secondary" /> Parking Records
              </h3>
              <span className="text-xs text-text-secondary bg-white/5 px-2 py-1 rounded-md">
                {parkings.length} total
              </span>
            </div>

            {parkings.length === 0 ? (
              <div className="text-center py-12 text-text-secondary text-sm">
                No parking records yet
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
                {parkings.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-bg-deep border border-white/5"
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${p.isActive ? 'bg-success' : 'bg-white/20'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {p.address || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-text-secondary">
                          {p.parkedAt ? format(new Date(p.parkedAt), 'MMM d, yyyy HH:mm') : '—'}
                        </span>
                        {p.isActive && (
                          <span className="text-xs text-success">Active</span>
                        )}
                        {p.photoCloudStoragePath && (
                          <span className="text-xs text-text-secondary">📷 Photo</span>
                        )}
                      </div>
                      {p.notes && (
                        <p className="text-xs text-text-secondary/60 mt-1 truncate">{p.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteModal}
        title="Delete User Account"
        message={`Are you sure you want to permanently delete ${user.name}'s account? This will also delete all their parking records and files. This action cannot be undone.`}
        confirmLabel="Delete Account"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}
