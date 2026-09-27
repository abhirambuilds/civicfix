'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { OSM_TILE_URL, OSM_ATTRIBUTION, DEFAULT_MAP_ZOOM } from '@/lib/constants';

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
  flyToTrigger?: number; // Counter incremented to trigger pan/fly animation
}

/**
 * Creates a modern, SVG-based Leaflet DivIcon.
 * This completely avoids Next.js broken image bundling issues with default Leaflet PNG markers.
 */
function createIssueMarkerIcon() {
  return L.divIcon({
    className: 'civicfix-location-marker',
    html: `
      <div style="position: relative; width: 34px; height: 42px; display: flex; align-items: center; justify-content: center; cursor: grab;">
        <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 14px; height: 6px; background: rgba(0, 0, 0, 0.35); border-radius: 50%; filter: blur(1.5px);"></div>
        <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.45));">
          <path d="M17 0C7.611 0 0 7.611 0 17C0 27.2 14.5 40.5 16.1 41.9C16.6 42.3 17.4 42.3 17.9 41.9C19.5 40.5 34 27.2 34 17C34 7.611 26.389 0 17 0Z" fill="#4F46E5"/>
          <path d="M17 1C8.163 1 1 8.163 1 17C1 26.5 14.8 39.4 16.6 40.9C16.8 41.1 17.2 41.1 17.4 40.9C19.2 39.4 33 26.5 33 17C33 8.163 25.837 1 17 1Z" stroke="#A5B4FC" stroke-width="1.5"/>
          <circle cx="17" cy="16" r="6" fill="#FFFFFF"/>
          <circle cx="17" cy="16" r="3" fill="#4F46E5"/>
        </svg>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
  });
}

/**
 * Handles map click events to reposition the marker.
 */
function MapClickHandler({
  onLocationChange,
}: {
  onLocationChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Smoothly centers and pans the map when GPS or programmatic updates trigger.
 */
function MapViewController({
  latitude,
  longitude,
  flyToTrigger,
}: {
  latitude: number;
  longitude: number;
  flyToTrigger?: number;
}) {
  const map = useMap();
  const prevTrigger = useRef(flyToTrigger);

  useEffect(() => {
    if (flyToTrigger !== undefined && flyToTrigger !== prevTrigger.current) {
      prevTrigger.current = flyToTrigger;
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 16), {
        duration: 1.2,
      });
    }
  }, [map, latitude, longitude, flyToTrigger]);

  return null;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onLocationChange,
  flyToTrigger,
}: LocationPickerMapProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const markerIcon = useMemo(() => createIssueMarkerIcon(), []);

  // Event handlers for dragging the marker
  const markerEventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const latlng = marker.getLatLng();
          onLocationChange(latlng.lat, latlng.lng);
        }
      },
    }),
    [onLocationChange]
  );

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-inner border border-slate-800">
      <MapContainer
        center={[latitude, longitude]}
        zoom={DEFAULT_MAP_ZOOM}
        scrollWheelZoom={true}
        className="w-full h-full min-h-[360px] z-10"
        attributionControl={true}
      >
        {/* OpenStreetMap Tile Layer with HTTPS and mandatory attribution */}
        <TileLayer
          url={OSM_TILE_URL}
          attribution={OSM_ATTRIBUTION}
          maxZoom={19}
        />

        {/* Map Click Listener */}
        <MapClickHandler onLocationChange={onLocationChange} />

        {/* Animated Map Panner */}
        <MapViewController
          latitude={latitude}
          longitude={longitude}
          flyToTrigger={flyToTrigger}
        />

        {/* Draggable Issue Location Marker */}
        <Marker
          position={[latitude, longitude]}
          draggable={true}
          eventHandlers={markerEventHandlers}
          ref={markerRef}
          icon={markerIcon}
          title="Drag pin to adjust issue location"
          alt="Selected issue location marker"
        />
      </MapContainer>
    </div>
  );
}
