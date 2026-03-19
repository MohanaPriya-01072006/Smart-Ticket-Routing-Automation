import { describe, it, expect } from 'vitest';
const ruleEngine = require('../services/ruleEngine');

describe('RuleEngine Logic Verification', () => {
  const context = {
    priority: 'high',
    issue_type: 'technical',
    user_name: 'John Doe',
    description: 'Login issue'
  };

  it('should evaluate existence with true condition', () => {
    expect(ruleEngine.evaluate('true', context)).toBe(true);
  });

  it('should evaluate string equality', () => {
    expect(ruleEngine.evaluate("priority == 'high'", context)).toBe(true);
    expect(ruleEngine.evaluate("issue_type != 'technical'", context)).toBe(false);
  });

  it('should handle complex logical operators (&&, ||)', () => {
    expect(ruleEngine.evaluate("priority == 'high' && issue_type == 'technical'", context)).toBe(true);
    expect(ruleEngine.evaluate("priority == 'low' || issue_type == 'technical'", context)).toBe(true);
  });

  it('should support built-in string functions', () => {
    expect(ruleEngine.evaluate("issue_type.contains('tech')", context)).toBe(true);
    expect(ruleEngine.evaluate("user_name.startsWith('John')", context)).toBe(true);
  });

  it('should fail gracefully on malformed syntax', () => {
    // Should return false rather than crashing
    expect(ruleEngine.evaluate('invalid syntax @#$', context)).toBe(false);
  });
});
