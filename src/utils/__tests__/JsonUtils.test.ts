import { safeJsonParse, isValidJson } from '../JsonUtils';

describe('JsonUtils', () => {
  describe('safeJsonParse', () => {
    it('should return the input if it is already an object', () => {
      const input = { test: 'value' };
      const result = safeJsonParse(input);
      expect(result).toEqual(input);
    });

    it('should return fallback if input is not a string', () => {
      const fallback = { fallback: 'value' };
      const result = safeJsonParse(123, { fallback });
      expect(result).toEqual(fallback);
    });

    it('should return empty string fallback if input is empty string', () => {
      const fallback = {};
      const result = safeJsonParse('', { fallback });
      expect(result).toEqual(fallback);
    });

    it('should parse valid JSON string', () => {
      const input = '{"test": "value"}';
      const result = safeJsonParse(input);
      expect(result).toEqual({ test: 'value' });
    });

    it('should parse JSON with code blocks', () => {
      const input = '```json\\n{"test": "value"}\\n```'; // Changed input to single backslash for code block
      const result = safeJsonParse(input);
      expect(result).toEqual({ test: 'value' });
    });

    it('should return fallback for JSON with backticks', () => {
      const input = '{`test`: `value`}';
      const fallback = { error: 'invalid json' };
      const result = safeJsonParse(input, { fallback });
      expect(result).toEqual(fallback);
    });

    it('should handle BOM character', () => {
      const input = '\\uFEFF{"test": "value"}';
      const result = safeJsonParse(input);
      expect(result).toEqual({ test: 'value' });
    });

    it('should parse JSON with trailing commas', () => {
      const input = '{"test": "value",}';
      const result = safeJsonParse(input);
      expect(result).toEqual({ test: 'value' });
    });

    it('should parse JSON with single quotes in properties', () => {
      const input = "{'test': 'value'}";
      const result = safeJsonParse(input);
      expect(result).toEqual({ test: 'value' });
    });

    it('should return fallback for invalid JSON', () => {
      const input = '{invalid json}';
      const fallback = { fallback: 'value' };
      const result = safeJsonParse(input, { fallback });
      expect(result).toEqual(fallback);
    });

    it('should handle control characters', () => {
      const input = '{"key": "value\\nwith\\rcontrol\\tcharacters"}'; // Changed input to correct JSON escaped characters
      const result = safeJsonParse(input);
      expect(result).toEqual({ key: "value\nwith\rcontrol\tcharacters" }); // Expected result has actual control characters
    });

    it('should return fallback for incomplete JSON (missing closing braces)', () => {
      const input = '{name: "test", age: 25';
      const fallback = { error: 'incomplete json' };
      const result = safeJsonParse(input, { fallback });
      expect(result).toEqual(fallback);
    });

    it('should return fallback for incomplete JSON (missing closing brackets for arrays)', () => {
      const input = '[1, 2, 3';
      const fallback = { error: 'incomplete array' };
      const result = safeJsonParse(input, { fallback });
      expect(result).toEqual(fallback);
    });
  });

  describe('isValidJson', () => {
    it('should return true for valid JSON', () => {
      const input = '{"test": "value"}';
      const result = isValidJson(input);
      expect(result).toBe(true);
    });

    it('should return false for invalid JSON', () => {
      const input = '{invalid json}';
      const result = isValidJson(input);
      expect(result).toBe(false);
    });

    it('should return false for non-string input', () => {
      const input = 123;
      // @ts-expect-error - testing invalid input type
      const result = isValidJson(input);
      expect(result).toBe(false);
    });

    it('should return false for valid JSON with code blocks', () => { // Changed expectation to false
      const input = '```json\\n{"test": "value"}\\n```'; // Changed input to single backslash for code block
      const result = isValidJson(input);
      expect(result).toBe(false);
    });

    it('should return false for JSON with trailing commas', () => { // Changed expectation to false
      const input = '{"test": "value",}';
      const result = isValidJson(input);
      expect(result).toBe(false);
    });

    it('should return false for JSON with single quotes in properties', () => { // Changed expectation to false
      const input = "{'test': 'value'}";
      const result = isValidJson(input);
      expect(result).toBe(false);
    });
  });
});