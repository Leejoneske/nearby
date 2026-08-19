/**
 * Web has no MapLibre Native, so the drawn map is the map.
 *
 * The browser build is a preview for screenshots and a fallback for somebody
 * who opened the site rather than the app. Pulling maplibre-gl in for that
 * would add a megabyte to a bundle nobody navigates by.
 */
export { SchematicMap as MapCanvas, type MapMarker } from './SchematicMap';
