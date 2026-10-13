import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';

/** ISO-8601 date-time with an explicit offset or Z, so the server never guesses the zone. */
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function isValidInstant(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    INSTANT_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

export function IsInstant(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isInstant',
      validator: {
        validate: (value: unknown): boolean => isValidInstant(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be an ISO-8601 instant with a zone, e.g. 2030-01-07T09:00:00Z`,
          options,
        ),
      },
    },
    options,
  );
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A business-local day (YYYY-MM-DD) or a full instant, used for range filters. */
export function IsDayOrInstant(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDayOrInstant',
      validator: {
        validate: (value: unknown): boolean =>
          (typeof value === 'string' && DAY_PATTERN.test(value)) ||
          isValidInstant(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be YYYY-MM-DD or an ISO-8601 instant with a zone`,
          options,
        ),
      },
    },
    options,
  );
}
