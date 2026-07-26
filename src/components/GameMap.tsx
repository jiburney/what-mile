import { useEffect, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  useMapEvents,
  useMap,
  Popup,
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

function MapController({ mapRef, showResult, actualLocation, pendingGuess }: MapControllerProps) {
  const map = useMap();

  // Store map instance in ref
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  // Initial load: fit to AT_BOUNDS
  useEffect(() => {
    if (!showResult) {
      map.fitBounds(AT_BOUNDS);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Keep Leaflet's internal tile grid in sync with container size
  useEffect(() => {
    const map = containerRef.current;
    if (!map) return;

    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    const settleTimer = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(settleTimer);
    };
  }, []);

  const trailStyle: L.PathOptions = {
    color: '#2d5016',
    weight: 3.4,
    opacity: 1,
  };

  return (
    <MapContainer
      bounds={AT_BOUNDS}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      ref={containerRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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
