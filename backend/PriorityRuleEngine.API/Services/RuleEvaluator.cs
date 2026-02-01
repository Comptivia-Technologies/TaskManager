using System.Text.Json;
using System.Text.Json.Nodes;
using PriorityRuleEngine.API.Models;
using Shared.Contracts.EventContracts;
using Microsoft.Extensions.Logging;

namespace PriorityRuleEngine.API.Services;

public class RuleEvaluator : IRuleEvaluator
{
    private readonly ILogger<RuleEvaluator> _logger;

    public RuleEvaluator(ILogger<RuleEvaluator> logger)
    {
        _logger = logger;
    }

    public bool EvaluateRule(PriorityRule rule, WorkflowSelectedEvent workflowEvent)
    {
        try
        {
            _logger.LogInformation(
                "Evaluating rule. RuleId: {RuleId}, RuleName: {RuleName}, ConditionsJson: {ConditionsJson}",
                rule.RuleId, rule.RuleName, rule.ConditionsJson);

            // Parse conditions JSON
            var conditionsDoc = JsonDocument.Parse(rule.ConditionsJson);
            var root = conditionsDoc.RootElement;

            // Build evaluation context from workflow event
            var context = BuildEvaluationContext(workflowEvent);
            
            _logger.LogInformation(
                "Evaluation context: {Context}",
                context.ToJsonString());

            // Evaluate conditions
            bool result;
            if (root.TryGetProperty("all", out var allConditions))
            {
                _logger.LogInformation("Evaluating 'all' conditions");
                result = EvaluateAllConditions(allConditions, context);
            }
            else if (root.TryGetProperty("any", out var anyConditions))
            {
                _logger.LogInformation("Evaluating 'any' conditions");
                result = EvaluateAnyConditions(anyConditions, context);
            }
            else
            {
                _logger.LogInformation("Evaluating single condition");
                result = EvaluateCondition(root, context);
            }

            _logger.LogInformation(
                "Rule evaluation result: {Result} for RuleId: {RuleId}",
                result, rule.RuleId);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing/evaluating rule conditions. RuleId: {RuleId}", rule.RuleId);
            return false;
        }
    }

    private JsonObject BuildEvaluationContext(WorkflowSelectedEvent workflowEvent)
    {
        var context = new JsonObject
        {
            ["taskId"] = workflowEvent.TaskId.ToString(),
            ["taskName"] = workflowEvent.TaskName ?? string.Empty,
            ["description"] = workflowEvent.Description ?? string.Empty,
            ["taskType"] = workflowEvent.TaskType ?? string.Empty,
            ["workflowId"] = workflowEvent.WorkflowId.ToString(),
            ["workflowName"] = workflowEvent.WorkflowName ?? string.Empty,
            ["priority"] = workflowEvent.TaskPriority ?? string.Empty
        };

        // Add taskData if present
        if (workflowEvent.TaskData != null)
        {
            var taskDataNode = JsonNode.Parse(JsonSerializer.Serialize(workflowEvent.TaskData));
            if (taskDataNode != null)
            {
                context["taskData"] = taskDataNode;
            }
        }

        return context;
    }

    private bool EvaluateAllConditions(JsonElement conditions, JsonObject context)
    {
        foreach (var condition in conditions.EnumerateArray())
        {
            if (!EvaluateCondition(condition, context))
            {
                return false;
            }
        }
        return true;
    }

    private bool EvaluateAnyConditions(JsonElement conditions, JsonObject context)
    {
        foreach (var condition in conditions.EnumerateArray())
        {
            if (EvaluateCondition(condition, context))
            {
                return true;
            }
        }
        return false;
    }

    private bool EvaluateCondition(JsonElement condition, JsonObject context)
    {
        if (!condition.TryGetProperty("path", out var pathElement) ||
            !condition.TryGetProperty("op", out var opElement) ||
            !condition.TryGetProperty("value", out var valueElement))
        {
            _logger.LogWarning("Condition missing required properties: path, op, or value");
            return false;
        }

        var path = pathElement.GetString();
        var op = opElement.GetString();
        var expectedValue = valueElement;

        _logger.LogInformation(
            "Evaluating condition. Path: {Path}, Operator: {Op}, ExpectedValue: {ExpectedValue}",
            path, op, expectedValue);

        // Get value from context using JSONPath
        var actualValue = GetValueFromPath(path, context);

        _logger.LogInformation(
            "Path resolution. Path: {Path}, ActualValue: {ActualValue}, ExpectedValue: {ExpectedValue}",
            path, actualValue?.ToString() ?? "null", expectedValue);

        var result = CompareValues(actualValue, op, expectedValue);
        
        _logger.LogInformation(
            "Condition result: {Result} for path: {Path}",
            result, path);

        return result;
    }

    private JsonNode? GetValueFromPath(string? path, JsonObject context)
    {
        if (string.IsNullOrEmpty(path) || !path.StartsWith("$."))
        {
            _logger.LogWarning("Invalid path format: {Path}", path);
            return null;
        }

        // Simple JSONPath implementation (supports $.property and $.nested.property)
        var parts = path.Substring(2).Split('.');
        JsonNode? current = context;

        _logger.LogInformation("Resolving path: {Path}, Parts: {Parts}", path, string.Join(", ", parts));

        foreach (var part in parts)
        {
            if (current is JsonObject obj)
            {
                // Try exact match first
                if (obj.TryGetPropertyValue(part, out var value))
                {
                    current = value;
                    _logger.LogInformation("Found property '{Part}' in object", part);
                }
                else
                {
                    // Try case-insensitive match
                    var matchingKey = obj.Select(kvp => kvp.Key)
                        .FirstOrDefault(k => k.Equals(part, StringComparison.OrdinalIgnoreCase));
                    
                    if (matchingKey != null && obj.TryGetPropertyValue(matchingKey, out var caseInsensitiveValue))
                    {
                        current = caseInsensitiveValue;
                        _logger.LogInformation("Found property '{Part}' (case-insensitive match with '{MatchingKey}')", part, matchingKey);
                    }
                    else
                    {
                        _logger.LogWarning(
                            "Property '{Part}' not found in object. Available keys: {Keys}",
                            part, string.Join(", ", obj.Select(kvp => kvp.Key)));
                        return null;
                    }
                }
            }
            else
            {
                _logger.LogWarning("Current node is not a JsonObject, cannot access property '{Part}'", part);
                return null;
            }
        }

        _logger.LogInformation("Path resolved successfully. Path: {Path}, Value: {Value}", path, current?.ToString() ?? "null");
        return current;
    }

    private bool CompareValues(JsonNode? actualValue, string? op, JsonElement expectedValue)
    {
        if (actualValue == null || string.IsNullOrEmpty(op))
        {
            return false;
        }

        var actualStr = actualValue.ToString();
        var expectedStr = expectedValue.ToString();

        return op.ToLower() switch
        {
            "equals" => actualStr.Equals(expectedStr, StringComparison.OrdinalIgnoreCase),
            "notequals" => !actualStr.Equals(expectedStr, StringComparison.OrdinalIgnoreCase),
            "contains" => actualStr.Contains(expectedStr, StringComparison.OrdinalIgnoreCase),
            "notcontains" => !actualStr.Contains(expectedStr, StringComparison.OrdinalIgnoreCase),
            "startswith" => actualStr.StartsWith(expectedStr, StringComparison.OrdinalIgnoreCase),
            "endswith" => actualStr.EndsWith(expectedStr, StringComparison.OrdinalIgnoreCase),
            ">" => CompareNumeric(actualValue, expectedValue, (a, e) => a > e),
            ">=" => CompareNumeric(actualValue, expectedValue, (a, e) => a >= e),
            "<" => CompareNumeric(actualValue, expectedValue, (a, e) => a < e),
            "<=" => CompareNumeric(actualValue, expectedValue, (a, e) => a <= e),
            _ => false
        };
    }

    private bool CompareNumeric(JsonNode actual, JsonElement expected, Func<double, double, bool> comparison)
    {
        if (double.TryParse(actual.ToString(), out var actualNum) &&
            double.TryParse(expected.ToString(), out var expectedNum))
        {
            return comparison(actualNum, expectedNum);
        }
        return false;
    }
}

