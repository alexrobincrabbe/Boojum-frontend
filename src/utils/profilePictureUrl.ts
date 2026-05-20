/** Known-good fallback when /images/default.png is missing in public/. */
export const FALLBACK_PROFILE_IMAGE =
  'https://res.cloudinary.com/df8lhl810/image/upload/v1748970766/apple-touch-icon_ava8x5.png';

export const DEFAULT_PROFILE_IMAGE = '/images/default.png';

function isPlaceholderProfileUrl(url: string | null | undefined): boolean {
  if (!url || !String(url).trim()) {
    return true;
  }
  const lower = String(url).toLowerCase();
  return lower.includes('placeholder') || lower.endsWith('/default.png');
}

/**
 * Resolve a profile picture URL for <img src>, with optional Cloudinary resize.
 */
export function resolveProfilePictureUrl(
  url: string | null | undefined,
  size = 30
): string {
  if (isPlaceholderProfileUrl(url)) {
    return DEFAULT_PROFILE_IMAGE;
  }

  const raw = String(url).trim();

  if (raw.includes('cloudinary.com') && raw.includes('upload/')) {
    if (
      raw.includes('q_auto') ||
      raw.includes('w_') ||
      raw.includes('c_') ||
      raw.includes('g_') ||
      raw.includes('r_')
    ) {
      const parts = raw.split('/');
      const uploadIndex = parts.findIndex((part) => part === 'upload');
      if (uploadIndex !== -1) {
        let publicId = parts[parts.length - 1];
        publicId = publicId.split('.')[0];
        return `https://res.cloudinary.com/df8lhl810/image/upload/q_auto,w_${size},h_${size},c_fill,g_face/r_100/${publicId}`;
      }
    }

    const parts = raw.split('/');
    const uploadIndex = parts.findIndex((part) => part === 'upload');
    if (uploadIndex !== -1 && uploadIndex < parts.length - 1) {
      let publicId = parts[uploadIndex + 1];
      if (publicId.startsWith('v') && uploadIndex + 2 < parts.length) {
        publicId = parts[uploadIndex + 2];
      }
      publicId = publicId.split('.')[0];
      if (isPlaceholderProfileUrl(publicId)) {
        return DEFAULT_PROFILE_IMAGE;
      }
      return `https://res.cloudinary.com/df8lhl810/image/upload/q_auto,w_${size},h_${size},c_fill,g_face/r_100/${publicId}`;
    }
  }

  return raw;
}
