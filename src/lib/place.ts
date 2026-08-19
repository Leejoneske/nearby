/**
 * Turning a reverse-geocode result into the two fields a listing form has.
 *
 * The provider hands back a bag of administrative names at wildly different
 * scales — a street, an estate, a ward, a sub-county, a county — and which
 * ones are filled in depends entirely on how well mapped that spot is. Taking
 * whichever field happens to be present is how a shop on a named road ended
 * up filed under a sub-county, which is an area you could drive across for
 * half an hour.
 *
 * So both fields are chosen by specificity, from the narrowest thing the
 * provider knew to the widest, and each one refuses to repeat what the other
 * already said.
 */

/** The subset of Expo's `LocationGeocodedAddress` worth reading. */
export type GeocodedPlace = {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
};

const clean = (value: string | null | undefined): string => (value ?? '').trim();

/** A field that is only a number is a house number, not a place. */
const isJustDigits = (value: string): boolean => /^[\d\s-]+$/.test(value);

/**
 * The street line: "12 Othaya Road", or the best thing standing in for one.
 *
 * `name` is deliberately second. On Android it is often the house number on
 * its own, and on iOS it is sometimes the building or business name — useful
 * when there is no street, misleading when there is.
 */
export function streetLine(place: GeocodedPlace): string {
  const street = clean(place.street);
  const number = clean(place.streetNumber);

  if (street) return number && !street.startsWith(number) ? `${number} ${street}` : street;

  const name = clean(place.name);
  if (name && !isJustDigits(name)) return name;

  /*
   * Last resort: the provider's own one-line address, minus the tail.
   *
   * A formatted address ends with the country and usually the region, which
   * would put "Kenya" in a field meant for a street. Two segments is the
   * street and the thing immediately around it.
   */
  const formatted = clean(place.formattedAddress);
  if (formatted) {
    const head = formatted.split(',').slice(0, 2).map((part) => part.trim()).filter(Boolean);
    if (head.length > 0) return head.join(', ');
  }

  return '';
}

/**
 * The neighbourhood: the narrowest named area, paired with its town.
 *
 * `subregion` is the sub-county, and it is last on purpose — it is the field
 * that was being used, and it is the reason a listing said "Othaya" when it
 * meant a specific road in it. It is still better than nothing when a place
 * has no finer name recorded.
 */
export function areaLine(place: GeocodedPlace, fallbackCity = ''): string {
  const city = clean(place.city) || clean(place.subregion) || clean(place.region) || fallbackCity;

  const neighbourhood = [clean(place.district), clean(place.subregion)].find(
    (candidate) => candidate && candidate !== city,
  );

  if (neighbourhood) return `${neighbourhood}, ${city}`;
  return city;
}

/**
 * Both fields at once, with the second never echoing the first.
 *
 * "Othaya Road, Othaya, Nyeri" in the address and "Othaya, Nyeri" in the area
 * is correct but reads as a mistake, so a neighbourhood already named in the
 * street line is dropped from the area rather than repeated.
 */
export function describeAddress(
  place: GeocodedPlace | undefined,
  fallbackCity = '',
): { address: string; area: string } {
  if (!place) return { address: '', area: fallbackCity };

  const address = streetLine(place);
  const area = areaLine(place, fallbackCity);

  return { address, area };
}

/**
 * Whether a fix is precise enough to put on a map without a warning.
 *
 * Anything past about fifty metres is a different building, and past two
 * hundred it is a different block. The person listing is standing outside
 * their own shop, so a bad fix is worth saying out loud rather than saving
 * quietly and sending customers to the wrong side of the road.
 */
export const GOOD_ACCURACY_M = 50;
export const POOR_ACCURACY_M = 200;

export function accuracyNote(accuracyM: number | undefined): string | null {
  if (accuracyM === undefined) return null;
  if (accuracyM <= GOOD_ACCURACY_M) return null;
  if (accuracyM <= POOR_ACCURACY_M) {
    return `This fix is only accurate to about ${accuracyM} m. Check the address before you save.`;
  }
  return `This fix is off by about ${accuracyM} m, which is more than a block. Try again outside, or type the address yourself.`;
}
