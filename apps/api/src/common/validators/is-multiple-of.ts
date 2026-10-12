import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';

export function IsMultipleOf(
  step: number,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isMultipleOf',
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'number' && value % step === 0,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a multiple of ${step}`,
          options,
        ),
      },
    },
    options,
  );
}
