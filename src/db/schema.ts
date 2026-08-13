import { boolean, date, integer, pgTable, text, timestamp, uniqueIndex, bigserial, bigint } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  username: text('username').unique(),
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  age: integer('age').notNull().default(0),
  role: text('role').notNull().default('student'),
  allUnlocked: boolean('all_unlocked').notNull().default(false),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const otpCodes = pgTable('otp_codes', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  purpose: text('purpose').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

export const userLessonProgress = pgTable(
  'user_lesson_progress',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    groupId: integer('group_id').notNull(),
    letterId: text('letter_id').notNull(),
    status: text('status').notNull().default('completed'),
    stars: integer('stars').notNull().default(0),
    xp: integer('xp').notNull().default(0),
    bestScore: integer('best_score').notNull().default(0),
    attemptsCount: integer('attempts_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userLessonUnique: uniqueIndex('user_lesson_progress_user_group_letter_idx').on(table.userId, table.groupId, table.letterId),
  })
);

export const lessonAttempts = pgTable('lesson_attempts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupId: integer('group_id').notNull(),
  letterId: text('letter_id').notNull(),
  starsEarned: integer('stars_earned').notNull().default(0),
  xpEarned: integer('xp_earned').notNull().default(0),
  score: integer('score').notNull().default(0),
  durationSeconds: integer('duration_seconds'),
  completed: boolean('completed').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groupExamAttempts = pgTable('group_exam_attempts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  groupId: integer('group_id').notNull(),
  score: integer('score').notNull().default(0),
  passed: boolean('passed').notNull().default(false),
  xpEarned: integer('xp_earned').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userStats = pgTable('user_stats', {
  userId: bigint('user_id', { mode: 'number' }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  totalXp: integer('total_xp').notNull().default(0),
  totalStars: integer('total_stars').notNull().default(0),
  currentStreakDays: integer('current_streak_days').notNull().default(0),
  longestStreakDays: integer('longest_streak_days').notNull().default(0),
  lastActivityDate: date('last_activity_date'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dailyActivity = pgTable(
  'daily_activity',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
    activityDate: date('activity_date').notNull(),
    lessonsCompleted: integer('lessons_completed').notNull().default(0),
    xpEarned: integer('xp_earned').notNull().default(0),
    starsEarned: integer('stars_earned').notNull().default(0),
  },
  (table) => ({
    userActivityDateUnique: uniqueIndex('daily_activity_user_date_idx').on(table.userId, table.activityDate),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserLessonProgress = typeof userLessonProgress.$inferSelect;
export type NewUserLessonProgress = typeof userLessonProgress.$inferInsert;
