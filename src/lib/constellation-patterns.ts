import patterns from '../assets/constellations/patterns.json' with { type: 'json' };

// RA/Dec (degrees) and traditional line figures from d3-celestial, BSD-3-Clause.
// Fixed source revision and redistribution notice: assets/constellations/LICENSE.
export interface ConstellationPattern {
  id: string;
  name: string;
  stars: number[][];
  edges: number[][];
}

export const constellationPatterns: readonly ConstellationPattern[] = patterns;

export function chooseConstellation(previousId: string | null, random = Math.random): ConstellationPattern {
  const choices = constellationPatterns.filter(pattern => pattern.id !== previousId);
  return choices[Math.floor(random() * choices.length)]!;
}

/** Gnomonic sky projection: north up, east left, with one scale for both axes. */
export function projectConstellation(pattern: ConstellationPattern) {
  const radians = Math.PI / 180;
  const centreRA = Math.atan2(
    pattern.stars.reduce((sum, [ra]) => sum + Math.sin(ra! * radians), 0),
    pattern.stars.reduce((sum, [ra]) => sum + Math.cos(ra! * radians), 0),
  );
  const centreDec = pattern.stars.reduce((sum, [, dec]) => sum + dec!, 0) / pattern.stars.length * radians;
  const projected = pattern.stars.map(([ra, dec]) => {
    const delta = ra! * radians - centreRA;
    const latitude = dec! * radians;
    const denominator = Math.sin(centreDec) * Math.sin(latitude)
      + Math.cos(centreDec) * Math.cos(latitude) * Math.cos(delta);
    return {
      x: -Math.cos(latitude) * Math.sin(delta) / denominator,
      y: -(Math.cos(centreDec) * Math.sin(latitude)
        - Math.sin(centreDec) * Math.cos(latitude) * Math.cos(delta)) / denominator,
    };
  });
  const xs = projected.map(point => point.x);
  const ys = projected.map(point => point.y);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return projected.map(point => ({ x: (point.x - midX) / extent, y: (point.y - midY) / extent }));
}

export function sampleConstellationTributes<T>(items: readonly T[], count: number, random = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other]!, shuffled[index]!];
  }
  return shuffled.slice(0, count);
}
