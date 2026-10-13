// This curated collection is independent of visitor submissions.
const assets = import.meta.glob<string>('../assets/hero/*', {
  eager: true,
  query: '?url',
  import: 'default',
});
export const heroMedia = Object.entries(assets)
  .filter(([path]) => /\.(png|jpe?g|webp|mov|mp4|webm)$/i.test(path))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({ url, video: /\.(mov|mp4|webm)$/i.test(path) }));

