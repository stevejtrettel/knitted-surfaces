/**
 * A tunable parameter with its slider range and default — shared UI metadata
 * for both geometry sources and weave patterns. Kept neutral (no geometry or
 * weave dependency) so either layer can carry it.
 */
export interface ParamSpec {
  /** Key in the owner's options object. */
  key: string;
  /** Human-readable slider label. */
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/** Build an options object from a list of parameter defaults. */
export function defaultParams(params: ParamSpec[] | undefined): Record<string, number> {
  const opts: Record<string, number> = {};
  for (const p of params ?? []) opts[p.key] = p.default;
  return opts;
}
