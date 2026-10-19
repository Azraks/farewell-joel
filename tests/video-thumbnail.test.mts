import assert from 'node:assert/strict';
import test from 'node:test';
import { applyVideoThumbnail, captureVideoThumbnail } from '../src/lib/video-thumbnail.ts';

test('a main player receives a poster without replacing it or changing playback', () => {
  const player = {
    tagName: 'VIDEO', poster: '', paused: true, currentTime: 0,
    replaceWith() { assert.fail('The main video must remain in the DOM'); },
    play() { assert.fail('Thumbnail loading must not start playback'); },
    load() { assert.fail('Setting the poster must not reload the player'); },
  };
  applyVideoThumbnail(player as unknown as HTMLElement, 'data:image/jpeg;base64,poster');
  assert.equal(player.poster, 'data:image/jpeg;base64,poster');
  assert.equal(player.paused, true);
  assert.equal(player.currentTime, 0);
});

test('video thumbnails seek into the clip, scale the frame, and release the source', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let failCanvas = false;
  let removed = false;
  let draws = 0;
  const video = {
    duration: 0.6, videoWidth: 1920, videoHeight: 1080, currentTime: 0,
    onloadedmetadata: null as null | (() => void),
    onloadeddata: null as null | (() => void),
    onseeked: null as null | (() => void),
    onerror: null as null | (() => void),
    removeAttribute(name: string) { assert.equal(name, 'src'); removed = true; },
    load() {},
  };
  const canvas = {
    width: 0, height: 0,
    getContext() { return { drawImage() { draws++; } }; },
    toDataURL() {
      if (failCanvas) throw new Error('Cross-origin canvas');
      return 'data:image/jpeg;base64,frame';
    },
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tag: string) { return tag === 'video' ? video : canvas; },
  } });
  try {
    const result = captureVideoThumbnail('https://example.test/clip.mp4');
    video.onloadedmetadata!();
    assert.equal(video.currentTime, 0.3);
    video.onseeked!();
    assert.equal(await result, 'data:image/jpeg;base64,frame');
    assert.deepEqual([canvas.width, canvas.height], [640, 360]);
    assert.equal(draws, 1);
    assert.equal(removed, true);
    assert.equal(video.onseeked, null);

    failCanvas = true;
    const blocked = captureVideoThumbnail('https://example.test/cross-origin.mp4');
    video.onseeked!();
    assert.equal(await blocked, null);

    const unsupported = captureVideoThumbnail('https://example.test/unsupported.mov');
    video.onerror!();
    assert.equal(await unsupported, null);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
