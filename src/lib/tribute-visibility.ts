/** Written notes and photo submissions belong in message views. */
export function hasWallContent(tribute: { message: string; photo_paths?: string[] }): boolean {
  return Boolean(tribute.message.trim() || tribute.photo_paths?.length);
}
