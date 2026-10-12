import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';
import { IANAZone } from 'luxon';

export function IsIanaTimezone(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isIanaTimezone',
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && IANAZone.isValidZone(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a valid IANA timezone`,
          options,
        ),
      },
    },
    options,
  );
}
