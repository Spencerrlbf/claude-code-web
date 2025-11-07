import { sum, multiply } from '@/lib/utils/sample';

describe('Sample Utilities', () => {
  describe('sum', () => {
    it('should add two positive numbers', () => {
      expect(sum(2, 3)).toBe(5);
    });

    it('should add two negative numbers', () => {
      expect(sum(-2, -3)).toBe(-5);
    });

    it('should add a positive and negative number', () => {
      expect(sum(5, -3)).toBe(2);
    });

    it('should handle zero', () => {
      expect(sum(0, 5)).toBe(5);
      expect(sum(5, 0)).toBe(5);
      expect(sum(0, 0)).toBe(0);
    });

    it('should handle decimal numbers', () => {
      expect(sum(1.5, 2.3)).toBeCloseTo(3.8);
    });
  });

  describe('multiply', () => {
    it('should multiply two positive numbers', () => {
      expect(multiply(2, 3)).toBe(6);
    });

    it('should multiply two negative numbers', () => {
      expect(multiply(-2, -3)).toBe(6);
    });

    it('should multiply a positive and negative number', () => {
      expect(multiply(5, -3)).toBe(-15);
    });

    it('should handle zero', () => {
      expect(multiply(0, 5)).toBe(0);
      expect(multiply(5, 0)).toBe(0);
      expect(multiply(0, 0)).toBe(0);
    });

    it('should handle decimal numbers', () => {
      expect(multiply(2.5, 4)).toBe(10);
    });
  });
});
