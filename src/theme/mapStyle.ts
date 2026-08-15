/**
 * Google Maps styling for the native map, tuned to the app's neutrals so the
 * map does not fight the orange pins. Applied through MapView#customMapStyle,
 * which Apple Maps ignores — iOS keeps its default rendering.
 */
import { colors } from './tokens';

/** Not `as const` — react-native-maps takes a mutable MapStyleElement[]. */
export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: colors.mapLand }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7A7468' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.mapLand }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#DDD6C8' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: colors.mapPark }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: colors.mapRoad }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: colors.mapRoadCasing }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#F7E7C8' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: colors.mapWater }],
  },
];
