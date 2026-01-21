-- Fix the ERP-High rule (RuleId: 1)
-- Change the first condition from $.taskData.value equals "Erp" to $.taskType equals "Erp"
-- Update the second condition to use >= 1000 (or you can use > 500 if you want anything above 500 to be High)

UPDATE "PriorityRules"
SET "ConditionsJson" = '{
  "all": [
    {
      "path": "$.taskType",
      "op": "equals",
      "value": "Erp"
    },
    {
      "path": "$.taskData.value",
      "op": ">=",
      "value": "1000"
    }
  ]
}',
    "UpdatedAt" = CURRENT_TIMESTAMP
WHERE "RuleId" = 1;

-- If you want High priority for any value > 500, use this instead:
-- UPDATE "PriorityRules"
-- SET "ConditionsJson" = '{
--   "all": [
--     {
--       "path": "$.taskType",
--       "op": "equals",
--       "value": "Erp"
--     },
--     {
--       "path": "$.taskData.value",
--       "op": ">",
--       "value": "500"
--     }
--   ]
-- }',
--     "UpdatedAt" = CURRENT_TIMESTAMP
-- WHERE "RuleId" = 1;

-- Verify the update
SELECT "RuleId", "RuleName", "ConditionsJson", "Priority", "WorkflowId"
FROM "PriorityRules"
WHERE "RuleId" = 1;

