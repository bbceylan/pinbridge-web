/**
 * Place matching services
 */

export { PlaceMatchingService } from './place-matching';
export type {
  PlaceMatchQuery,
  MatchingOptions,
  MatchingWeights,
  MatchFactor,
  PlaceMatch,
  MatchingResult,
} from './place-matching';

export {
  NameNormalizer,
  AddressNormalizer,
  CoordinateValidator,
  CategoryMapper,
  PlaceNormalizer,
} from './place-normalization';
export type {
  NormalizedPlaceData,
  AddressComponents,
  CoordinateValidation,
  TextCleaningOptions,
} from './place-normalization';