import { describe, it, expect } from 'vitest';
import { imageSize } from './image-size';

/**
 * Byte fixtures rather than real image files.
 *
 * The thing under test reads a header, so a header is the whole input. Real
 * JPEGs committed as fixtures would be slower, larger, opaque to read in a
 * diff, and would not let a test say "now make the segment length lie".
 */

/** A minimal PNG: signature, then an IHDR chunk carrying width and height. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/** A minimal JPEG: SOI, one APP0 to skip past, then an SOF0 carrying the size. */
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

describe('imageSize', () => {
  it('reads a PNG', () => {
    expect(imageSize(png(2800, 700))).toEqual({ width: 2800, height: 700, type: 'image/png' });
  });

  it('reads a JPEG, walking past the segments before SOF0', () => {
    expect(imageSize(jpeg(2800, 700))).toEqual({ width: 2800, height: 700, type: 'image/jpeg' });
  });

  /* The shape that started all this: the six posters were 1261x1561. */
  it('reads the portrait poster shape', () => {
    expect(imageSize(jpeg(1261, 1561))).toEqual({
      width: 1261,
      height: 1561,
      type: 'image/jpeg',
    });
  });

  /*
   * A NULL IS A REFUSED UPLOAD, so each of these must return null rather than a
   * plausible number. Guessing here would put a file whose shape nothing has
   * established into the hero band on the home page.
   */
  it('returns null for anything it does not recognise', () => {
    expect(imageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
    expect(imageSize(new Uint8Array(0))).toBeNull();
    expect(imageSize(new Uint8Array([0xff, 0xd8]))).toBeNull(); // JPEG with no SOF
    expect(imageSize(png(10, 10).slice(0, 20))).toBeNull(); // truncated PNG
  });

  it('does not walk off the end of a JPEG whose segment length lies', () => {
    const bytes = jpeg(100, 100);
    new DataView(bytes.buffer).setUint16(4, 60000); // APP0 claims to be huge
    expect(imageSize(bytes)).toBeNull();
  });

  /*
   * 0xc4 is DHT, not a frame header, and it shares the SOF range. Treating it
   * as one reads two bytes of a Huffman table as the image's height.
   */
  it('does not mistake a DHT segment for a frame header', () => {
    const bytes = jpeg(2800, 700);
    bytes[9] = 0xc4;
    expect(imageSize(bytes)).toBeNull();
  });
});
