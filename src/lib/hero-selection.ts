interface HeroPhoto {
  path: string;
  video: boolean;
}

// Keep one selection for the page lifetime; the photo viewer still uses the full collection.
export function selectHeroPhotos<T extends HeroPhoto>(items: readonly T[], random = Math.random): T[] {
  const photos = items.filter(item => !item.video);
  const first = photos.find(item => /\/Image01\.(jpe?g|png|webp)$/i.test(item.path));
  const remaining = photos.filter(item => item !== first);

  for (let index = remaining.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex]!, remaining[index]!];
  }

  return first ? [first, ...remaining.slice(0, 7)] : remaining.slice(0, 8);
}
