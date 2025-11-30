/**
 * Location Service - Handles geolocation and distance calculations
 */

const EARTH_RADIUS = 6371e3; // meters

class LocationService {
  constructor() {
    this.watchId = null;
    this.currentPosition = null;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS * c;
  }

  /**
   * Format distance for display
   */
  formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  }

  /**
   * Request user's current location
   */
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          resolve(this.currentPosition);
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  /**
   * Watch user's location continuously
   */
  watchLocation(onUpdate, onError) {
    if (!navigator.geolocation) {
      onError(new Error('Geolocation not supported'));
      return null;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.currentPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        onUpdate(this.currentPosition);
      },
      (error) => {
        onError(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    return this.watchId;
  }

  /**
   * Stop watching location
   */
  stopWatching() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Check if user is within a geofence
   */
  isWithinGeofence(targetLat, targetLon, radiusMeters) {
    if (!this.currentPosition) {
      return { isInside: false, distance: null };
    }

    const distance = this.calculateDistance(
      this.currentPosition.latitude,
      this.currentPosition.longitude,
      targetLat,
      targetLon
    );

    return {
      isInside: distance <= radiusMeters,
      distance: distance,
      formattedDistance: this.formatDistance(distance)
    };
  }
}

// Singleton instance
const locationService = new LocationService();

export default locationService;
