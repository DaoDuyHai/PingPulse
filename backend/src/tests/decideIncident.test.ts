import { describe, it, expect } from 'vitest';

import { decideIncident, type Check } from '../incident/decideIncident.js';

const up: Check = { isUp: true, status: 200 };
const down: Check = { isUp: false, status: 500 };

describe('Kich ban mo su co open', () => {
  it('Khi chua co su co (false) va 3 lan loi lien tiep', () => {
    expect(decideIncident([down, down, down], false)).toBe('open');
  });
});

describe('Kich ban dong su co close', () => {
  it('Khi da co su co roi(true) va 2 lan check thanh cong lien tiep', () => {
    expect(decideIncident([up, up], true)).toBe('close');
  });
});

describe('Kich ban khong lam gi ca (none)', () => {
  it('Chua co su co nhung moi loi dc 1 hoac 2 lan', () => {
    expect(decideIncident([down, down], false)).toBe('none');
  });
  it('Chua co su co nhung ma loi xen ke', () => {
    expect(decideIncident([down, up, down, up, down, down, up], false)).toBe(
      'none'
    );
  });

  it('Chu co su co va hoan toan khoe manh', () => {
    expect(decideIncident([up, up, up, up], false)).toBe('none');
  });

  it('Da co su coi roi va van loi lien tuc', () => {
    expect(decideIncident([down, down, down, down], true)).toBe('none');
  });

  it('Da co su co roi nhung ma chi co 1 lan true roi lai down', () => {
    expect(decideIncident([up, down, up, down, down], true)).toBe('none');
  });
});

describe('Truong hop bien', () => {
  it('Mang check bi rong', () => {
    expect(decideIncident([], false)).toBe('none');
    expect(decideIncident([], true)).toBe('none');
  });

  it('Mang check dai hon 3 phan tu thi chi quan tam cac phan tu dau', () => {
    expect(decideIncident([down, down, down, up], false)).toBe('open');

    expect(decideIncident([up, up, down], true)).toBe('close');
  });
});
