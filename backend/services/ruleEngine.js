/**
 * Rule Engine Service
 * Handles evaluation of conditions against input data.
 * Supports:
 * - Comparison Operators: ==, !=, <, >, <=, >=
 * - Logical Operators: &&, ||
 * - String Functions: contains, startsWith, endsWith
 */

class RuleEngine {
  /**
   * Evaluates a condition string against a data object.
   * @param {string} condition - The condition to evaluate (e.g., "amount > 100 && country == 'US'")
   * @param {object} data - The input data to evaluate against.
   * @returns {boolean} - True if the condition is met, false otherwise.
   */
  evaluate(condition, data) {
    if (!condition || condition.toUpperCase() === 'DEFAULT' || condition.toUpperCase() === 'TRUE') {
      return true;
    }

    try {
      // 1. Pre-process the condition string
      // Replace data fields with their values
      let expression = condition;

      // Extract field names (simple word characters)
      // This is a basic implementation. For production, a proper parser (like jexl or similar) is better.
      // We'll use a simple approach for this challenge.
      
      const fields = Object.keys(data);
      fields.sort((a, b) => b.length - a.length); // Replace longer names first to avoid partial matches

      fields.forEach(field => {
        const val = data[field];
        const stringVal = typeof val === 'string' ? `'${val}'` : val;
        // Use regex to replace only whole words
        const regex = new RegExp(`\\b${field}\\b`, 'g');
        expression = expression.replace(regex, stringVal);
      });

      // 2. Handle string functions: contains, startsWith, endsWith
      // Syntax: field.contains('value')
      expression = this.replaceStringFunctions(expression);

      // 3. Evaluate the final expression
      // WARNING: Using Function constructor is safer than eval, but still needs caution.
      // Since this is a controlled environment for the challenge, we'll proceed.
      const evaluator = new Function(`return ${expression};`);
      return !!evaluator();
    } catch (err) {
      console.error(`Error evaluating condition "${condition}":`, err.message);
      return false;
    }
  }

  replaceStringFunctions(expression) {
    let result = expression;

    // contains: field.contains('sub') -> field.indexOf('sub') !== -1
    result = result.replace(/\.(contains|includes)\((.*?)\)/g, ".indexOf($2) !== -1");

    // startsWith: field.startsWith('prefix') -> field.indexOf('prefix') === 0
    result = result.replace(/\.startsWith\((.*?)\)/g, ".indexOf($1) === 0");

    // endsWith: field.endsWith('suffix') -> field.endsWith($1)
    // We can use a regex replacement similar to others or rely on modern JS if guaranteed
    result = result.replace(/\.endsWith\((.*?)\)/g, ".endsWith($1)");
    
    return result;
  }

  /**
   * Validates the syntax of a condition string.
   * @param {string} condition - The condition to validate.
   * @returns {object} - { valid: boolean, error: string|null }
   */
  validate(condition) {
    if (!condition || condition.toUpperCase() === 'DEFAULT' || condition.toUpperCase() === 'TRUE') {
      return { valid: true };
    }

    try {
      // Dry run with dummy data
      let expression = condition;
      
      // Replace likely variable patterns with dummy values for syntax check
      // This is a rough check, but better than nothing.
      expression = expression.replace(/[a-zA-Z_]\w*/g, "1"); 
      expression = this.replaceStringFunctions(expression);

      new Function(`return ${expression};`);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }
}

module.exports = new RuleEngine();
