import { useEffect, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  useMapEvents,
  useMap,
  Popup,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon paths (Vite asset handling)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const guessIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'guess-marker',
});

const actualIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'actual-marker',
});

// AT bounding box
const AT_BOUNDS: L.LatLngBoundsExpression = [
  [34.0, -84.5],  // Southwest (Georgia)
  [45.9, -68.0]   // Northeast (Maine)
];

interface ClickHandlerProps {
  onGuess?: (coords: [number, number]) => void;
  showResult: boolean;
}

function ClickHandler({ onGuess, showResult }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (!showResult && onGuess) {
        onGuess([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

interface MapControllerProps {
  mapRef: React.MutableRefObject<L.Map | null>;
  showResult: boolean;
  actualLocation?: [number, number];
  pendingGuess: [number, number] | null;
}

// Reset view button component
function ResetViewButton() {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleReset = () => {
    map.fitBounds(AT_BOUNDS);
  };

  // Prevent click from propagating to map (which would place a guess pin)
  useEffect(() => {
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current);
    }
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="map-reset-view"
      onClick={handleReset}
      aria-label="Reset view to full trail"
      title="Reset view to full trail"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M3 21v-5h5" />
      </svg>
    </button>
  );
}

function MapController({ mapRef, showResult, actualLocation, pendingGuess }: MapControllerProps) {
  const map = useMap();
  const hasInitialFitRef = useRef(false);

  // Store map instance in ref
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  // Attribution: top-right corner, default prefix (Leaflet + OSM credit)
  useEffect(() => {
    map.attributionControl.setPosition('topright');
  }, [map]);

  // Setup container sizing and minimum zoom
  useEffect(() => {
    const setupMinZoom = () => {
      const size = map.getSize();

      // Wait for non-zero, settled dimensions
      if (size.x === 0 || size.y === 0) {
        requestAnimationFrame(setupMinZoom);
        return;
      }

      // Now container has real dimensions
      map.invalidateSize();

      // Compute minimum zoom to fit AT_BOUNDS
      const computedZoom = map.getBoundsZoom(AT_BOUNDS);
      const minZoom = Math.max(computedZoom, 4); // Safety floor
      map.setMinZoom(minZoom);

      // Set initial view exactly once on first mount, never again
      if (!hasInitialFitRef.current) {
        map.fitBounds(AT_BOUNDS);
        hasInitialFitRef.current = true;
      }
    };

    // Initial setup
    const settleTimer = setTimeout(() => setupMinZoom(), 100);

    // Recompute on container resize
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;

      // Invalidate first, then recompute
      map.invalidateSize();
      const computedZoom = map.getBoundsZoom(AT_BOUNDS);
      const minZoom = Math.max(computedZoom, 4);
      map.setMinZoom(minZoom);
    });
    resizeObserver.observe(container);

    return () => {
      clearTimeout(settleTimer);
      resizeObserver.disconnect();
    };
  }, [map, showResult]);

  // Result state: fit both pins
  useEffect(() => {
    if (showResult && actualLocation && pendingGuess) {
      const bounds = L.latLngBounds([
        L.latLng(actualLocation[0], actualLocation[1]),
        L.latLng(pendingGuess[0], pendingGuess[1]),
      ]).pad(0.3);
      map.fitBounds(bounds);
    }
  }, [showResult, actualLocation, pendingGuess, map]);

  return null;
}

interface Props {
  mapRef: React.MutableRefObject<L.Map | null>;
  pendingGuess: [number, number] | null;
  onGuess?: (coords: [number, number]) => void;
  actualLocation?: [number, number];
  actualName?: string;
  showResult: boolean;
}

export function GameMap({
  mapRef,
  pendingGuess,
  onGuess,
  actualLocation,
  actualName,
  showResult,
}: Props) {
  const [trailData, setTrailData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [trailError, setTrailError] = useState(false);
  const containerRef = useRef<L.Map | null>(null);

  useEffect(() => {
    fetch('/at-route.geojson')
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then(setTrailData)
      .catch(() => setTrailError(true));
  }, []);

  const trailStyle: L.PathOptions = {
    color: '#2d5016',
    weight: 3.4,
    opacity: 1,
  };

  const maxBounds = L.latLngBounds([
    [34.0, -84.5],
    [45.9, -68.0]
  ]).pad(0.1);

  return (
    <MapContainer
      bounds={AT_BOUNDS}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      maxBounds={maxBounds}
      maxBoundsViscosity={1.0}
      ref={containerRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      {trailData && (
        <GeoJSON data={trailData} style={trailStyle} />
      )}
      {trailError && (
        <div className="trail-error-notice">
          Trail overlay not loaded — see README for setup
        </div>
      )}
      <MapController
        mapRef={mapRef}
        showResult={showResult}
        actualLocation={actualLocation}
        pendingGuess={pendingGuess}
      />
      <ClickHandler onGuess={onGuess} showResult={showResult} />
      <ResetViewButton />
      {pendingGuess && (
        <Marker
          position={pendingGuess}
          icon={guessIcon}
          draggable={!showResult}
          eventHandlers={{
            dragend: (e) => {
              if (onGuess) {
                const marker = e.target;
                const pos = marker.getLatLng();
                onGuess([pos.lat, pos.lng]);
              }
            }
          }}
        >
          <Popup>Your guess</Popup>
        </Marker>
      )}
      {showResult && actualLocation && (
        <Marker position={actualLocation} icon={actualIcon}>
          <Popup>{actualName ?? 'Actual location'}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
