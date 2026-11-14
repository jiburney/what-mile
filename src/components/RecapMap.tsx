import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  CircleMarker,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RoundResult } from '../types';
import { TIER_COLORS } from '../utils/scoring';

// AT bounding box
const AT_BOUNDS: L.LatLngBoundsExpression = [
  [34.0, -84.5],  // Southwest (Georgia)
  [45.9, -68.0]   // Northeast (Maine)
];

interface RecapMapProps {
  rounds: RoundResult[];
}

// Create numbered pin icons for photo locations
function createNumberedIcon(number: number): L.DivIcon {
  return L.divIcon({
    className: 'recap-pin',
    html: `<div class="recap-pin-inner">${number}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

// Component to fit map to AT bounds on mount
function FitBounds() {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(AT_BOUNDS, { padding: [20, 20] });
  }, [map]);

  return null;
}

// Component to load and display the AT trail route
function TrailRoute() {
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch('/at-route.geojson')
      .then(res => res.json())
      .then(data => setGeoJsonData(data))
      .catch(err => console.error('Failed to load trail route:', err));
  }, []);

  if (!geoJsonData) return null;

  return (
    <GeoJSON
      data={geoJsonData}
      style={{
        color: '#2d5016',
        weight: 2,
        opacity: 0.6,
      }}
    />
  );
}

export function RecapMap({ rounds }: RecapMapProps) {
  return (
    <div className="recap-map-container">
      <MapContainer
        bounds={AT_BOUNDS}
        className="recap-map"
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <TrailRoute />
        <FitBounds />

        {/* Photo location pins and guess markers */}
        {rounds.map((round, index) => {
          const photoLat = round.image.coordinates[0];
          const photoLng = round.image.coordinates[1];
          const guessLat = round.guess[0];
          const guessLng = round.guess[1];
          const showGuess = round.distanceMiles >= 1; // Skip guess marker if < 1 mile off

          return (
            <div key={round.image.id}>
              {/* Photo location numbered pin */}
              <Marker
                position={[photoLat, photoLng]}
                icon={createNumberedIcon(index + 1)}
              />

              {/* Guess marker and connecting line (only if >= 1 mile off) */}
              {showGuess && (
                <>
                  {/* Dashed line from guess to photo */}
                  <Polyline
                    positions={[
                      [guessLat, guessLng],
                      [photoLat, photoLng],
                    ]}
                    pathOptions={{
                      color: TIER_COLORS[round.tier],
                      weight: 2,
                      opacity: 0.6,
                      dashArray: '5, 5',
                    }}
                  />

                  {/* Guess circle marker */}
                  <CircleMarker
                    center={[guessLat, guessLng]}
                    radius={8}
                    pathOptions={{
                      fillColor: '#f7f4ef',
                      fillOpacity: 1,
                      color: TIER_COLORS[round.tier],
                      weight: 2,
                    }}
                  />
                </>
              )}
            </div>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="recap-map-legend">
        <div className="recap-map-legend-item">
          <div className="recap-map-legend-pin"></div>
          <span>Photo location</span>
        </div>
        <div className="recap-map-legend-item">
          <div className="recap-map-legend-circle"></div>
          <span>Your guess</span>
        </div>
      </div>
    </div>
  );
}
