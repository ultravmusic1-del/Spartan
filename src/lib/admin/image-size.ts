/**
 * The width, height and type of a JPEG or PNG, read from its header.
 *
 * WHY NOT `sharp`, WHICH IS ALREADY INSTALLED. It is a native binary, and this
 * would be its first use inside a REQUEST HANDLER rather than at build time — a
 * bundling and cold-start question on a serverless platform, in exchange for
 * two numbers that live in the first couple of dozen bytes of the file. A
 * header read has no dependency, no binary, and is testable against byte
 * fixtures with no real image and no browser.
 *
 * IT RETURNS NULL RATHER THAN GUESSING, and a null is a refused upload. The
 * alternative — a default, or a partial read — would let a file whose shape
 * nothing has established reach the hero band on the home page.
 *
 * It is also the type check. `acceptBannerUpload` does not read the form's
 * Content-Type, which is whatever the client chose to send; recognising the
 * bytes IS establishing the format.
 */
export interface ImageSize {
  width: number;
  height: number;
  type: 'image/jpeg' | 'image/png';
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Which JPEG markers are frame headers.
 *
 * 0xc0–0xcf looks like a clean range and is not: 0xc4 is DHT (a Huffman table),
 * 0xc8 is JPG and 0xcc is DAC. Treating one of those as a frame header reads
 * two bytes of a Huffman table as the image's height, which is a plausible
 * number and therefore the worst possible answer.
 */
const isStartOfFrame = (marker: number): boolean =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

export function imageSize(bytes: Uint8Array): ImageSize | null {
  return pngSize(bytes) ?? jpegSize(bytes);
}

function pngSize(bytes: Uint8Array): ImageSize | null {
  // 8 signature + 4 length + 4 "IHDR" + 4 width + 4 height.
  if (bytes.length < 24) return null;
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return null;
  if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20), type: 'image/png' };
}

function jpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  // + 9 because a frame header's height and width sit at offset + 5 and + 7,
  // so anything closer to the end than that cannot be read whole.
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null; // Not on a marker boundary.
    const marker = bytes[offset + 1]!;

    if (isStartOfFrame(marker)) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
        type: 'image/jpeg',
      };
    }

    const length = view.getUint16(offset + 2);
    // A segment shorter than its own length field is malformed; one that claims
    // to run past the end is truncated. Neither is a smaller image, and the
    // loop condition alone would let the second walk off and return nothing
    // useful anyway — this says so deliberately.
    if (length < 2) return null;
    offset += 2 + length;
  }

  return null;
}
