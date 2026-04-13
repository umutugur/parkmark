import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom yellow car marker
const carIcon = L.divIcon({
  html: `<div style="
    width: 32px; height: 32px;
    background: #FFC107;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 3px solid #0F1320;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
  ">
    <div style="transform: rotate(45deg); font-size: 14px; margin-top: 2px;">🚗</div>
  </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -36],
});

interface ParkingMarker {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  parkedAt: string;
  user: { name: string; email: string } | null;
}

function FitBounds({ parkings }: { parkings: ParkingMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (parkings.length === 0) return;
    const bounds = L.latLngBounds(parkings.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [parkings, map]);
  return null;
}

export default function ParkingMap() {
  const navigate = useNavigate();
  const [parkings, setParkings] = useState<ParkingMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/map-data')
      .then(({ data }) => setParkings(data.parkings))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const getDuration = (parkedAt: string) => {
    const diff = Date.now() - new Date(parkedAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const defaultCenter: [number, number] = [39.9334, 32.8597]; // Turkey center

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-text-secondary">Active Parking</span>
          </div>
          <span className="text-sm font-semibold text-text-primary">{parkings.length} active</span>
        </div>
        <button
          onClick={() => { setIsLoading(true); api.get('/map-data').then(({ data }) => setParkings(data.parkings)).finally(() => setIsLoading(false)); }}
          className="text-xs text-accent hover:text-accent/80 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {parkings.length > 0 && <FitBounds parkings={parkings} />}
            {parkings.map((p) => (
              <Marker key={p.id} position={[p.latitude, p.longitude]} icon={carIcon}>
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <p style={{ fontWeight: 600, marginBottom: 4, color: '#FFC107', fontSize: 13 }}>
                      {p.address || 'Unknown location'}
                    </p>
                    {p.user && (
                      <p style={{ fontSize: 12, marginBottom: 4, color: '#94A3B8' }}>
                        {p.user.name} · {p.user.email}
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
                      Parked: {p.parkedAt ? format(new Date(p.parkedAt), 'MMM d, HH:mm') : '—'}
                    </p>
                    <p style={{ fontSize: 12, color: '#4CAF50', marginBottom: 8 }}>
                      Duration: {getDuration(p.parkedAt)}
                    </p>
                    {p.user && (
                      <button
                        onClick={() => navigate(`/users/${(p.user as any)._id ?? ''}`)}
                        style={{
                          background: '#FFC107',
                          color: '#0F1320',
                          border: 'none',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        View User
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {parkings.length === 0 && !isLoading && (
        <div className="text-center py-8 text-text-secondary text-sm">
          No active parkings to display on the map.
        </div>
      )}
    </div>
  );
}
