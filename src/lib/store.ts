import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getGroupLetterCount } from '../data/curriculumMeta';

interface ProgressItem {
  groupId: number;
  letterId: string;
  stars: number;
}

interface ExamScore {
  groupId: number;
  score: number;
  passed: boolean;
  date: string;
}

interface UserProfile {
  name: string;
  age: number;
  hasSetupProfile: boolean;
}

interface ProgressState {
  username: string;
  userId: number | null;
  userName: string; // Display name
  age: number;
  allUnlocked: boolean;
  isAuthenticated: boolean;
  profile: UserProfile | null;
  progress: ProgressItem[];
  examScores: ExamScore[];
  setProfile: (profile: UserProfile) => void;
  setUsername: (username: string) => void;
  setUserId: (userId: number) => void;
  setUserName: (userName: string) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setAge: (age: number) => void;
  setAllUnlocked: (allUnlocked: boolean) => void;
  signOut: () => void;
  addProgress: (item: ProgressItem) => void;
  addExamScore: (score: ExamScore) => void;
  getExamScore: (groupId: number) => ExamScore | undefined;
  isGroupUnlocked: (groupId: number) => boolean;
  isLetterCompleted: (groupId: number, letterId: string) => boolean;
  isGroupExamPassed: (groupId: number) => boolean;
  getGroupProgress: (groupId: number) => { completedLetters: number; totalLetters: number };
  getGroupCompletionPercentage: (groupId: number) => number;
  getTotalStars: () => number;
  getCompletedGroups: () => number;
  getAverageScore: () => number;
  initializeProgress: () => void;
}

// This is a simplified version of the store for the demo
// In a real app, we'd use the tRPC mutations to sync
export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      username: 'preview',
      userId: null,
      userName: 'Preview Explorer',
      age: 0,
      allUnlocked: true,
      isAuthenticated: true,
      profile: { name: 'Preview Explorer', age: 0, hasSetupProfile: true },
      progress: [],
      examScores: [],
      
      setProfile: (profile) => set({ profile }),
      
      setUsername: (username) => set({ username }),

      setUserId: (userId) => set({ userId }),

      setUserName: (userName) => set({ userName }),

      setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

      setAge: (age) => set({ age }),

      setAllUnlocked: () => set({ allUnlocked: true }),

      signOut: () =>
        set({
          username: 'preview',
          userId: null,
          userName: 'Preview Explorer',
          age: 0,
          allUnlocked: true,
          isAuthenticated: true,
          profile: { name: 'Preview Explorer', age: 0, hasSetupProfile: true },
          progress: [],
          examScores: [],
        }),
      
      addProgress: (item) => set((state) => {
        const existing = state.progress.find(
          (p) => p.groupId === item.groupId && p.letterId === item.letterId
        );
        if (existing) {
          if (item.stars > existing.stars) {
            return {
              progress: state.progress.map((p) =>
                p.groupId === item.groupId && p.letterId === item.letterId
                  ? { ...p, stars: item.stars }
                  : p
              ),
            };
          }
          return state;
        }
        return { progress: [...state.progress, item] };
      }),
      
      addExamScore: (score) => set((state) => {
        const existing = state.examScores.find((e) => e.groupId === score.groupId);
        if (existing && score.score <= existing.score) {
          return state;
        }
        return {
          examScores: existing
            ? state.examScores.map((e) => (e.groupId === score.groupId ? score : e))
            : [...state.examScores, score],
        };
      }),
      
      getExamScore: (groupId) => {
        return get().examScores.find((e) => e.groupId === groupId);
      },
      
      isGroupUnlocked: () => true,
      
      isGroupExamPassed: (groupId) => {
        const examScore = get().getExamScore(groupId);
        return examScore?.passed ?? false;
      },
      
      isLetterCompleted: (groupId, letterId) => {
        return get().progress.some((p) => p.groupId === groupId && p.letterId === letterId);
      },
      
      getGroupProgress: (groupId) => {
        const groupLetters = get().progress.filter((p) => p.groupId === groupId);
        const totalLetters = getGroupLetterCount(groupId);
        return { completedLetters: groupLetters.length, totalLetters };
      },
      
      getGroupCompletionPercentage: (groupId) => {
        const { completedLetters, totalLetters } = get().getGroupProgress(groupId);
        if (totalLetters === 0) return 0;
        return Math.min(100, (completedLetters / totalLetters) * 100);
      },
      
      getTotalStars: () => {
        return get().progress.reduce((acc, p) => acc + p.stars, 0);
      },
      
      getCompletedGroups: () => {
        return get().examScores.filter((e) => e.passed).length;
      },
      
      getAverageScore: () => {
        const scores = get().examScores;
        if (scores.length === 0) return 0;
        const total = scores.reduce((acc, e) => acc + e.score, 0);
        return Math.round(total / scores.length);
      },
      
      initializeProgress: () => {
        // Initial setup if needed
      },
    }),
    {
      name: 'phonics-preview-progress',
    }
  )
);
