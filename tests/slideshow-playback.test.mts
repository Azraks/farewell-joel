import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlideshowPlayback, createVideoReadingClock, messageReadingSeconds } from '../src/effects/slideshow-playback.ts';
import { createSlideshowFullscreen } from '../src/effects/slideshow-fullscreen.ts';

function tickFor(clock: ReturnType<typeof createVideoReadingClock>, seconds: number, playing: boolean, ended: boolean, paused = false) {
  let state = clock.tick(0, paused, playing, ended);
  for (let second = 0; second < seconds; second++) state = clock.tick(1, paused, playing, ended);
  return state;
}

test('a three-second video holds until six seconds, then gets a separate reading period', () => {
  const clock = createVideoReadingClock(10);
  assert.equal(tickFor(clock, 3, true, false).reading, false);
  assert.equal(tickFor(clock, 2, false, true).reading, false);
  assert.deepEqual(tickFor(clock, 1, false, true), { reading: true, progress: 0, finished: false });
  assert.equal(tickFor(clock, 9, false, true).finished, false);
  assert.equal(tickFor(clock, 1, false, true).finished, true);
});

test('long videos get their full playback and full reading time', () => {
  const clock = createVideoReadingClock(8);
  assert.equal(tickFor(clock, 30, true, false).reading, false);
  assert.equal(clock.tick(0, false, false, true).progress, 0);
  assert.equal(tickFor(clock, 7, false, true).finished, false);
  assert.equal(tickFor(clock, 1, false, true).finished, true);
});

test('blocked playback, buffering and pauses do not consume viewing or reading time', () => {
  const clock = createVideoReadingClock(8);
  assert.equal(tickFor(clock, 100, false, false).reading, false);
  assert.equal(tickFor(clock, 100, true, false, true).reading, false);
  tickFor(clock, 6, true, false);
  clock.tick(0, false, false, true);
  assert.equal(tickFor(clock, 100, false, true, true).progress, 0);
  assert.equal(tickFor(clock, 8, false, true).finished, true);
});

test('replay cancels the previous reading countdown', () => {
  const clock = createVideoReadingClock(8);
  tickFor(clock, 6, true, false);
  clock.tick(0, false, false, true);
  tickFor(clock, 7, false, true);
  clock.replay();
  assert.equal(tickFor(clock, 3, true, false).reading, false);
  assert.equal(tickFor(clock, 3, false, true).progress, 0);
  assert.equal(tickFor(clock, 8, false, true).finished, true);
});

test('reading time grows with the message rather than capping long notes', () => {
  assert.equal(messageReadingSeconds('Hi'), 8);
  assert.ok(messageReadingSeconds('a'.repeat(1500)) > messageReadingSeconds('a'.repeat(500)));
});

function fakeVideo() {
  return {
    paused: true, ended: false, plays: 0, pauses: 0,
    async play() { this.plays++; this.paused = false; },
    pause() { this.pauses++; this.paused = true; },
  };
}

const flush = () => new Promise<void>(resolve => queueMicrotask(resolve));

test('background suspension resumes a player that was playing', async () => {
  const video = fakeVideo();
  const playback = createSlideshowPlayback(video, () => assert.fail('playback should succeed'));
  playback.setSuspended(false);
  await flush();
  assert.equal(video.plays, 1);
  playback.setSuspended(true);
  assert.equal(video.paused, true);
  playback.setSuspended(false);
  await flush();
  assert.equal(video.plays, 2);
  playback.dispose();
});

test('a native manual pause stays paused after changing tabs; explicit Resume can restart it', async () => {
  const video = fakeVideo();
  const playback = createSlideshowPlayback(video, () => assert.fail('unexpected rejection'));
  playback.setSuspended(false);
  await flush();
  video.pause();
  playback.setSuspended(true);
  playback.setSuspended(false);
  await flush();
  assert.equal(video.plays, 1);
  assert.equal(video.paused, true);
  playback.requestPlay();
  await flush();
  assert.equal(video.plays, 2);
});

test('closing before play resolves cannot leave a video playing', async () => {
  let resolvePlay!: () => void;
  const video = fakeVideo();
  video.play = () => new Promise<void>(resolve => {
    resolvePlay = () => { video.paused = false; resolve(); };
  });
  const playback = createSlideshowPlayback(video, () => assert.fail('unexpected rejection'));
  playback.setSuspended(false);
  playback.dispose();
  resolvePlay();
  await flush();
  assert.equal(video.paused, true);
});

test('blocked autoplay is reported without advancing playback', async () => {
  const video = fakeVideo();
  let blocked = 0;
  video.play = async () => { throw new Error('Autoplay denied'); };
  const playback = createSlideshowPlayback(video, () => blocked++);
  playback.setSuspended(false);
  await flush();
  assert.equal(blocked, 1);
  assert.equal(video.paused, true);
});

test('a pending fullscreen exit is serialized before a rapid reopen', async () => {
  let current = false;
  let resolveExit!: () => void;
  let unexpectedClose = 0;
  let entries = 0;
  const fullscreen = createSlideshowFullscreen({
    isFullscreen: () => current,
    isSlideshowFullscreen: () => current,
    enter: async () => { current = true; entries++; },
    exit: () => new Promise<void>(resolve => { resolveExit = () => { current = false; resolve(); }; }),
  }, () => unexpectedClose++);
  await fullscreen.open();
  const closing = fullscreen.close();
  await flush();
  const reopening = fullscreen.open();
  resolveExit();
  fullscreen.changed();
  await closing;
  await reopening;
  fullscreen.changed();
  assert.equal(current, true);
  assert.equal(entries, 2);
  assert.equal(unexpectedClose, 0);
});

test('Escape from an owned fullscreen session closes the show once', async () => {
  let current = false;
  let closes = 0;
  const fullscreen = createSlideshowFullscreen({
    isFullscreen: () => current, isSlideshowFullscreen: () => current,
    enter: async () => { current = true; }, exit: async () => { current = false; },
  }, () => closes++);
  await fullscreen.open();
  current = false;
  fullscreen.changed();
  fullscreen.changed();
  assert.equal(closes, 1);
});

test('denied fullscreen and fullscreen owned by another view do not break the overlay', async () => {
  let exits = 0;
  const denied = createSlideshowFullscreen({
    isFullscreen: () => false, isSlideshowFullscreen: () => false,
    enter: async () => { throw new Error('Denied'); }, exit: async () => { exits++; },
  }, () => assert.fail('must not close'));
  await denied.open();
  denied.changed();
  await denied.close();
  const existing = createSlideshowFullscreen({
    isFullscreen: () => true, isSlideshowFullscreen: () => false,
    enter: async () => assert.fail('must not request fullscreen'), exit: async () => { exits++; },
  }, () => assert.fail('must not close'));
  await existing.open();
  await existing.close();
  assert.equal(exits, 0);
});
