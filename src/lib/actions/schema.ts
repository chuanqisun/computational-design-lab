import type { JSONSchema } from "./types";

/** Minimal JSON Schema validator for the subset used by action declarations. Returns error messages. */
export function validateSchema(value: unknown, schema: JSONSchema, path = "args"): string[] {
  const errors: string[] = [];

  if (schema.enum && !schema.enum.includes(value as string | number)) {
    errors.push(`${path} must be one of ${schema.enum.join(", ")}`);
    return errors;
  }

  switch (schema.type) {
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return [`${path} must be an object`];
      }
      const record = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        if (record[key] === undefined) errors.push(`${path}.${key} is required`);
      }
      for (const [key, child] of Object.entries(record)) {
        if (child === undefined) continue;
        const childSchema = schema.properties?.[key];
        if (!childSchema) {
          errors.push(`${path}.${key} is not a known parameter`);
          continue;
        }
        errors.push(...validateSchema(child, childSchema, `${path}.${key}`));
      }
      break;
    }
    case "string":
      if (typeof value !== "string") errors.push(`${path} must be a string`);
      break;
    case "number":
    case "integer":
      if (typeof value !== "number" || Number.isNaN(value)) {
        errors.push(`${path} must be a number`);
      } else {
        if (schema.type === "integer" && !Number.isInteger(value)) errors.push(`${path} must be an integer`);
        if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} must be >= ${schema.minimum}`);
        if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} must be <= ${schema.maximum}`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") errors.push(`${path} must be a boolean`);
      break;
    case "array":
      if (!Array.isArray(value)) {
        errors.push(`${path} must be an array`);
      } else {
        if (schema.minItems !== undefined && value.length < schema.minItems)
          errors.push(`${path} must have at least ${schema.minItems} items`);
        if (schema.maxItems !== undefined && value.length > schema.maxItems)
          errors.push(`${path} must have at most ${schema.maxItems} items`);
        if (schema.items) value.forEach((entry, index) => errors.push(...validateSchema(entry, schema.items!, `${path}[${index}]`)));
      }
      break;
  }

  return errors;
}

/** Checks a schema is a well-formed declaration (used by registry tests). */
export function isWellFormedSchema(schema: JSONSchema): boolean {
  const validTypes = ["object", "string", "number", "integer", "boolean", "array"];
  if (schema.type && !validTypes.includes(schema.type)) return false;
  if (schema.type === "object") {
    if (!schema.properties) return false;
    for (const key of schema.required ?? []) if (!(key in schema.properties)) return false;
    return Object.values(schema.properties).every(isWellFormedSchema);
  }
  if (schema.type === "array") return !!schema.items && isWellFormedSchema(schema.items);
  return true;
}
