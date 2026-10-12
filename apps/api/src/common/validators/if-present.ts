import { ValidateIf } from 'class-validator';

/**
 * Runs the validators of an optional PATCH field only when the key is sent.
 * Unlike IsOptional, an explicit null is still validated, which keeps
 * non-nullable columns from receiving null.
 */
export function IfPresent(): PropertyDecorator {
  return ValidateIf((_object: object, value: unknown) => value !== undefined);
}
