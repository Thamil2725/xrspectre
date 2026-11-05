import { z } from 'zod';

export const createTestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  institutionIds: z.array(z.string().min(1)).min(1),
  departmentIds: z.array(z.string().min(1)).min(1),
  batchIds: z.array(z.string().min(1)).min(1),
  questionSource: z.enum(['manual', 'pool']).optional().default('manual'),
  selectedPoolIds: z.array(z.string().min(1)).optional().default([]),
  questionsPerStudent: z.number().int().min(1).optional(),
  selectedCategoryIds: z.array(z.string()).optional().default([]),
  selectedQuestionIds: z.array(z.string()).optional().default([]),
  questionsPerCategory: z.array(z.string()).optional().default([]),
});

export const testCaseSchema = z.object({
  input: z.string(),
  output: z.string(),
  isSample: z.boolean().optional().default(false),
});

export const addQuestionSchema = z.object({
  title: z.string().min(1),
  statement: z.string().min(1),
  points: z.number().int().min(0).default(20),
  timeAllottedMinutes: z.number().int().min(1).default(20),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('EASY'),
  constraints: z.array(z.string()).optional().default([]),
  type: z.enum(['CODING', 'SUBJECTIVE']).optional().default('CODING'),
  modelAnswer: z.string().optional(),
  timeLimitSecs: z.number().int().min(1).max(30).optional().default(5),
  memoryLimitMB: z.number().int().min(32).max(1024).optional().default(256),
  testCases: z.array(testCaseSchema).optional().default([]),
  functionSignature: z.record(z.string(), z.any()).optional(),
});

export const updateAudienceSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  institutionIds: z.array(z.string().min(1)).min(1),
  departmentIds: z.array(z.string().min(1)).min(1),
  batchIds: z.array(z.string().min(1)).min(1),
  questionSource: z.enum(['manual', 'pool']).optional(),
  selectedPoolIds: z.array(z.string()).optional(),
  questionsPerStudent: z.number().int().min(1).optional(),
  selectedCategoryIds: z.array(z.string()).optional(),
  selectedQuestionIds: z.array(z.string()).optional(),
  questionsPerCategory: z.array(z.string()).optional(),
});

// Editing a question — test cases are optional here (only replaced
// when provided) so admin can change metadata alone.
export const updateQuestionSchema = z.object({
  title: z.string().min(1).optional(),
  statement: z.string().min(1).optional(),
  points: z.number().int().min(0).optional(),
  timeAllottedMinutes: z.number().int().min(1).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  constraints: z.array(z.string()).optional(),
  type: z.enum(['CODING', 'SUBJECTIVE']).optional(),
  modelAnswer: z.string().optional(),
  timeLimitSecs: z.number().int().min(1).max(30).optional(),
  memoryLimitMB: z.number().int().min(32).max(1024).optional(),
  testCases: z.array(testCaseSchema).optional(),
  functionSignature: z.any().optional(),
});

const isoDatetime = z.string().refine((val) => !isNaN(new Date(val).getTime()), 'Invalid ISO datetime string');

export const reopenTestSchema = z.object({
  startTime: isoDatetime,
  endTime: isoDatetime,
  departmentIds: z.array(z.string().min(1)).min(1),
  batchIds: z.array(z.string().min(1)).min(1),
});

export const scheduleTestSchema = z.object({
  startTime: isoDatetime,
  endTime: isoDatetime,
  durationMinutes: z.number().int().min(1).optional(),
  maxWarnings: z.number().int().min(0).max(10).optional(),
  securityEnabled: z.boolean().optional(),
});

const codeLimit = 100000; // 100 KB max
const answerLimit = 50000;
const language = z.enum(['javascript', 'python', 'cpp', 'java', 'c']).nullable().optional();

export const submitCodeSchema = z.object({
  questionId: z.string().min(1).max(64),
  language,
  code: z.string().max(codeLimit, 'Code must be under 100 KB').optional(),
  answer: z.string().max(answerLimit, 'Answer must be under 50,000 characters').optional(),
}).refine((data) => data.code !== undefined || data.answer !== undefined, {
  message: 'Either code or answer must be provided.',
});

export const runCodeSchema = z.object({
  questionId: z.string().min(1).max(64),
  language,
  code: z.string().max(codeLimit, 'Code must be under 100 KB').optional(),
  customInput: z.string().max(codeLimit, 'Custom input must be under 100 KB').optional(),
  answer: z.string().max(answerLimit).optional(),
});

// Unsaved answers sent when a student leaves the exam page.
export const autoSubmitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1).max(64),
    language,
    code: z.string().max(codeLimit).optional(),
    answer: z.string().max(answerLimit).optional(),
  })).max(100).optional().default([]),
});
