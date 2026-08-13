import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import superjson from 'superjson';
import bcrypt from 'bcryptjs';
import { query, refreshUserStats } from '../db';
import { sendOtpEmail } from './email';

const t = initTRPC.create({
  transformer: superjson as any,
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function starsToXp(stars: number) {
  return Math.max(0, Math.min(3, stars)) * 10;
}

function createOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function storeOtp(input: { userId?: number; email: string; purpose: 'verify_email' | 'password_reset'; code: string }) {
  const codeHash = await bcrypt.hash(input.code, 10);
  await query(
    `INSERT INTO otp_codes (user_id, email, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
    [input.userId ?? null, input.email, input.purpose, codeHash]
  );
}

async function verifyOtp(input: { email: string; purpose: 'verify_email' | 'password_reset'; code: string }) {
  const result = await query<{
    id: string;
    user_id: string | null;
    code_hash: string;
    attempts: number;
  }>(
    `SELECT id, user_id, code_hash, attempts
     FROM otp_codes
     WHERE email = $1
       AND purpose = $2
       AND consumed_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.email, input.purpose]
  );

  const otp = result.rows[0];
  if (!otp) {
    throw new Error('Code is invalid or expired');
  }

  if (otp.attempts >= 5) {
    throw new Error('Too many attempts. Request a new code.');
  }

  const ok = await bcrypt.compare(input.code, otp.code_hash);
  if (!ok) {
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    throw new Error('Code is incorrect');
  }

  await query('UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1', [otp.id]);
  return { userId: otp.user_id ? Number(otp.user_id) : null };
}

export const appRouter = t.router({
  getCurriculum: t.procedure.query(async () => {
    return { success: true };
  }),

  startRegister: t.procedure
    .input(
      z.object({
        email: z.string().email({ message: 'Valid email is required' }),
        password: z.string().min(4, { message: 'Password must be at least 4 characters' }),
        name: z.string().min(1, { message: 'Name is required' }),
        age: z.number().int().min(0, { message: 'Age must be a positive number' }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const email = normalizeEmail(input.email);
        const existing = await query<{
          id: string;
          email_verified_at: Date | null;
          disabled_at: Date | null;
        }>('SELECT id, email_verified_at, disabled_at FROM users WHERE email = $1', [email]);

        const existingUser = existing.rows[0];
        if (existingUser?.disabled_at) {
          throw new Error('Account is disabled');
        }
        if (existingUser?.email_verified_at) {
          throw new Error('Email already has an account');
        }

        const passwordHash = await bcrypt.hash(input.password, 12);
        let userId = existingUser ? Number(existingUser.id) : null;

        if (userId) {
          await query(
            `UPDATE users
             SET password_hash = $1, name = $2, age = $3, updated_at = NOW()
             WHERE id = $4`,
            [passwordHash, input.name.trim(), input.age, userId]
          );
        } else {
          const inserted = await query<{ id: string }>(
            `INSERT INTO users (username, email, password_hash, name, age, role, all_unlocked)
           VALUES ($1, $2, $3, $4, $5, 'student', FALSE)
           RETURNING id`,
            [email, email, passwordHash, input.name.trim(), input.age]
          );
          userId = Number(inserted.rows[0].id);
        }

        await query('INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);

        const code = createOtpCode();
        await storeOtp({ userId, email, purpose: 'verify_email', code });
        await sendOtpEmail(email, code, 'verify_email');

        return {
          success: true,
          email,
          message: 'Verification code sent.',
        };
      } catch (error: any) {
        console.error('Registration error:', error);
        throw new Error(error?.message || 'Failed to create user');
      }
    }),

  verifyRegisterOtp: t.procedure
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/, { message: 'Code must be 6 digits' }),
      })
    )
    .mutation(async ({ input }) => {
      const email = normalizeEmail(input.email);
      const verified = await verifyOtp({ email, code: input.code, purpose: 'verify_email' });
      const result = await query<{
        id: string;
        email: string;
        name: string;
        age: number;
        all_unlocked: boolean;
      }>(
        `UPDATE users
         SET email_verified_at = COALESCE(email_verified_at, NOW()), last_login_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND email = $2 AND disabled_at IS NULL
         RETURNING id, email, name, age, all_unlocked`,
        [verified.userId, email]
      );

      const user = result.rows[0];
      if (!user) {
        throw new Error('Unable to verify account');
      }

      return {
        success: true,
        username: user.email,
        name: user.name,
        age: user.age || 0,
        userId: Number(user.id),
        allUnlocked: Boolean(user.all_unlocked),
        message: 'Email verified.',
      };
    }),

  login: t.procedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const email = normalizeEmail(input.email);
        const result = await query<{
          id: string;
          email: string;
          name: string;
          age: number;
          all_unlocked: boolean;
          password_hash: string;
          email_verified_at: Date | null;
          disabled_at: Date | null;
        }>(
          `SELECT id, email, name, age, all_unlocked, password_hash, email_verified_at, disabled_at
           FROM users
           WHERE email = $1`,
          [email]
        );

        const user = result.rows[0];
        if (!user || user.disabled_at) {
          throw new Error('Username or password incorrect');
        }

        const passwordMatch = await bcrypt.compare(input.password, user.password_hash);
        if (!passwordMatch) {
          throw new Error('Username or password incorrect');
        }
        if (!user.email_verified_at) {
          const code = createOtpCode();
          await storeOtp({ userId: Number(user.id), email, purpose: 'verify_email', code });
          await sendOtpEmail(email, code, 'verify_email');
          throw new Error('Email is not verified. We sent you a new code.');
        }

        await query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);

        return {
          success: true,
          username: user.email,
          name: user.name,
          age: user.age || 0,
          userId: Number(user.id),
          allUnlocked: Boolean(user.all_unlocked),
          message: 'Login successful!',
        };
      } catch (error: any) {
        console.error('Login error:', error);
        throw new Error(error?.message || 'Login failed');
      }
    }),

  requestPasswordReset: t.procedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const email = normalizeEmail(input.email);
      const result = await query<{ id: string; disabled_at: Date | null }>('SELECT id, disabled_at FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (user && !user.disabled_at) {
        const code = createOtpCode();
        await storeOtp({ userId: Number(user.id), email, purpose: 'password_reset', code });
        await sendOtpEmail(email, code, 'password_reset');
      }

      return { success: true, message: 'If the email exists, a reset code has been sent.' };
    }),

  resetPasswordWithOtp: t.procedure
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/, { message: 'Code must be 6 digits' }),
        password: z.string().min(4, { message: 'Password must be at least 4 characters' }),
      })
    )
    .mutation(async ({ input }) => {
      const email = normalizeEmail(input.email);
      const verified = await verifyOtp({ email, code: input.code, purpose: 'password_reset' });
      const passwordHash = await bcrypt.hash(input.password, 12);

      await query(
        `UPDATE users
         SET password_hash = $1,
             email_verified_at = COALESCE(email_verified_at, NOW()),
             updated_at = NOW()
         WHERE id = $2 AND email = $3 AND disabled_at IS NULL`,
        [passwordHash, verified.userId, email]
      );

      return { success: true, message: 'Password updated. You can login now.' };
    }),

  getUserProgress: t.procedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      try {
        const result = await query<{
          id: string;
          group_id: number;
          letter_id: string;
          stars: number;
        }>(
          `SELECT id, group_id, letter_id, stars
           FROM user_lesson_progress
           WHERE user_id = $1 AND status = 'completed'
           ORDER BY group_id, letter_id`,
          [input.userId]
        );

        return result.rows.map((row) => ({
          groupId: row.group_id,
          letterId: row.letter_id,
          stars: row.stars,
        }));
      } catch (error: any) {
        console.error('Get progress error:', error);
        return [];
      }
    }),

  saveProgress: t.procedure
    .input(
      z.object({
        userId: z.number(),
        groupId: z.number(),
        letterId: z.string(),
        stars: z.number().int().min(0).max(3),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const xp = starsToXp(input.stars);

        await query(
          `INSERT INTO user_lesson_progress
            (user_id, group_id, letter_id, status, stars, xp, best_score, attempts_count, started_at, completed_at)
           VALUES ($1, $2, $3, 'completed', $4, $5, $6, 1, NOW(), NOW())
           ON CONFLICT (user_id, group_id, letter_id)
           DO UPDATE SET
            stars = GREATEST(user_lesson_progress.stars, EXCLUDED.stars),
            xp = GREATEST(user_lesson_progress.xp, EXCLUDED.xp),
            best_score = GREATEST(user_lesson_progress.best_score, EXCLUDED.best_score),
            attempts_count = user_lesson_progress.attempts_count + 1,
            status = 'completed',
            completed_at = COALESCE(user_lesson_progress.completed_at, NOW()),
            updated_at = NOW()`,
          [input.userId, input.groupId, input.letterId, input.stars, xp, input.stars * 100]
        );

        await query(
          `INSERT INTO lesson_attempts
            (user_id, group_id, letter_id, stars_earned, xp_earned, score, completed)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
          [input.userId, input.groupId, input.letterId, input.stars, xp, input.stars * 100]
        );

        await query(
          `INSERT INTO daily_activity
            (user_id, activity_date, lessons_completed, xp_earned, stars_earned)
           VALUES ($1, CURRENT_DATE, 1, $2, $3)
           ON CONFLICT (user_id, activity_date)
           DO UPDATE SET
            lessons_completed = daily_activity.lessons_completed + 1,
            xp_earned = daily_activity.xp_earned + EXCLUDED.xp_earned,
            stars_earned = daily_activity.stars_earned + EXCLUDED.stars_earned`,
          [input.userId, xp, input.stars]
        );

        await refreshUserStats(input.userId);

        return { success: true };
      } catch (error: any) {
        console.error('Save progress error:', error);
        throw new Error(error?.message || 'Failed to save progress');
      }
    }),

  saveExamAttempt: t.procedure
    .input(
      z.object({
        userId: z.number(),
        groupId: z.number(),
        score: z.number().int().min(0).max(100),
      })
    )
    .mutation(async ({ input }) => {
      const passed = input.score >= 80;
      const xp = passed ? 50 : 10;

      await query(
        `INSERT INTO group_exam_attempts (user_id, group_id, score, passed, xp_earned)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.userId, input.groupId, input.score, passed, xp]
      );

      return { success: true, passed };
    }),

  logout: t.procedure.mutation(async () => {
    return { success: true };
  }),
});

export type AppRouter = typeof appRouter;
