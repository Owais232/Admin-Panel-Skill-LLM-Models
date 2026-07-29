import { Transform } from 'class-transformer';

/**
 * Coerces the string forms of booleans that arrive on a query string.
 *
 * Required because `?isBlocked=false` arrives as the *string* `'false'`, which
 * is truthy. Anything that is neither a boolean nor `'true'`/`'false'` is left
 * untouched so `@IsBoolean()` can reject it with a proper 400.
 */
export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  });

/** Trims a string query/body value, mapping blank strings to `undefined`. */
export const ToTrimmedString = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  });
