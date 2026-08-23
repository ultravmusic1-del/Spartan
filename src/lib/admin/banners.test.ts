import { describe, it, expect } from 'vitest';
import { acceptBannerUpload, BANNER_RULES } from './banners';

/** A JPEG header of the requested size — the same fixture shape image-size.test.ts uses. */
function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xe0], 2);
  view.setUint16(4, 4);
  bytes.set([0xff, 0xc0], 8);
  view.setUint16(10, 17);
  bytes[12] = 8;
  view.setUint16(13, height);
  view.setUint16(15, width);
  return bytes;
}

describe('acceptBannerUpload', () => {
  it('accepts the slot shape', () => {
    const result = acceptBannerUpload(jpeg(2800, 700), 400_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.size).toEqual({ width: 2800, height: 700, type: 'image/jpeg' });
  });

  it('accepts a 2800x720 master, which is inside the tolerance', () => {
    expect(acceptBannerUpload(jpeg(2800, 720), 400_000).ok).toBe(true);
  });

  /*
   * The shape that started this. The client's six posters were 1261x1561 and
   * were deleted rather than squeezed into a 4:1 band, so this is the case the
   * whole validator exists for.
   */
  it('refuses a portrait poster, and hands back what it got', () => {
    const result = acceptBannerUpload(jpeg(1261, 1561), 400_000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('banner-invalid-shape');
    expect(result.size).toEqual({ width: 1261, height: 1561, type: 'image/jpeg' });
  });

  it('refuses an image too small to stay sharp', () => {
    const result = acceptBannerUpload(jpeg(800, 200), 400_000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('banner-too-small');
  });

  it('refuses a file over the byte cap, and an image over the width cap', () => {
    expect(acceptBannerUpload(jpeg(2800, 700), BANNER_RULES.maxBytes + 1)).toMatchObject({
      ok: false,
      code: 'banner-too-large',
    });
    expect(acceptBannerUpload(jpeg(8000, 2000), 400_000)).toMatchObject({
      ok: false,
      code: 'banner-too-large',
    });
  });

  /*
   * The type is established by recognising the bytes, never by the form's
   * Content-Type, which is whatever the client chose to send.
   */
  it('refuses anything that is not a JPEG or a PNG, and has no size to report', () => {
    const result = acceptBannerUpload(new Uint8Array([0x47, 0x49, 0x46, 0x38]), 100);
    expect(result).toMatchObject({ ok: false, code: 'banner-invalid-type' });
    if (result.ok) return;
    expect(result.size).toBeNull();
  });

  it('holds both edges of the ratio window exactly', () => {
    expect(acceptBannerUpload(jpeg(3800, 1000), 400_000).ok).toBe(true);
    expect(acceptBannerUpload(jpeg(4200, 1000), 400_000).ok).toBe(true);
    expect(acceptBannerUpload(jpeg(3799, 1000), 400_000).ok).toBe(false);
    expect(acceptBannerUpload(jpeg(4201, 1000), 400_000).ok).toBe(false);
  });

  /*
   * Order matters between two of the checks. A portrait poster is ALSO under
   * the minimum width, and being told it is the wrong shape is the useful
   * answer — "too narrow" would send someone off to upscale a tall image.
   */
  it('calls a portrait poster wrongly-shaped rather than too narrow', () => {
    const result = acceptBannerUpload(jpeg(1200, 1500), 400_000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('banner-invalid-shape');
  });
});
