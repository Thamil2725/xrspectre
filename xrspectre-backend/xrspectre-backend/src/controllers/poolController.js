import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { generateTemplates } from '../utils/templateGenerator.js';

const createPoolSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(2000).optional(),
});

const updatePoolSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(2000).optional(),
});

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(150),
});

const testCaseSchema = z.object({
  input: z.string(),
  output: z.string(),
  isSample: z.boolean().optional().default(false),
});

const createQuestionSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
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
  functionSignature: z.any().optional(),
});

const updateQuestionSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  statement: z.string().min(1).optional(),
  points: z.number().int().min(0).optional(),
  timeAllottedMinutes: z.number().int().min(1).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  constraints: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  type: z.enum(['CODING', 'SUBJECTIVE']).optional(),
  modelAnswer: z.string().optional(),
  timeLimitSecs: z.number().int().min(1).max(30).optional(),
  memoryLimitMB: z.number().int().min(32).max(1024).optional(),
  testCases: z.array(testCaseSchema.extend({ id: z.string().optional() })).optional(),
  functionSignature: z.any().optional(),
});

// ---------- helpers ----------

// Links from the given pools to tests that are live right now (inside
// their window, or with a student's reopened window currently open).
// Pools are shared by every admin, so this is not filtered by owner.
function activeTestLinks(poolIds) {
  const now = new Date();
  return prisma.testPool.findMany({
    where: {
      poolId: { in: poolIds },
      test: {
        OR: [
          { status: 'SCHEDULED', startTime: { lte: now }, endTime: { gte: now } },
          { attempts: { some: { reopenStartTime: { lte: now }, reopenEndTime: { gte: now } } } },
        ],
      },
    },
    select: {
      poolId: true,
      test: { select: { id: true, title: true, status: true, selectedCategoryIds: true, questionsPerCategory: true } },
    },
  });
}

// Categories a live test draws from. A test without an explicit category
// selection draws from every category in the pool (null = all).
function categoriesUsedByTest(test) {
  const ids = new Set(test.selectedCategoryIds);
  for (const entry of test.questionsPerCategory) ids.add(entry.split(':')[0]);
  return ids.size > 0 ? ids : null;
}

/** Returns { [poolId]: { lockedCategoryIds, activeTest } } for every pool that has a live test. */
async function getLocksByPool(poolIds) {
  if (poolIds.length === 0) return {};
  const links = await activeTestLinks(poolIds);

  const locks = {};
  const lockAllCategories = new Set();
  for (const link of links) {
    if (!locks[link.poolId]) locks[link.poolId] = { ids: new Set(), activeTest: link.test };
    const used = categoriesUsedByTest(link.test);
    if (used === null) lockAllCategories.add(link.poolId);
    else used.forEach((id) => locks[link.poolId].ids.add(id));
  }

  if (lockAllCategories.size > 0) {
    const categories = await prisma.poolCategory.findMany({
      where: { poolId: { in: [...lockAllCategories] } },
      select: { id: true, poolId: true },
    });
    for (const c of categories) locks[c.poolId].ids.add(c.id);
  }

  const result = {};
  for (const [poolId, entry] of Object.entries(locks)) {
    result[poolId] = { lockedCategoryIds: [...entry.ids], activeTest: entry.activeTest };
  }
  return result;
}

/** Returns a Set of category IDs that are locked for this pool. */
async function getLockedCategoryIds(poolId) {
  const locks = await getLocksByPool([poolId]);
  return new Set(locks[poolId]?.lockedCategoryIds ?? []);
}

async function isPoolLive(poolId) {
  const locks = await getLocksByPool([poolId]);
  return Boolean(locks[poolId]);
}

// ---------- pool CRUD ----------

export const listPools = asyncHandler(async (req, res) => {
  const pools = await prisma.pool.findMany({
    include: { _count: { select: { categories: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const locks = await getLocksByPool(pools.map((p) => p.id));

  res.json(pools.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    categoryCount: p._count.categories,
    lockedCategoryIds: locks[p.id]?.lockedCategoryIds ?? [],
    hasActiveTest: Boolean(locks[p.id]),
  })));
});

export const getPoolDetails = asyncHandler(async (req, res) => {
  const { poolId } = req.params;
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: {
      categories: {
        include: {
          questions: {
            include: { testCases: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });
  if (!pool) throw new HttpError(404, 'Pool not found.');

  const lock = (await getLocksByPool([poolId]))[poolId];

  res.json({
    ...pool,
    activeTest: lock?.activeTest ?? null,
    lockedCategoryIds: lock?.lockedCategoryIds ?? [],
    hasActiveTest: Boolean(lock),
  });
});

export const createPool = asyncHandler(async (req, res) => {
  const data = createPoolSchema.parse(req.body);
  const pool = await prisma.pool.create({ data: { name: data.name, description: data.description || '' } });
  res.status(201).json(pool);
});

export const updatePool = asyncHandler(async (req, res) => {
  const { poolId } = req.params;
  const data = updatePoolSchema.parse(req.body);
  if (await isPoolLive(poolId)) throw new HttpError(400, 'Cannot update a pool while it is linked to an active test.');
  const pool = await prisma.pool.update({ where: { id: poolId }, data });
  res.json(pool);
});

export const deletePool = asyncHandler(async (req, res) => {
  const { poolId } = req.params;

  const now = new Date();
  const activeLink = await prisma.testPool.findFirst({
    where: {
      poolId,
      test: {
        OR: [
          { status: { not: 'DRAFT' }, endTime: { gte: now } },
          { attempts: { some: { reopenStartTime: { lte: now }, reopenEndTime: { gte: now } } } },
        ],
      },
    },
  });
  if (activeLink) throw new HttpError(400, 'Cannot delete a pool that is linked to a scheduled, active, or reopened test.');

  await prisma.pool.delete({ where: { id: poolId } });
  res.status(204).send();
});

export const listCategories = asyncHandler(async (req, res) => {
  const { poolId } = req.params;
  const categories = await prisma.poolCategory.findMany({
    where: { poolId },
    include: { _count: { select: { questions: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(categories);
});

export const createCategory = asyncHandler(async (req, res) => {
  const { poolId } = req.params;
  const data = createCategorySchema.parse(req.body);
  if (await isPoolLive(poolId)) throw new HttpError(400, 'Cannot add a category while the pool is linked to an active test.');
  const category = await prisma.poolCategory.create({ data: { poolId, name: data.name } });
  res.status(201).json(category);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const cat = await prisma.poolCategory.findUnique({
    where: { id: categoryId },
    select: { poolId: true, _count: { select: { questions: true } } },
  });
  if (!cat) throw new HttpError(404, 'Category not found.');
  const locked = await getLockedCategoryIds(cat.poolId);
  if (locked.has(categoryId)) throw new HttpError(400, 'Cannot delete a category that is locked by an active test.');
  if (cat._count.questions > 0) {
    throw new HttpError(409, 'This category still has questions. Delete or move them to another category first.');
  }
  await prisma.poolCategory.delete({ where: { id: categoryId } });
  res.status(204).send();
});

export const listQuestions = asyncHandler(async (req, res) => {
  const { poolId } = req.params;
  const { categoryId } = req.query;
  const where = { poolId };
  if (typeof categoryId === 'string' && categoryId) where.categoryId = categoryId;
  const questions = await prisma.poolQuestion.findMany({
    where,
    include: { testCases: true, category: true },
    orderBy: { order: 'asc' },
  });
  res.json(questions);
});

export const createQuestion = asyncHandler(async (req, res) => {
  const { poolId } = req.params;
  const data = createQuestionSchema.parse(req.body);

  const category = await prisma.poolCategory.findFirst({ where: { id: data.categoryId, poolId } });
  if (!category) throw new HttpError(400, 'Category not found in this pool.');

  const locked = await getLockedCategoryIds(poolId);
  if (locked.has(data.categoryId)) throw new HttpError(400, 'Cannot add a question to a locked category.');

  const currentCount = await prisma.poolQuestion.count({ where: { poolId } });

  const functionTemplates = data.functionSignature
    ? generateTemplates(data.functionSignature)
    : undefined;

  const question = await prisma.poolQuestion.create({
    data: {
      poolId,
      categoryId: data.categoryId,
      order: currentCount,
      title: data.title,
      statement: data.statement,
      points: data.points,
      timeAllottedMinutes: data.timeAllottedMinutes,
      difficulty: data.difficulty,
      constraints: data.constraints,
      type: data.type,
      modelAnswer: data.type === 'SUBJECTIVE' ? data.modelAnswer : undefined,
      timeLimitSecs: data.timeLimitSecs,
      memoryLimitMB: data.memoryLimitMB,
      functionSignature: data.functionSignature || undefined,
      functionTemplates: functionTemplates || undefined,
      ...(data.type !== 'SUBJECTIVE' && data.testCases.length > 0 ? {
        testCases: {
          create: data.testCases.map((tc, i) => ({
            input: tc.input,
            output: tc.output,
            isSample: tc.isSample,
            order: i,
          })),
        },
      } : {}),
    },
    include: { testCases: true, category: true },
  });

  res.status(201).json(question);
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const data = updateQuestionSchema.parse(req.body);

  const existing = await prisma.poolQuestion.findUnique({ where: { id: questionId } });
  if (!existing) throw new HttpError(404, 'Question not found.');

  if (data.categoryId) {
    const target = await prisma.poolCategory.findFirst({ where: { id: data.categoryId, poolId: existing.poolId }, select: { id: true } });
    if (!target) throw new HttpError(400, 'Category not found in this pool.');
  }

  const targetCategoryId = data.categoryId ?? existing.categoryId;
  const locked = await getLockedCategoryIds(existing.poolId);
  if (locked.has(existing.categoryId) || locked.has(targetCategoryId)) {
    throw new HttpError(400, 'Cannot update a question in a locked category.');
  }

  const updateData = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.statement !== undefined) updateData.statement = data.statement;
  if (data.points !== undefined) updateData.points = data.points;
  if (data.timeAllottedMinutes !== undefined) updateData.timeAllottedMinutes = data.timeAllottedMinutes;
  if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
  if (data.constraints !== undefined) updateData.constraints = data.constraints;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.modelAnswer !== undefined) updateData.modelAnswer = data.modelAnswer;
  if (data.timeLimitSecs !== undefined) updateData.timeLimitSecs = data.timeLimitSecs;
  if (data.memoryLimitMB !== undefined) updateData.memoryLimitMB = data.memoryLimitMB;
  if (data.functionSignature !== undefined) {
    updateData.functionSignature = data.functionSignature;
    updateData.functionTemplates = generateTemplates(data.functionSignature);
  }

  if (data.testCases) {
    // Replaced inside the same update so a failure can't lose test cases.
    updateData.testCases = {
      deleteMany: {},
      create: data.testCases.map((tc, i) => ({
        input: tc.input,
        output: tc.output,
        isSample: tc.isSample,
        order: i,
      })),
    };
  }

  const question = await prisma.poolQuestion.update({
    where: { id: questionId },
    data: updateData,
    include: { testCases: true, category: true },
  });

  res.json(question);
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const existing = await prisma.poolQuestion.findUnique({ where: { id: questionId }, select: { poolId: true, categoryId: true } });
  if (!existing) throw new HttpError(404, 'Question not found.');
  const locked = await getLockedCategoryIds(existing.poolId);
  if (locked.has(existing.categoryId)) throw new HttpError(400, 'Cannot delete a question from a locked category.');
  await prisma.poolQuestion.delete({ where: { id: questionId } });
  res.status(204).send();
});
