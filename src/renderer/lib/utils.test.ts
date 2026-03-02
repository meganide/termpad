import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility function', () => {
  describe('basic usage', () => {
    it('returns empty string for no arguments', () => {
      expect(cn()).toBe('');
    });

    it('returns single class unchanged', () => {
      expect(cn('text-red-500')).toBe('text-red-500');
    });

    it('joins multiple classes with space', () => {
      expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500');
    });
  });

  describe('conditional classes with clsx behavior', () => {
    it('handles undefined values', () => {
      expect(cn('base', undefined, 'other')).toBe('base other');
    });

    it('handles null values', () => {
      expect(cn('base', null, 'other')).toBe('base other');
    });

    it('handles false values', () => {
      expect(cn('base', false, 'other')).toBe('base other');
    });

    it('handles boolean conditionals', () => {
      const isActive = true;
      const isDisabled = false;
      expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe(
        'base active'
      );
    });

    it('handles object syntax for conditional classes', () => {
      expect(
        cn('base', { active: true, disabled: false, highlighted: true })
      ).toBe('base active highlighted');
    });

    it('handles array of classes', () => {
      expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
    });

    it('handles nested arrays', () => {
      expect(cn(['class1', ['class2', 'class3']])).toBe('class1 class2 class3');
    });
  });

  describe('tailwind-merge behavior', () => {
    it('merges conflicting color utilities (last wins)', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('merges conflicting background utilities', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('merges conflicting padding utilities', () => {
      expect(cn('p-4', 'p-8')).toBe('p-8');
    });

    it('merges conflicting margin utilities', () => {
      expect(cn('m-2', 'm-4')).toBe('m-4');
    });

    it('merges conflicting width utilities', () => {
      expect(cn('w-full', 'w-1/2')).toBe('w-1/2');
    });

    it('does not merge non-conflicting utilities', () => {
      expect(cn('text-red-500', 'bg-blue-500', 'p-4')).toBe(
        'text-red-500 bg-blue-500 p-4'
      );
    });

    it('merges padding direction utilities correctly', () => {
      expect(cn('px-4', 'px-8')).toBe('px-8');
      expect(cn('py-4', 'py-8')).toBe('py-8');
    });

    it('keeps specific direction when different axis', () => {
      expect(cn('px-4', 'py-8')).toBe('px-4 py-8');
    });

    it('merges display utilities', () => {
      expect(cn('block', 'flex')).toBe('flex');
    });

    it('merges flex direction utilities', () => {
      expect(cn('flex-row', 'flex-col')).toBe('flex-col');
    });

    it('merges justify utilities', () => {
      expect(cn('justify-start', 'justify-center')).toBe('justify-center');
    });

    it('merges align utilities', () => {
      expect(cn('items-start', 'items-center')).toBe('items-center');
    });

    it('handles arbitrary values', () => {
      expect(cn('text-[#123456]', 'text-[#654321]')).toBe('text-[#654321]');
    });
  });

  describe('combined clsx and tailwind-merge', () => {
    it('handles conditional classes with tailwind merge', () => {
      const isError = true;
      expect(cn('text-gray-500', isError && 'text-red-500')).toBe(
        'text-red-500'
      );
    });

    it('handles object conditionals with tailwind merge', () => {
      expect(cn('bg-gray-100', { 'bg-blue-500': true, 'bg-red-500': false })).toBe(
        'bg-blue-500'
      );
    });

    it('handles complex scenario with multiple features', () => {
      const isActive = true;
      const size = 'large';
      expect(
        cn(
          'base-class',
          'p-2',
          isActive && 'active',
          size === 'large' && 'p-4',
          { 'text-blue-500': true }
        )
      ).toBe('base-class active p-4 text-blue-500');
    });

    it('handles empty strings', () => {
      expect(cn('', 'class1', '', 'class2')).toBe('class1 class2');
    });

    it('handles whitespace in class names', () => {
      expect(cn('  class1  ', 'class2')).toBe('class1 class2');
    });
  });

  describe('edge cases', () => {
    it('handles number as class name', () => {
      expect(cn('class1', 0, 'class2')).toBe('class1 class2');
    });

    it('handles empty object', () => {
      expect(cn('class1', {}, 'class2')).toBe('class1 class2');
    });

    it('handles empty array', () => {
      expect(cn('class1', [], 'class2')).toBe('class1 class2');
    });

    it('handles mix of all types', () => {
      expect(
        cn(
          'string-class',
          ['array-class'],
          { 'object-class': true },
          undefined,
          null,
          false,
          0,
          'another-string'
        )
      ).toBe('string-class array-class object-class another-string');
    });
  });
});
