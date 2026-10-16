interface VideoPlayer {
  readonly paused: boolean;
  readonly ended: boolean;
  pause: () => void;
  play: () => Promise<void>;
}

/** Suspend only playback we own, preserving a pause made through native controls. */
export function createSlideshowPlayback(video: VideoPlayer, onBlocked: () => void) {
  let suspended = true;
  let resumeRequested = true;
  let playPending = false;
  let disposed = false;

  async function play() {
    if (disposed || suspended || video.ended || playPending) return;
    playPending = true;
    try {
      await video.play();
      if (disposed || suspended) video.pause();
    } catch {
      if (!disposed && !suspended) onBlocked();
    } finally {
      playPending = false;
    }
  }

  return {
    setSuspended(value: boolean) {
      if (disposed || value === suspended) return;
      if (value) {
        resumeRequested = (!video.paused && !video.ended) || playPending;
        suspended = true;
        video.pause();
      } else {
        suspended = false;
        if (resumeRequested) void play();
      }
    },
    requestPlay() {
      resumeRequested = true;
      if (!suspended) void play();
    },
    dispose() {
      disposed = true;
      video.pause();
    },
  };
}

export function messageReadingSeconds(message: string) {
  return Math.max(8, 6 + message.length * 0.045);
}

/** Only visible, unpaused viewing time counts toward the six-second video minimum. */
export function createVideoReadingClock(readingSeconds: number) {
  let phase: 'video' | 'reading' = 'video';
  let viewingSeconds = 0;
  let readingElapsed = 0;

  return {
    replay() {
      if (phase !== 'reading') return;
      phase = 'video';
      viewingSeconds = 0;
      readingElapsed = 0;
    },
    tick(seconds: number, paused: boolean, playing: boolean, ended: boolean) {
      if (!paused) {
        if (phase === 'video') {
          if (playing || ended) viewingSeconds += seconds;
          if (ended && viewingSeconds >= 6) phase = 'reading';
        } else {
          readingElapsed += seconds;
        }
      }
      return {
        reading: phase === 'reading',
        progress: phase === 'reading' ? Math.min(1, readingElapsed / readingSeconds) : 0,
        finished: phase === 'reading' && readingElapsed >= readingSeconds,
      };
    },
  };
}
