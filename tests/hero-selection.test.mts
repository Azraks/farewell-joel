import assert from 'node:assert/strict';
import test from 'node:test';
import { selectHeroPhotos } from '../src/lib/hero-selection.ts';

const photos = Array.from({ length: 20 }, (_, index) => ({
  path: `../assets/hero/Image${String(index + 1).padStart(2, '0')}.jpeg`,
  video: false,
}));

test('each rotation has eight unique photos with Image01 first, regardless of input order', () => {
  const input = [...photos.slice(1), photos[0]!];
  const snapshot = [...input];
  for (const random of [() => 0, () => 0.5, () => 0.999]) {
    const rotation = selectHeroPhotos(input, random);
    assert.equal(rotation.length, 8);
    assert.equal(rotation[0], photos[0]);
    assert.equal(new Set(rotation).size, 8);
    assert.ok(rotation.every(photo => input.includes(photo)));
  }
  assert.deepEqual(input, snapshot);
  assert.notDeepEqual(selectHeroPhotos(input, () => 0), selectHeroPhotos(input, () => 0.999));
});

test('small, empty and missing-cover collections work without duplicates or videos', () => {
  assert.deepEqual(selectHeroPhotos([]), []);
  assert.deepEqual(selectHeroPhotos([photos[0]!]), [photos[0]]);
  assert.equal(selectHeroPhotos(photos.slice(0, 4)).length, 4);
  const withoutCover = selectHeroPhotos(photos.slice(1), () => 0);
  assert.equal(withoutCover.length, 8);
  assert.equal(new Set(withoutCover).size, 8);
  assert.deepEqual(selectHeroPhotos([{ path: '../assets/hero/movie.mp4', video: true }]), []);
});
