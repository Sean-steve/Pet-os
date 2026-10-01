/**
 * Pet OS Sprint 14 - Geospatial & Anomaly Detection Utilities
 * Implements high-precision geodesic calculation and GPS noise filtering.
 */

import { LocationObservation, RouteCoordinatePoint, DistanceReliability, ObservationAnomalyFlag, LocationQuality } from './types';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates geodesic distance between two points on WGS84 sphere using Haversine formula.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10;
}

/**
 * Validates strict WGS84 latitude/longitude coordinate bounds.
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Evaluates observation quality according to accuracy thresholds.
 */
export function classifyQuality(accuracyM: number, flags: ObservationAnomalyFlag[]): LocationQuality {
  if (flags.includes('SUSPECT_JUMP') || flags.includes('SUSPECT_SPEED')) {
    return 'LOW';
  }
  if (accuracyM <= 15) return 'HIGH';
  if (accuracyM <= 50) return 'MEDIUM';
  if (accuracyM > 50) return 'LOW';
  return 'UNKNOWN';
}

/**
 * Analyzes observation against historical point for speed jumps, drift, and clock anomalies.
 */
export function evaluatePointAnomalies(
  current: { latitude: number; longitude: number; accuracyM: number; observedAt: string; receivedAt: string },
  previous?: { latitude: number; longitude: number; accuracyM: number; observedAt: string }
): ObservationAnomalyFlag[] {
  const flags: ObservationAnomalyFlag[] = [];

  // Clock skew: check difference between device observedAt and ingestion receivedAt
  const observedMs = new Date(current.observedAt).getTime();
  const receivedMs = new Date(current.receivedAt).getTime();
  const clockSkewMs = Math.abs(receivedMs - observedMs);
  if (clockSkewMs > 10 * 60 * 1000) {
    flags.push('CLOCK_SKEW_EXCESSIVE');
  }

  // Poor accuracy
  if (current.accuracyM > 65) {
    flags.push('POOR_ACCURACY');
  }

  // Delta checks against previous point
  if (previous) {
    const prevObservedMs = new Date(previous.observedAt).getTime();
    const timeDeltaSeconds = (observedMs - prevObservedMs) / 1000;

    if (timeDeltaSeconds > 0) {
      const distance = haversineDistanceMeters(
        previous.latitude,
        previous.longitude,
        current.latitude,
        current.longitude
      );

      const calculatedSpeedMps = distance / timeDeltaSeconds;

      // Teleportation / jump check: > 150m in < 3 seconds
      if (distance > 150 && timeDeltaSeconds < 3) {
        flags.push('SUSPECT_JUMP');
      }

      // Max realistic pet run speed: ~25 m/s (~90 km/h) (greyhound max is ~20 m/s)
      if (calculatedSpeedMps > 28) {
        flags.push('SUSPECT_SPEED');
      }
    }
  }

  return flags;
}

/**
 * Computes filtered route distance and confidence.
 * Excludes anomalous teleportation points from inflating the walk distance.
 */
export function calculateFilteredRouteDistance(
  points: RouteCoordinatePoint[]
): { distanceMeters: number; reliability: DistanceReliability } {
  if (points.length < 2) {
    return { distanceMeters: 0, reliability: 'UNAVAILABLE' };
  }

  // Sort chronologically
  const sorted = [...points].sort(
    (a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime()
  );

  let totalDistance = 0;
  let reliablePointCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // Filter out degraded accuracy points (> 75m) to avoid GPS drift inflation
    if (prev.accuracyM > 75 || curr.accuracyM > 75) {
      continue;
    }

    const dist = haversineDistanceMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const timeDeltaSec = (new Date(curr.observedAt).getTime() - new Date(prev.observedAt).getTime()) / 1000;

    // Reject speed anomalies (> 25 m/s)
    if (timeDeltaSec > 0 && dist / timeDeltaSec > 25) {
      continue;
    }

    // Ignore jitter: movements < 2 meters when stationary
    if (dist < 2) {
      continue;
    }

    totalDistance += dist;
    reliablePointCount++;
  }

  const reliability: DistanceReliability =
    reliablePointCount >= sorted.length * 0.7 ? 'HIGH_CONFIDENCE' : 'LOW_CONFIDENCE';

  return {
    distanceMeters: Math.round(totalDistance),
    reliability,
  };
}
