/**
 * A drawn map, for when there is no real one to show.
 *
 * Two callers. The web build has no MapLibre Native at all, and on a device
 * this takes over when the tile server cannot be reached. Both of those used
 * to be a blank grey rectangle, which reads as a broken app rather than as a
 * map that could not load, and is what shipped once already.
 *
 * Marker positions are honest: latitude and longitude are projected into the
 * view with the same region maths the real map uses, so a pin that looks
 * north-east here is north-east on the device too. The roads and parks
 * underneath are decoration and are not claimed to be otherwise.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { segmentsOf, thin } from '../lib/route';
import { radii, shadows, type ToneName } from '../theme/tokens';
import { makeStyles, useTheme } from '../theme/ThemeProvider';

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

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  region: Region;
  markers: MapMarker[];
  onSelectMarker?: (id: string) => void;
  /** The same route the real map draws, so the fallback loses nothing. */
  route?: { lat: number; lng: number }[];
  style?: StyleProp<ViewStyle>;
};

/** Thick enough to read against the drawn roads underneath. */
const ROUTE_WIDTH = 5;

export function SchematicMap({ region, markers, onSelectMarker, route, style }: Props) {
  const styles = useStyles();
  const { colors, tones } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  /** Equirectangular projection — accurate enough across a few kilometres. */
  const project = (lat: number, lng: number) => {
    const x =
      ((lng - (region.longitude - region.longitudeDelta / 2)) / region.longitudeDelta) *
      size.width;
    // Latitude increases northward, screen y increases downward.
    const y =
      ((region.latitude + region.latitudeDelta / 2 - lat) / region.latitudeDelta) * size.height;
    return { x, y };
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.canvas, style]} onLayout={onLayout}>
      <MapDecor />

      {/*
        * The route, as straight bars between its points.
        *
        * Real geometry drawn without a renderer: each pair of consecutive
        * points becomes one bar, positioned at the midpoint and rotated to
        * face the next point — React Native rotates about the centre, so the
        * midpoint is the placement that needs no transform origin.
        *
        * Thinned first. A polyline is hundreds of coordinates, and hundreds
        * of views to draw one line is not a trade worth making at this size.
        */}
      {size.width > 0 && route && route.length > 1
        ? segmentsOf(thin(route, 60)).map(([from, to], i) => {
            const a = project(from.lat, from.lng);
            const b = project(to.lat, to.lng);
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            if (!Number.isFinite(length) || length < 0.5) return null;
            return (
              <View
                key={`route-${i}`}
                pointerEvents="none"
                style={[
                  styles.routeSegment,
                  {
                    left: (a.x + b.x) / 2 - length / 2,
                    top: (a.y + b.y) / 2 - ROUTE_WIDTH / 2,
                    width: length,
                    transform: [{ rotateZ: `${Math.atan2(b.y - a.y, b.x - a.x)}rad` }],
                  },
                ]}
              />
            );
          })
        : null}

      {size.width > 0
        ? markers.map((marker) => {
            const { x, y } = project(marker.lat, marker.lng);
            const pinSize = marker.selected ? 44 : 34;
            return (
              <Pressable
                key={marker.id}
                onPress={onSelectMarker ? () => onSelectMarker(marker.id) : undefined}
                // Not a button when nothing is listening. The listing screen
                // wraps this whole map in one, and a button inside a button is
                // invalid on the web build and ambiguous to a screen reader.
                accessibilityRole={onSelectMarker ? 'button' : 'none'}
                accessibilityLabel={marker.label}
                style={[
                  styles.markerWrap,
                  { left: x - pinSize / 2, top: y - pinSize / 2 },
                  marker.selected && styles.markerWrapSelected,
                ]}
              >
                <View
                  style={[
                    styles.pin,
                    {
                      width: pinSize,
                      height: pinSize,
                      backgroundColor: tones[marker.tone].fg,
                    },
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
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

/** Roads, a park and a lake, so the surface reads as a map rather than paper. */
function MapDecor() {
  const styles = useStyles();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.water, { top: '6%', left: '52%' }]} />
      <View style={[styles.park, { top: '58%', left: '-8%' }]} />
      <View style={[styles.park, { top: '10%', left: '4%', width: 120, height: 90 }]} />

      <View style={[styles.road, { top: '22%', left: '-10%', width: '130%', height: 14 }]} />
      <View
        style={[
          styles.road,
          { top: '54%', left: '-20%', width: '150%', height: 11, transform: [{ rotate: '-8deg' }] },
        ]}
      />
      <View style={[styles.road, { top: '-10%', left: '30%', width: 12, height: '130%' }]} />
      <View
        style={[
          styles.road,
          { top: '-10%', left: '72%', width: 9, height: '130%', transform: [{ rotate: '6deg' }] },
        ]}
      />
      <View
        style={[
          styles.roadMajor,
          { top: '78%', left: '-15%', width: '140%', height: 16, transform: [{ rotate: '4deg' }] },
        ]}
      />

      {/*
        * No street or area names.
        *
        * These roads are decoration — they are not anywhere. Labelling them
        * "Waiyaki Way" and "WESTLANDS", which this used to do, turns a
        * neutral backdrop into a claim about geography that is simply false,
        * and somebody reading a shop's position off it would be misled. The
        * pins are honest, because they are projected from real coordinates.
        * Everything behind them is texture and is now left unnamed.
        */}
    </View>
  );
}

const useStyles = makeStyles((colors, tones) => ({
  canvas: {
    backgroundColor: colors.mapLand,
    overflow: 'hidden',
  },
  routeSegment: {
    position: 'absolute',
    height: ROUTE_WIDTH,
    borderRadius: ROUTE_WIDTH / 2,
    backgroundColor: colors.accent,
  },
  water: {
    position: 'absolute',
    width: 190,
    height: 130,
    borderRadius: 80,
    backgroundColor: colors.mapWater,
    transform: [{ rotate: '-18deg' }],
  },
  park: {
    position: 'absolute',
    width: 170,
    height: 120,
    borderRadius: 46,
    backgroundColor: colors.mapPark,
  },
  road: {
    position: 'absolute',
    backgroundColor: colors.mapRoad,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.mapRoadCasing,
  },
  roadMajor: {
    position: 'absolute',
    backgroundColor: colors.paperLand,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.paperPark,
  },
  streetLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
    color: colors.paperInk,
  },
  areaLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.paperInkSoft,
  },
  markerWrap: { position: 'absolute', alignItems: 'center' },
  markerWrapSelected: { zIndex: 10 },
  pin: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.surface,
    ...shadows.card,
  },
  pinSelected: { backgroundColor: colors.textPrimary },
  pinLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
}));
