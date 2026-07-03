// admin/src/pages/ScheduledNotifications.tsx
import React, { useEffect, useState } from 'react';
import {
  ClockIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'welcome' | 'reminder' | 'tip' | 'winback' | 'seasonal';
type TriggerType = 'days_after_register' | 'days_inactive' | 'recurring' | 'fixed_date' | 'active_parking_hours';
type RecurringPattern = 'daily' | 'weekly' | 'monthly';

interface ScheduledNotification {
  id: string;
  title: { tr: string; en: string };
  body: { tr: string; en: string };
  category: Category;
  trigger_type: TriggerType;
  trigger_value: number | null;
  recurring_pattern: RecurringPattern | null;
  recurring_day: number | null;
  recurring_hour: number;
  is_active: boolean;
  createdAt: string;
}

const EMPTY_FORM: Omit<ScheduledNotification, 'id' | 'createdAt'> = {
  title: { tr: '', en: '' },
  body: { tr: '', en: '' },
  category: 'reminder',
  trigger_type: 'days_after_register',
  trigger_value: 1,
  recurring_pattern: null,
  recurring_day: null,
  recurring_hour: 7,
  is_active: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const categoryColors: Record<Category, string> = {
  welcome: 'bg-green-500/10 text-green-400 border-green-500/20',
  reminder: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  tip: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  winback: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  seasonal: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function describeTrigger(n: ScheduledNotification): string {
  switch (n.trigger_type) {
    case 'days_after_register':
      return `Day ${n.trigger_value} after register`;
    case 'days_inactive':
      return `${n.trigger_value} days inactive`;
    case 'fixed_date':
      return `Every month on day ${n.trigger_value}`;
    case 'active_parking_hours':
      return `Active parking ≥ ${n.trigger_value}h`;
    case 'recurring': {
      if (n.recurring_pattern === 'daily') return 'Every day';
      if (n.recurring_pattern === 'weekly') return `Every ${DAYS[n.recurring_day ?? 0]}`;
      if (n.recurring_pattern === 'monthly') return `Monthly on day ${n.recurring_day}`;
      return 'Recurring';
    }
    default:
      return '—';
  }
}

// ─── Modal Form ───────────────────────────────────────────────────────────────

interface NotifFormProps {
  initial: Omit<ScheduledNotification, 'id' | 'createdAt'>;
  onSave: (data: Omit<ScheduledNotification, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  title: string;
}

function NotifForm({ initial, onSave, onClose, isSaving, title }: NotifFormProps) {
  const [form, setForm] = useState(initial);

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));
  const setTitleField = (lang: 'tr' | 'en', val: string) =>
    setForm((prev) => ({ ...prev, title: { ...prev.title, [lang]: val } }));
  const setBodyField = (lang: 'tr' | 'en', val: string) =>
    setForm((prev) => ({ ...prev, body: { ...prev.body, [lang]: val } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const inputCls =
    'w-full bg-bg-deep border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary/40';
  const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-card border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-bg-card border-b border-white/10 flex items-center justify-between px-6 py-4 z-10">
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Category + Trigger Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
                {(['welcome', 'reminder', 'tip', 'winback', 'seasonal'] as Category[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Trigger Type</label>
              <select
                value={form.trigger_type}
                onChange={(e) => {
                  const t = e.target.value as TriggerType;
                  set('trigger_type', t);
                  set('trigger_value', t === 'recurring' ? null : 1);
                  set('recurring_pattern', t === 'recurring' ? 'daily' : null);
                  set('recurring_day', null);
                }}
                className={inputCls}
              >
                <option value="days_after_register">Days after register</option>
                <option value="days_inactive">Days inactive</option>
                <option value="recurring">Recurring</option>
                <option value="fixed_date">Fixed date (day of month)</option>
                <option value="active_parking_hours">Active parking duration (hours)</option>
              </select>
            </div>
          </div>

          {/* Trigger-specific fields */}
          {(form.trigger_type === 'days_after_register' ||
            form.trigger_type === 'days_inactive' ||
            form.trigger_type === 'fixed_date' ||
            form.trigger_type === 'active_parking_hours') && (
            <div>
              <label className={labelCls}>
                {form.trigger_type === 'fixed_date'
                  ? 'Day of month (1–31)'
                  : form.trigger_type === 'active_parking_hours'
                  ? 'Hours since parked'
                  : 'Number of days'}
              </label>
              <input
                type="number"
                min={1}
                max={form.trigger_type === 'fixed_date' ? 31 : 9999}
                value={form.trigger_value ?? 1}
                onChange={(e) => set('trigger_value', parseInt(e.target.value, 10) || 1)}
                className={inputCls}
                required
              />
            </div>
          )}

          {form.trigger_type === 'recurring' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Pattern</label>
                <select
                  value={form.recurring_pattern ?? 'daily'}
                  onChange={(e) => { set('recurring_pattern', e.target.value); set('recurring_day', null); }}
                  className={inputCls}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {(form.recurring_pattern === 'weekly' || form.recurring_pattern === 'monthly') && (
                <div>
                  <label className={labelCls}>
                    {form.recurring_pattern === 'weekly' ? 'Day of week (0=Sun)' : 'Day of month (1–31)'}
                  </label>
                  <input
                    type="number"
                    min={form.recurring_pattern === 'weekly' ? 0 : 1}
                    max={form.recurring_pattern === 'weekly' ? 6 : 31}
                    value={form.recurring_day ?? 1}
                    onChange={(e) => set('recurring_day', parseInt(e.target.value, 10))}
                    className={inputCls}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* Hour */}
          <div>
            <label className={labelCls}>Hour (UTC, 0–23)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={form.recurring_hour}
              onChange={(e) => set('recurring_hour', parseInt(e.target.value, 10) || 0)}
              className={inputCls}
              required
            />
            <p className="text-xs text-text-secondary mt-1">UTC 7 = 10:00 TR (UTC+3 summer)</p>
          </div>

          {/* Title TR + EN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Title TR</label>
              <input
                type="text"
                value={form.title.tr}
                onChange={(e) => setTitleField('tr', e.target.value)}
                placeholder="{name} placeholder destekli"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Title EN</label>
              <input
                type="text"
                value={form.title.en}
                onChange={(e) => setTitleField('en', e.target.value)}
                placeholder="{name} placeholder supported"
                className={inputCls}
                required
              />
            </div>
          </div>

          {/* Body TR + EN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Body TR</label>
              <textarea
                value={form.body.tr}
                onChange={(e) => setBodyField('tr', e.target.value)}
                placeholder="{name} ile kişiselleştir"
                rows={3}
                className={inputCls + ' resize-none'}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Body EN</label>
              <textarea
                value={form.body.en}
                onChange={(e) => setBodyField('en', e.target.value)}
                placeholder="Use {name} to personalise"
                rows={3}
                className={inputCls + ' resize-none'}
                required
              />
            </div>
          </div>

          <p className="text-xs text-text-secondary bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
            💡 <code className="text-primary">{'{name}'}</code> → kullanıcının adının ilk kelimesi ile değiştirilir
          </p>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">Active</label>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-text-secondary hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-bg-deep text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────────────────────

function BulkImportModal({
  onImport,
  onClose,
  isImporting,
}: {
  onImport: (items: any[]) => Promise<void>;
  onClose: () => void;
  isImporting: boolean;
}) {
  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState<{
    valid: number;
    errors: string[];
    parsed: any[];
  } | null>(null);

  const handleParse = () => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setParseResult({ valid: 0, errors: ['Root must be a JSON array'], parsed: [] });
        return;
      }
      const errors: string[] = [];
      const validItems: any[] = [];
      const validCats = ['welcome', 'reminder', 'tip', 'winback', 'seasonal'];
      const validTriggers = ['days_after_register', 'days_inactive', 'recurring', 'fixed_date', 'active_parking_hours'];
      parsed.forEach((item, i) => {
        const row = i + 1;
        if (!item?.title?.tr || !item?.title?.en)
          errors.push(`Item ${row}: title.tr and title.en required`);
        else if (!item?.body?.tr || !item?.body?.en)
          errors.push(`Item ${row}: body.tr and body.en required`);
        else if (!validCats.includes(item.category))
          errors.push(`Item ${row}: invalid category`);
        else if (!validTriggers.includes(item.trigger_type))
          errors.push(`Item ${row}: invalid trigger_type`);
        else validItems.push(item);
      });
      setParseResult({ valid: validItems.length, errors, parsed: validItems });
    } catch (e: any) {
      setParseResult({ valid: 0, errors: [`JSON parse error: ${e.message}`], parsed: [] });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-card border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-text-primary">Bulk Import</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setParseResult(null); }}
          placeholder={`[\n  {\n    "title": { "tr": "...", "en": "..." },\n    "body": { "tr": "...", "en": "..." },\n    "category": "welcome",\n    "trigger_type": "days_after_register",\n    "trigger_value": 1,\n    "recurring_hour": 7\n  }\n]`}
          rows={10}
          className="w-full bg-bg-deep border border-white/10 rounded-xl px-3 py-2 text-xs text-text-primary font-mono resize-none focus:outline-none focus:border-primary/40 mb-3"
        />

        {parseResult && (
          <div className="mb-3 space-y-1">
            {parseResult.errors.map((e, i) => (
              <p key={i} className="text-xs text-error">✗ {e}</p>
            ))}
            {parseResult.valid > 0 && (
              <p className="text-xs text-green-400">✓ {parseResult.valid} valid items ready to import</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleParse}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-text-secondary hover:bg-white/5 transition-colors"
          >
            Validate
          </button>
          <button
            onClick={() => parseResult?.parsed && onImport(parseResult.parsed)}
            disabled={!parseResult || parseResult.valid === 0 || isImporting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-bg-deep text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {isImporting ? 'Importing...' : `Import ${parseResult?.valid ?? 0} items`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScheduledNotifications() {
  const { showToast } = useToast();
  const [items, setItems] = useState<ScheduledNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editItem, setEditItem] = useState<ScheduledNotification | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id?: string; bulk?: boolean } | null>(null);

  const load = async (p = page) => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/scheduled-notifications', { params: { page: p, limit: 25 } });
      setItems(data.items);
      setTotal(data.total);
      setPage(p);
      setTotalPages(data.totalPages);
    } catch {
      showToast('Failed to load scheduled notifications', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));

  const handleToggleActive = async (item: ScheduledNotification) => {
    try {
      await api.patch(`/scheduled-notifications/${item.id}`, { is_active: !item.is_active });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i))
      );
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  const handleSave = async (form: Omit<ScheduledNotification, 'id' | 'createdAt'>) => {
    setIsSaving(true);
    try {
      if (editItem) {
        await api.patch(`/scheduled-notifications/${editItem.id}`, form);
        showToast('Updated successfully');
      } else {
        await api.post('/scheduled-notifications', form);
        showToast('Notification added');
      }
      setEditItem(null);
      setShowAdd(false);
      load(1);
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      await api.delete(`/scheduled-notifications/${id}`);
      showToast('Deleted');
      setConfirmDelete(null);
      load(page);
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await api.delete('/scheduled-notifications/bulk', { data: { ids: [...selected] } });
      showToast(`Deleted ${selected.size} items`);
      setSelected(new Set());
      setConfirmDelete(null);
      load(1);
    } catch {
      showToast('Failed to bulk delete', 'error');
    }
  };

  const handleImport = async (importItems: any[]) => {
    setIsImporting(true);
    try {
      const { data } = await api.post('/scheduled-notifications/bulk', importItems);
      showToast(
        `Imported ${data.created} items${data.skipped > 0 ? `, ${data.skipped} skipped` : ''}`
      );
      setShowImport(false);
      load(1);
    } catch {
      showToast('Import failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const activeCount = items.filter((i) => i.is_active).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClockIcon className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-text-primary">Scheduled Notifications</h1>
            <p className="text-xs text-text-secondary">
              {total} total · {activeCount} active on this page
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-sm text-text-secondary hover:bg-white/5 transition-colors"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-bg-deep text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-error/5 border border-error/20 rounded-xl px-4 py-2.5">
          <span className="text-sm text-text-primary">{selected.size} selected</span>
          <button
            onClick={() => setConfirmDelete({ bulk: true })}
            className="flex items-center gap-1.5 text-sm text-error hover:text-error/80 transition-colors ml-auto"
          >
            <TrashIcon className="w-4 h-4" />
            Delete selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-text-secondary hover:text-text-primary"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selected.size === items.length}
                    onChange={toggleAll}
                    className="accent-primary"
                  />
                </th>
                {['Category', 'Trigger', 'Title (TR)', 'Hour (UTC)', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-text-secondary text-sm">
                    No scheduled notifications yet. Click <strong>Add</strong> to create one.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md border font-medium ${categoryColors[item.category]}`}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{describeTrigger(item)}</td>
                    <td
                      className="px-4 py-3 text-sm text-text-primary max-w-xs truncate"
                      title={item.title.tr}
                    >
                      {item.title.tr}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {String(item.recurring_hour).padStart(2, '0')}:00
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          item.is_active ? 'bg-primary' : 'bg-white/10'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            item.is_active ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditItem(item)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ id: item.id })}
                          className="p-1.5 rounded-lg hover:bg-error/10 text-text-secondary hover:text-error transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
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
            <p className="text-xs text-text-secondary">{total} total</p>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => load(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === page ? 'bg-primary text-bg-deep' : 'hover:bg-white/5 text-text-secondary'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(showAdd || editItem) && (
        <NotifForm
          title={editItem ? 'Edit Notification' : 'Add Notification'}
          initial={editItem ? { ...editItem } : EMPTY_FORM}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditItem(null); }}
          isSaving={isSaving}
        />
      )}

      {/* Bulk Import Modal */}
      {showImport && (
        <BulkImportModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
          isImporting={isImporting}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!confirmDelete}
        title={
          confirmDelete?.bulk
            ? `Delete ${selected.size} notifications?`
            : 'Delete notification?'
        }
        message={
          confirmDelete?.bulk
            ? 'This will permanently delete all selected notifications.'
            : 'This notification will be permanently deleted.'
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete?.bulk) handleBulkDelete();
          else if (confirmDelete?.id) handleDeleteSingle(confirmDelete.id);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
