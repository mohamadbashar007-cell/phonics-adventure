import { initDb, closeDb } from '../src/db/index.ts';
import { appRouter } from '../src/server/router.ts';

try {
  await initDb();
  const caller = appRouter.createCaller({});
  const login = await caller.login({ email: 'dev@dev.dev', password: '1111' });
  const progress = await caller.getUserProgress({ userId: login.userId });
  const trialLogin = await caller.login({ email: 'trial@trial.dev', password: '2222' });
  const trialProgress = await caller.getUserProgress({ userId: trialLogin.userId });
  console.log(JSON.stringify({
    developer: {
      username: login.username,
      allUnlocked: login.allUnlocked,
      progressItems: progress.length,
    },
    trial: {
      username: trialLogin.username,
      allUnlocked: trialLogin.allUnlocked,
      progressItems: trialProgress.length,
    },
  }));
} finally {
  await closeDb();
}
