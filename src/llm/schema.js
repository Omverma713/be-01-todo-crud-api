/**
 * Week 7 Assignment A17 - Zod Validation Schemas for Triage API
 */

const { z } = require('zod');

const CategoryEnum = z.enum(['billing', 'bug', 'feature', 'other'], {
  errorMap: () => ({ message: "category must be one of: 'billing', 'bug', 'feature', 'other'" })
});

const UrgencyEnum = z.enum(['low', 'normal', 'high'], {
  errorMap: () => ({ message: "urgency must be one of: 'low', 'normal', 'high'" })
});

const TriageInputSchema = z.object({
  text: z.string({
    required_error: "Field 'text' is required",
    invalid_type_error: "Field 'text' must be a string"
  })
  .min(1, "Field 'text' must be between 1 and 2000 characters")
  .max(2000, "Field 'text' must be between 1 and 2000 characters")
});

const TriageOutputSchema = z.object({
  category: CategoryEnum,
  urgency: UrgencyEnum,
  confidence: z.number({
    required_error: "Field 'confidence' is required",
    invalid_type_error: "Field 'confidence' must be a number"
  })
  .min(0, 'confidence must be between 0.0 and 1.0')
  .max(1, 'confidence must be between 0.0 and 1.0'),
  reason: z.string({
    required_error: "Field 'reason' is required",
    invalid_type_error: "Field 'reason' must be a string"
  })
  .min(1, 'reason must be a non-empty string')
});

module.exports = {
  CategoryEnum,
  UrgencyEnum,
  TriageInputSchema,
  TriageOutputSchema
};
