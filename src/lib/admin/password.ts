/**
 * What counts as an acceptable admin password.
 *
 * Pure, so the rule is testable without a browser or a Supabase project, and
 * stated once so the form's help text and the endpoint's rejection cannot drift
 * apart — a rule enforced in one place and described in another eventually
 * describes something else.
 *
 * STRICTER THAN SUPABASE ON PURPOSE. Supabase's own floor is six characters.
 * This account is the only thing standing between a stranger and every name,
 * email address and phone number the site has ever collected, there is no
 * second factor on the sign-in form, and the allow-list does not help once a
 * password is known. Twelve characters is the cheapest meaningful improvement
 * on six.
 *
 * DELIBERATELY NOT A COMPOSITION RULE. No "one uppercase, one digit, one
 * symbol": those push people towards `Password1!` and away from the long
 * passphrase that is actually strong. Length is the requirement that survives
 * contact with a human being.
 */
export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_HELP = `At least ${MIN_PASSWORD_LENGTH} characters. A passphrase of a few unrelated words is stronger than a short one with symbols in it.`;

/**
 * Returns the reason a password is unacceptable, or null when it is fine.
 *
 * A message rather than a boolean, because the caller has to tell somebody what
 * to do about it and a boolean forces that text to be written somewhere else.
 */
export function checkPassword(password: string, confirmation: string): string | null {
  if (!password) return 'Enter a new password.';

  /*
   * Counted in code points, not UTF-16 units. `password.length` counts an emoji
   * or an astral character as two, so a rule of twelve would quietly accept
   * six of them. Spread-then-length counts what a person typed.
   */
  if ([...password].length < MIN_PASSWORD_LENGTH) {
    return `That password is too short. Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  // Compared before trimming anything: a leading or trailing space is a legal
  // part of a password and silently stripping one would set a password the
  // person cannot then type.
  if (password !== confirmation) return 'The two passwords do not match.';

  return null;
}
