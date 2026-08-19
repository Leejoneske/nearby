/**
 * The map, drawn by MapLibre against OpenFreeMap's tiles.
 *
 * There is no API key and no billing account behind this, which is the whole
 * reason for it. Google's Maps SDK needs a key tied to a card, and a card
 * that is declined leaves the app rendering a blank grey rectangle with a
 * watermark — an outcome indistinguishable from a broken app, and one that
 * already shipped once.
 *
 * OpenFreeMap serves the vector tiles and the style, free and without a key,
 * from OpenStreetMap data. MapLibre is the renderer. The trade is that this
 * needs a native build rather than Expo Go, which the project already does.
 *
 * The web build resolves MapCanvas.web.tsx instead: this library is native
 * only, and a business directory has to render something in a browser rather
 * than crash.
 */
import { Ionicons } from '@expo/vector-icons';
import { Camera, Map, Marker, UserLocation } from '@maplibre/maplibre-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii, shadows, type ToneName } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';
import { SchematicMap } from './SchematicMap';

/**
 * OpenFreeMap's Liberty style. No key, no account, no request quota.
 *
 * `liberty` rather than `bright` or `positron`: it keeps road classes and
 * place labels legible at the zoom a directory actually uses, which is street
 * level in one neighbourhood.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Roughly the zoom that shows a neighbourhood, from the old region delta. */
function zoomFor(latitudeDelta: number): number {
  if (!latitudeDelta || latitudeDelta <= 0) return 13;
  return Math.min(18, Math.max(3, Math.log2(360 / latitudeDelta)));
}

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  icon: string;
  /** Pin colour, from the listing's category. */
  tone: ToneName;
  selected?: boolean;
};

/** Kept in the shape the screens already pass, so nothing else had to change. */
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  region: Region;
  markers: MapMarker[];
  onSelectMarker?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function MapCanvas({ region, markers, onSelectMarker, style }: Props) {
  const styles = useStyles();
  const { colors, tones } = useTheme();
  /*
   * A tile server that cannot be reached must not leave a blank rectangle.
   *
   * That is the exact failure this replaced, so it is worth not repeating for
   * a different reason: with no network, or with OpenFreeMap having a bad
   * afternoon, the drawn map takes over. It shows the same pins in the same
   * places and says what it is.
   */
  const where = `${region.latitude},${region.longitude}`;
  const [failedAt, setFailedAt] = useState<string | null>(null);
  const failed = failedAt === where;

  if (failed) {
    return (
      <SchematicMap
        region={region}
        markers={markers}
        onSelectMarker={onSelectMarker}
        style={style}
      />
    );
  }

  return (
    <Map
      style={[StyleSheet.absoluteFill, style]}
      mapStyle={STYLE_URL}
      // OpenStreetMap's licence requires attribution, and MapLibre's button
      // is how it is given. It is not ours to switch off.
      attribution
      logo={false}
      compass={false}
      onDidFailLoadingMap={() => setFailedAt(where)}
    >
      {/*
        * Controlled rather than initial-only, so "centre on my location" and
        * arriving from a listing both move the map. `region` is memoised by
        * the screen and only changes when the selection or the device
        * position does, so panning by hand is not undone by a re-render.
        */}
      <Camera
        center={[region.longitude, region.latitude]}
        zoom={zoomFor(region.latitudeDelta)}
        duration={450}
      />
      <UserLocation />

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          id={marker.id}
          lngLat={[marker.lng, marker.lat]}
          anchor="bottom"
          onPress={() => onSelectMarker?.(marker.id)}
        >
          {/*
            * A selected pin goes near-black rather than keeping its colour:
            * "which one am I looking at" has to beat "what kind is it".
            */}
          <View style={styles.marker}>
            <View
              style={[
                styles.pin,
                { backgroundColor: tones[marker.tone].fg },
                marker.selected && styles.pinSelected,
              ]}
            >
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
          </View>
        </Marker>
      ))}
    </Map>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  marker: { alignItems: 'center' },
  pin: {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
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
    maxWidth: 120,
  },
}));
