/**
 * Rule Engine — evaluates conditions against input data
 * and returns the appropriate action.
 *
 * Rule format:
 * {
 *   condition: { field: "amount", operator: ">", value: 5000 },
 *   action: "manager_approval"
 * }
 */

function evaluateCondition(condition, inputData) {
  const { field, operator, value } = condition;
  const fieldValue = inputData[field];

  switch (operator) {
    case ">":  return fieldValue > value;
    case "<":  return fieldValue < value;
    case ">=": return fieldValue >= value;
    case "<=": return fieldValue <= value;
    case "==": return fieldValue == value;
    case "!=": return fieldValue != value;
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

function runRuleEngine(rules, inputData) {
  for (const rule of rules) {
    if (evaluateCondition(rule.condition, inputData)) {
      return {
        matched: true,
        rule,
        action: rule.action,
        message: `Rule matched → Action: ${rule.action}`
      };
    }
  }

  return {
    matched: false,
    action: "auto_approve",
    message: "No rules matched → Action: auto_approve"
  };
}

module.exports = { runRuleEngine, evaluateCondition };
