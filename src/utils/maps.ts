export function getMapsHref(address: string, location?: { lat: number; lng: number }) {
  if (location?.lat && location?.lng) {
    return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
