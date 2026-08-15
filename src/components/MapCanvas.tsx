/**
 * Native map. Google Maps on Android, Apple Maps on iOS, via react-native-maps.
 *
 * The web build resolves MapCanvas.web.tsx instead — react-native-maps has no
 * web implementation, and a business directory has to render something on the
 * web preview rather than crash.
 */
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, shadows } from '../theme/tokens';
import { MAP_STYLE } from '../theme/mapStyle';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  icon: string;
  selected?: boolean;
};

type Props = {
  region: Region;
  markers: MapMarker[];
  onSelectMarker?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function MapCanvas({ region, markers, onSelectMarker, style }: Props) {
  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={[StyleSheet.absoluteFill, style]}
      initialRegion={region}
      customMapStyle={MAP_STYLE}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
    >
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{ latitude: marker.lat, longitude: marker.lng }}
          onPress={() => onSelectMarker?.(marker.id)}
          tracksViewChanges={false}
        >
          <View style={[styles.pin, marker.selected && styles.pinSelected]}>
            <Ionicons
              name={marker.icon as never}
              size={marker.selected ? 18 : 15}
              color={colors.textOnAccent}
            />
          </View>
          {marker.selected ? (
            <Text style={styles.pinLabel} numberOfLines={1}>
              {marker.label}
            </Text>
          ) : null}
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.surface,
    ...shadows.card,
  },
  pinSelected: {
    width: 44,
    height: 44,
    backgroundColor: colors.textPrimary,
  },
  pinLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
