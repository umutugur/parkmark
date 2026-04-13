import React, { useEffect, useState } from 'react';
import {
  Cog6ToothIcon, LockClosedIcon, ClockIcon, ExclamationTriangleIcon,
  DevicePhoneMobileIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../components/Toast';
import api from '../services/api';

interface AppConfig {
  id?: string;
  pinLimit: number;
  freemiumHours: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minAppVersion: string;
  updatedAt?: string;
}

function SettingSection({
  title,
  icon,
  children,
  onSave,
  isSaving,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onSave: () => void;
  isSaving?: boolean;
}) {
  return (
    <div className="bg-bg-card border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          {icon}
          {title}
        </h3>
      </div>
      <div className="space-y-4">{children}</div>
      <button
        onClick={onSave}
        disabled={isSaving}
        className="mt-5 flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-bg-deep rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
      >
        <CheckIcon className="w-4 h-4" />
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

export default function AppSettings() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<AppConfig>({
    pinLimit: 5,
    freemiumHours: 24,
    maintenanceMode: false,
    maintenanceMessage: '',
    minAppVersion: '1.0.0',
  });

  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get('/config')
      .then(({ data }) => setConfig(data.config))
      .catch(() => showToast('Failed to load config', 'error'))
      .finally(() => setIsLoading(false));
  }, []);

  const save = async (section: string, fields: Partial<AppConfig>) => {
    setSaving((prev) => ({ ...prev, [section]: true }));
    try {
      const { data } = await api.patch('/config', fields);
      setConfig(data.config);
      showToast('Settings saved successfully');
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Free Tier Limits */}
      <SettingSection
        title="Free Tier Limits"
        icon={<LockClosedIcon className="w-4 h-4 text-text-secondary" />}
        onSave={() => save('limits', { pinLimit: config.pinLimit })}
        isSaving={saving['limits']}
      >
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">
            Maximum Pins for Free Users
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={1}
              max={100}
              value={config.pinLimit}
              onChange={(e) => setConfig((c) => ({ ...c, pinLimit: parseInt(e.target.value) || 5 }))}
              className="w-32 bg-bg-deep border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/40"
            />
            <p className="text-xs text-text-secondary">
              Free users can save up to {config.pinLimit} parking locations
            </p>
          </div>
        </div>
      </SettingSection>

      {/* Freemium Duration */}
      <SettingSection
        title="Freemium Trial Duration"
        icon={<ClockIcon className="w-4 h-4 text-text-secondary" />}
        onSave={() => save('freemium', { freemiumHours: config.freemiumHours })}
        isSaving={saving['freemium']}
      >
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">
            Trial Duration (Hours)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={1}
              max={720}
              value={config.freemiumHours}
              onChange={(e) =>
                setConfig((c) => ({ ...c, freemiumHours: parseInt(e.target.value) || 24 }))
              }
              className="w-32 bg-bg-deep border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/40"
            />
            <p className="text-xs text-text-secondary">
              {config.freemiumHours >= 24
                ? `${(config.freemiumHours / 24).toFixed(1)} days trial`
                : `${config.freemiumHours} hours trial`}
            </p>
          </div>
        </div>
      </SettingSection>

      {/* Maintenance Mode */}
      <SettingSection
        title="Maintenance Mode"
        icon={<ExclamationTriangleIcon className="w-4 h-4 text-text-secondary" />}
        onSave={() =>
          save('maintenance', {
            maintenanceMode: config.maintenanceMode,
            maintenanceMessage: config.maintenanceMessage,
          })
        }
        isSaving={saving['maintenance']}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-primary font-medium">Enable Maintenance Mode</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Displays a maintenance message in the app
            </p>
          </div>
          <button
            onClick={() => setConfig((c) => ({ ...c, maintenanceMode: !c.maintenanceMode }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config.maintenanceMode ? 'bg-warning' : 'bg-surface'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                config.maintenanceMode ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {config.maintenanceMode && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Maintenance Message
            </label>
            <textarea
              value={config.maintenanceMessage}
              onChange={(e) => setConfig((c) => ({ ...c, maintenanceMessage: e.target.value }))}
              placeholder="We're performing scheduled maintenance. We'll be back shortly."
              rows={3}
              className="w-full bg-bg-deep border border-warning/20 rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-warning/40 resize-none"
            />
          </div>
        )}

        {config.maintenanceMode && (
          <div className="flex items-start gap-3 bg-warning/5 border border-warning/20 rounded-xl p-4">
            <ExclamationTriangleIcon className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-warning">
              Maintenance mode is active. Users will see a maintenance screen in the app.
            </p>
          </div>
        )}
      </SettingSection>

      {/* Minimum App Version */}
      <SettingSection
        title="Minimum App Version"
        icon={<DevicePhoneMobileIcon className="w-4 h-4 text-text-secondary" />}
        onSave={() => save('version', { minAppVersion: config.minAppVersion })}
        isSaving={saving['version']}
      >
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">
            Minimum Required Version
          </label>
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={config.minAppVersion}
              onChange={(e) => setConfig((c) => ({ ...c, minAppVersion: e.target.value }))}
              placeholder="1.0.0"
              className="w-40 bg-bg-deep border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/40 font-mono"
            />
            <p className="text-xs text-text-secondary">
              Users on older versions will be prompted to update
            </p>
          </div>
          <p className="text-xs text-text-secondary/60 mt-2">
            Use semantic versioning: MAJOR.MINOR.PATCH (e.g., 2.1.0)
          </p>
        </div>
      </SettingSection>

      {/* Config meta */}
      {config.updatedAt && (
        <p className="text-xs text-text-secondary/50 text-center">
          Last updated:{' '}
          {new Date(config.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
