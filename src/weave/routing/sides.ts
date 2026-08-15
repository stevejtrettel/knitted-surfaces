/**
 * Over/under assignment — which strand is on top at each crossing.
 *
 * The old rule read the face 2-colouring: in face f, family `faceColors[f]` goes
 * over and the other under. That is exact when the face dual is bipartite, but
 * `colorFaces` falls back to a best-effort colouring elsewhere (odd wrap counts,
 * non-orientable seams, hyperbolic tilings with the wrong valences), and its
 * defects arrive in BANDS — a whole run of faces sharing a colour, which reads as
 * a visible stripe of same-side crossings across the fabric.
 *
 * Here the alternation is walked along each strand instead, which is where the
 * eye actually looks: over, under, over, under as the thread travels. Two rules
 * govern it, and their order of precedence matters:
 *
 *  1. At a crossing the two strands must be on OPPOSITE sides. This one is hard —
 *     breaking it doesn't look wrong, it looks broken, because the two tubes then
 *     occupy the same place.
 *  2. Along a thread the side should alternate. This one is soft, and where the
 *     two collide it is the one that gives way.
 *
 * The result is that defects land as isolated stitches rather than lines: each is
 * confined to the one face where two already-committed strands disagree, and the
 * alternation re-phases immediately after it.
 *
 * Strands are visited breadth-first through the crossings, not in list order.
 * That is what makes the whole thing work: a strand processed before any of its
 * neighbours has nothing to phase against and starts arbitrarily, so on a plain
 * grid every row would start "over" and every column would then be forced under
 * at all six crossings — alternation destroyed everywhere. Reached through the
 * fabric instead, each new strand arrives already constrained by a neighbour and
 * simply continues the checkerboard. A strand's phase is likewise taken from its
 * first CONSTRAINED segment rather than its first segment.
 *
 * Only meaningful for tiles where a face carries at most one arc per family (the
 * thread tiles). Corner weaves put three same-family arcs in a face and derive
 * their handedness from the cell itself, so they read `faceColors` instead.
 */

import type { Strand } from '../types.ts';

/**
 * Fill in `segment.side` for every strand. Returns the number of crossings where
 * alternation had to be broken to keep an over/under pair consistent.
 */
export function assignSides(strands: Strand[]): number {
  // (face, family) → the side that strand took through that face.
  const taken = new Map<number, 1 | -1>();
  const key = (face: number, family: number) => face * 4 + family;

  // Which strands meet in each face, so we can walk the fabric rather than the
  // strand list.
  const inFace = new Map<number, number[]>();
  for (let i = 0; i < strands.length; i++) {
    for (const seg of strands[i].segments) {
      const list = inFace.get(seg.face.index);
      if (list) { if (!list.includes(i)) list.push(i); } else inFace.set(seg.face.index, [i]);
    }
  }

  /** The side this face already forces on `family`, or null if it is free. */
  const forcedAt = (face: number, family: number): 1 | -1 | null => {
    for (let fam = 0; fam < 3; fam++) {
      if (fam === family) continue;
      const other = taken.get(key(face, fam));
      if (other !== undefined) return other === 1 ? -1 : 1;
    }
    return null;
  };

  let defects = 0;

  const assign = (index: number): void => {
    const strand = strands[index];
    const segs = strand.segments;
    if (segs.length === 0) return;

    const forced = segs.map((seg) => forcedAt(seg.face.index, strand.family));

    // Phase the alternation on the first segment that is already pinned, so the
    // free run before it lands in step with the fabric rather than against it.
    const anchor = forced.findIndex((f) => f !== null);
    const anchorSide: 1 | -1 = anchor >= 0 ? forced[anchor]! : 1;
    const anchorAt = anchor >= 0 ? anchor : 0;

    let prev: 1 | -1 | null = null;
    for (let i = 0; i < segs.length; i++) {
      const phased: 1 | -1 = (i - anchorAt) % 2 === 0 ? anchorSide : (anchorSide === 1 ? -1 : 1);
      const wanted: 1 | -1 = prev === null ? phased : (prev === 1 ? -1 : 1);
      const side: 1 | -1 = forced[i] ?? wanted;
      if (forced[i] !== null && forced[i] !== wanted && prev !== null) defects++;

      segs[i].side = side;
      taken.set(key(segs[i].face.index, strand.family), side);
      prev = side;
    }

    // A closed strand of odd length cannot alternate all the way round; its seam
    // is one unavoidable defect.
    if (strand.closed && segs.length % 2 === 1 && segs.length > 1) defects++;
  };

  const done = new Uint8Array(strands.length);
  const seeds = strands
    .map((_, i) => i)
    .sort((a, b) => strands[b].segments.length - strands[a].segments.length);

  for (const seed of seeds) {
    if (done[seed]) continue;
    const queue = [seed];
    done[seed] = 1;
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head];
      assign(index);
      for (const seg of strands[index].segments) {
        for (const neighbour of inFace.get(seg.face.index) ?? []) {
          if (done[neighbour]) continue;
          done[neighbour] = 1;
          queue.push(neighbour);
        }
      }
    }
  }

  return defects;
}
