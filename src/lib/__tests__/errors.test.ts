import { fingerprint, messageOf } from '../errors';

describe('fingerprint', () => {
  it('groups the same fault on the same screen', () => {
    expect(fingerprint('owner/list', 'Network request failed')).toBe(
      fingerprint('owner/list', 'Network request failed'),
    );
  });

  it('separates the same message on different screens', () => {
    expect(fingerprint('owner/list', 'Network request failed')).not.toBe(
      fingerprint('business/[id]', 'Network request failed'),
    );
  });

  /*
   * The whole point of the normalising. An error carrying the id of whatever
   * it failed on is one fault, and keeping the id would file every occurrence
   * separately and hide that fifty people hit it.
   */
  it('groups messages that differ only by an id', () => {
    expect(fingerprint('x', 'no row 4f2c8a10-1111-4222-8333-444455556666')).toBe(
      fingerprint('x', 'no row 9b1d7e20-9999-4888-8777-666655554444'),
    );
  });

  it('groups messages that differ only by a number', () => {
    expect(fingerprint('x', 'timed out after 30 s')).toBe(fingerprint('x', 'timed out after 5 s'));
  });

  it('groups messages that differ only by a quoted value', () => {
    expect(fingerprint('x', 'could not save "Kahawa"')).toBe(
      fingerprint('x', 'could not save "Sarabi"'),
    );
  });

  it('keeps genuinely different faults apart', () => {
    expect(fingerprint('x', 'Network request failed')).not.toBe(
      fingerprint('x', 'Permission denied'),
    );
  });

  it('is stable across runs, so groups survive a restart', () => {
    expect(fingerprint('owner/list', 'Network request failed')).toBe('4htlm7');
  });
});

describe('messageOf', () => {
  it('reads an Error', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
  });

  it('falls back to the name when an Error carries no message', () => {
    expect(messageOf(new TypeError())).toBe('TypeError');
  });

  it('takes a thrown string as it is', () => {
    expect(messageOf('just a string')).toBe('just a string');
  });

  it('does its best with anything else, and never throws', () => {
    expect(messageOf({ code: 42 })).toBe('{"code":42}');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(messageOf(circular)).toBe('Unknown error');
  });
});
