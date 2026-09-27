'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Coordinates, DEFAULT_CAMPUS_LOCATION } from '@/lib/constants';
import { LocationPickerSkeleton } from './LocationPickerSkeleton';
import {
  IconCrosshair,
  IconMapPin,
  IconAlertCircle,
  IconCheckCircle,
  IconRefresh,
  IconX,
} from '@/components/ui/Icons';

// Dynamically import the Leaflet map with SSR completely disabled
const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => <LocationPickerSkeleton height="h-[380px]" />,
});

export type LocationSource = 'DEFAULT' | 'GPS' | 'MANUAL';

export interface LocationPickerProps {
  value?: Coordinates;
  onChange?: (coords: Coordinates) => void;
  className?: string;
  height?: string;
}

export function LocationPicker({
  value,
  onChange,
  className = '',
  height = 'h-[380px]',
}: LocationPickerProps) {
  // Use passed value or fallback to seeded campus default
  const [coords, setCoords] = useState<Coordinates>(
    value || DEFAULT_CAMPUS_LOCATION
  );
  const [locationSource, setLocationSource] = useState<LocationSource>(
    value ? 'MANUAL' : 'DEFAULT'
  );
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState<number>(0);

  // Sync internal coordinates if parent updates value prop
  const [prevValue, setPrevValue] = useState<Coordinates | undefined>(value);
  if (value && prevValue !== value) {
    setPrevValue(value);
    if (value.latitude !== coords.latitude || value.longitude !== coords.longitude) {
      setCoords(value);
    }
  }

  // Handler for marker dragging or map clicking
  const handleLocationChange = useCallback(
    (lat: number, lng: number) => {
      const updated: Coordinates = {
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
      };
      setCoords(updated);
      setLocationSource('MANUAL');
      setGpsError(null);
      onChange?.(updated);
    },
    [onChange]
  );

  // Handler for "Use My Current Location" button
  const handleUseCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(
        'Your browser does not support location detection. Please select the location manually on the map.'
      );
      return;
    }

    setIsGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const detected: Coordinates = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };
        setCoords(detected);
        setLocationSource('GPS');
        setGpsError(null);
        setIsGpsLoading(false);
        setFlyToTrigger((prev) => prev + 1); // Triggers smooth flyTo animation
        onChange?.(detected);
      },
      (error) => {
        setIsGpsLoading(false);
        let message = 'Unable to determine your current location. Please place the marker manually.';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            message =
              'Location permission was denied. You can select the location manually on the map.';
            break;
          case error.POSITION_UNAVAILABLE:
            message =
              'GPS position unavailable. Please drag the marker or tap the map to place the issue location.';
            break;
          case error.TIMEOUT:
            message =
              'Location detection timed out. Please select the location manually on the map.';
            break;
        }

        setGpsError(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Reset to SRM campus default center
  const handleResetToCampus = () => {
    setCoords(DEFAULT_CAMPUS_LOCATION);
    setLocationSource('DEFAULT');
    setGpsError(null);
    setFlyToTrigger((prev) => prev + 1);
    onChange?.(DEFAULT_CAMPUS_LOCATION);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top Controls & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <IconMapPin size={15} className="text-indigo-400 shrink-0" />
            <span>Selected Coordinates</span>
          </span>

          {/* Coordinate Pills */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-200 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <span>Lat: {coords.latitude.toFixed(6)}</span>
            <span className="text-slate-600">|</span>
            <span>Lng: {coords.longitude.toFixed(6)}</span>
          </div>

          {/* Location Source Indicator */}
          {locationSource === 'DEFAULT' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Default Campus Center</span>
            </span>
          )}

          {locationSource === 'GPS' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>GPS Location Acquired</span>
            </span>
          )}

          {locationSource === 'MANUAL' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <IconCheckCircle size={12} className="text-indigo-400" />
              <span>Pinned on Map</span>
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {locationSource !== 'DEFAULT' && (
            <button
              type="button"
              onClick={handleResetToCampus}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              title="Reset center to SRM Campus"
            >
              <IconRefresh size={13} />
              <span className="hidden sm:inline">Reset Campus</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isGpsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            aria-label="Use My Current Location via browser GPS"
          >
            <IconCrosshair
              size={14}
              className={isGpsLoading ? 'animate-spin' : ''}
            />
            <span>{isGpsLoading ? 'Detecting GPS...' : 'Use My Current Location'}</span>
          </button>
        </div>
      </div>

      {/* Geolocation Error Alert */}
      {gpsError && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <IconAlertCircle size={16} className="text-amber-400 shrink-0" />
            <span>{gpsError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGpsError(null)}
            className="p-1 rounded text-amber-400 hover:text-amber-200"
            aria-label="Dismiss error notice"
          >
            <IconX size={14} />
          </button>
        </div>
      )}

      {/* Interactive Map Container */}
      <div className={`relative w-full ${height}`}>
        <LocationPickerMap
          latitude={coords.latitude}
          longitude={coords.longitude}
          onLocationChange={handleLocationChange}
          flyToTrigger={flyToTrigger}
        />
      </div>

      {/* Helpful Instructions Footer */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 px-1">
        <p>
          Drag the pin or click/tap anywhere on the map to position the issue marker accurately.
        </p>
        <p className="text-slate-500">
          Powered by OpenStreetMap &bull; No API Key Required
        </p>
      </div>
    </div>
  );
}
