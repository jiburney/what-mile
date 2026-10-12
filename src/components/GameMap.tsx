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

// AT bounding box: Springer (34.6°N) to Katahdin (45.9°N)
const AT_BOUNDS: L.LatLngBoundsExpression = [
  [34.0, -85.0],
  [46.5, -67.5],
];

interface ClickHandlerProps {
  onGuess: (coords: [number, number]) => void;
  disabled: boolean;
}

function ClickHandler({ onGuess, disabled }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (!disabled) {
        onGuess([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

// Keeps Leaflet's tile grid in sync with the container's actual size.
// Must be a child of MapContainer so useMap() can reach the map via context —
// reading mapRef.current from a parent useEffect(..., []) fails in react-leaflet 5
// because the ref is populated after a re-render, not on the first effect run.
function MapController() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    // Correct for the address bar still settling right after mount.
    const settleTimer = setTimeout(() => map.invalidateSize(), 300);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(settleTimer);
    };
  }, [map]);

  return null;
}

interface Props {
  onGuess: (coords: [number, number]) => void;
  pendingGuess: [number, number] | null;
  actualLocation?: [number, number];
  actualName?: string;
  showResult: boolean;
}

export function GameMap({ onGuess, pendingGuess, actualLocation, actualName, showResult }: Props) {
  const [trailData, setTrailData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [trailError, setTrailError] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    fetch('/at-route.geojson')
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then(setTrailData)
      .catch(() => setTrailError(true));
  }, []);

  // When result is shown, fit bounds to include both markers
  useEffect(() => {
    if (showResult && actualLocation && pendingGuess && mapRef.current) {
      const bounds = L.latLngBounds([
        L.latLng(actualLocation[0], actualLocation[1]),
        L.latLng(pendingGuess[0], pendingGuess[1]),
      ]).pad(0.3);
      mapRef.current.fitBounds(bounds);
    }
  }, [showResult, actualLocation, pendingGuess]);

  const trailStyle: L.PathOptions = {
    color: '#2d5016',
    weight: 3,
    opacity: 0.85,
  };

  return (
    <div className="map-wrapper">
      <MapContainer
        bounds={AT_BOUNDS}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        ref={mapRef}
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
        <MapController />
        <ClickHandler onGuess={onGuess} disabled={showResult} />
        {pendingGuess && (
          <Marker position={pendingGuess} icon={guessIcon}>
            <Popup>Your guess</Popup>
          </Marker>
        )}
        {showResult && actualLocation && (
          <Marker position={actualLocation} icon={actualIcon}>
            <Popup>{actualName ?? 'Actual location'}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
