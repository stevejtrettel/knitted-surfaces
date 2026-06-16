/**
 * Shared surface-of-revolution profiles.
 *
 * A small registry of named profile curves reused across demos. Each entry
 * pairs a `Profile` (t ∈ [0,1] → {r, y}) with whether the profile is closed
 * (wraps, e.g. a torus). Feed into `makeRevolutionMesh(profile, nTheta, nT, closed)`.
 */

import type { Profile } from './revolution.ts';

export interface ShapeProfile {
  label: string;
  fn: Profile;
  closed: boolean;
}

export const profiles: Record<string, ShapeProfile> = {
  Torus: {
    label: 'Torus',
    fn: (t) => {
      const a = t * 2 * Math.PI;
      return { r: 1.5 + 0.7 * Math.cos(a), y: 0.7 * Math.sin(a) };
    },
    closed: true,
  },
  Blob: {
    label: 'Blob',
    fn: (t) => {
      const a = t * 2 * Math.PI;
      const r = Math.cos(a) + 0.2 * Math.sin(7 * a);
      const y = 2 * Math.sin(a) + 0.2 * Math.cos(5 * a);
      return { r: 1.5 + r, y };
    },
    closed: true,
  },
  Vase: {
    label: 'Vase',
    fn: (t) => {
      const y = t * 4 - 2;
      const r = 0.6 + 0.4 * Math.cos(y * 1.2) + 0.15 * Math.sin(y * 3);
      return { r, y };
    },
    closed: false,
  },
  Sphere: {
    label: 'Sphere',
    fn: (t) => {
      const a = t * Math.PI;
      return { r: 1.2 * Math.sin(a), y: 1.2 * Math.cos(a) };
    },
    closed: false,
  },
  Hourglass: {
    label: 'Hourglass',
    fn: (t) => {
      const y = t * 3 - 1.5;
      const r = 0.3 + 0.8 * Math.abs(Math.sin(y * 1.2));
      return { r, y };
    },
    closed: false,
  },
};

/** Profile keys in display order. */
export const profileNames = Object.keys(profiles);
