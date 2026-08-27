import { describe, it, expect } from 'vitest';
import {
  whatsappDigits,
  whatsappLink,
  generalEnquiryMessage,
  productEnquiryMessage,
} from './whatsapp';

const NUMBER = '+973 3800 0458';
const SITE = 'https://spartan-ebon.vercel.app';

describe('whatsappDigits', () => {
  it('strips the plus and the spacing a person writes', () => {
    expect(whatsappDigits(NUMBER)).toBe('97338000458');
  });

  it('accepts the same number written any of the usual ways', () => {
    for (const written of ['+97338000458', '00973 3800 0458'.replace('00973', '973'), '973-3800-0458']) {
      expect(whatsappDigits(written)).toBe('97338000458');
    }
  });

  /**
   * Null is the unconfigured case, and it is what makes both controls ABSENT
   * rather than broken. `site.json` shipped `""` here for weeks on purpose.
   */
  it('returns null when there is no number', () => {
    expect(whatsappDigits('')).toBeNull();
    expect(whatsappDigits('   ')).toBeNull();
  });

  it('returns null for something that cannot be a number', () => {
    expect(whatsappDigits('call us')).toBeNull();
    expect(whatsappDigits('12345')).toBeNull();
    expect(whatsappDigits('1'.repeat(16))).toBeNull();
  });

  it('accepts the E.164 bounds themselves', () => {
    expect(whatsappDigits('1'.repeat(8))).toBe('1'.repeat(8));
    expect(whatsappDigits('1'.repeat(15))).toBe('1'.repeat(15));
  });
});

describe('whatsappLink', () => {
  it('addresses Spartan, unlike the share link which addresses nobody', () => {
    const link = whatsappLink(NUMBER, 'hello')!;
    expect(link.startsWith('https://wa.me/97338000458?text=')).toBe(true);
    // The share row's link is `https://wa.me/?text=` — no recipient. If these
    // two ever converge, every share button starts messaging the company.
    expect(link).not.toContain('wa.me/?text=');
  });

  it('is null when unconfigured, so nothing renders', () => {
    expect(whatsappLink('', 'hello')).toBeNull();
  });

  /**
   * §19's trap. `&` starts the next parameter, `+` is read as a space and `#`
   * opens a fragment — so an unencoded product name arrives truncated, with
   * nothing anywhere reporting it. These are real catalogue strings.
   */
  it('encodes the characters that would silently truncate the message', () => {
    for (const name of [
      'Cotton Pants & Shirts',
      'White aluminium frame + iron back cover',
      'Panel #91948',
    ]) {
      const link = whatsappLink(NUMBER, productEnquiryMessage(name, `${SITE}/products/x`))!;
      const sent = decodeURIComponent(link.split('?text=')[1]!);
      expect(sent).toContain(name);
    }
  });

  it('sends the ampersand as one parameter rather than two', () => {
    const link = whatsappLink(NUMBER, 'Cotton Pants & Shirts')!;
    expect(link).toContain('%26');
    expect(link.split('&')).toHaveLength(1);
  });
});

describe('the two messages', () => {
  it('the floating button names the site, not the page the buyer was reading', () => {
    const message = generalEnquiryMessage(SITE);
    expect(message).toContain("I'd like to enquire about your products.");
    expect(message).toContain(SITE);
    expect(message).not.toContain('/products/');
  });

  it('the product button names the product and links to it', () => {
    const message = productEnquiryMessage('Grip Guard GP3', `${SITE}/products/grip-guard-gp3`);
    expect(message).toBe(
      `Hi Spartan, I'd like to enquire about:\n\nGrip Guard GP3\n${SITE}/products/grip-guard-gp3`,
    );
  });

  it('are different, so the team can tell a browse from a product enquiry', () => {
    expect(generalEnquiryMessage(SITE)).not.toBe(
      productEnquiryMessage('Grip Guard GP3', `${SITE}/products/grip-guard-gp3`),
    );
  });

  /** The link goes last and on its own line: both clients linkify that reliably. */
  it('put the link on its own final line', () => {
    expect(generalEnquiryMessage(SITE).split('\n').at(-1)).toBe(SITE);
    expect(
      productEnquiryMessage('Grip Guard GP3', `${SITE}/products/grip-guard-gp3`).split('\n').at(-1),
    ).toBe(`${SITE}/products/grip-guard-gp3`);
  });
});
