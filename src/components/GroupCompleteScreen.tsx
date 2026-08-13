import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

interface GroupCompleteScreenProps {
  groupId: number;
  starsEarned: number;
  nextGroupId: number | null;
}

export default function GroupCompleteScreen({ groupId, starsEarned, nextGroupId }: GroupCompleteScreenProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocation('/');
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-yellow-50 via-peach-50 to-pink-100 flex items-center justify-center p-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="group-burst" />
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={
              {
                left: `${(i % 12) * 8 + 4}%`,
                animationDelay: `${(i % 6) * 0.18}s`,
                animationDuration: `${2.4 + (i % 4) * 0.35}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-xl rounded-3xl bg-white/90 backdrop-blur-sm shadow-2xl p-8 text-center border-4 border-yellow-200">
        <h1 className="text-3xl md:text-5xl font-black text-gray-800 mb-4">🎉 Great job! You finished Group {groupId}!</h1>
        <p className="text-xl md:text-2xl font-bold text-yellow-700 mb-8">You earned ⭐ {starsEarned} stars!</p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          {nextGroupId ? (
            <button
              onClick={() => setLocation(`/group/${nextGroupId}?autostart=1`)}
              className="rounded-full bg-blue-600 px-7 py-3 text-white text-lg font-black hover:bg-blue-700 transition-colors"
            >
              Next Group →
            </button>
          ) : null}
          <button
            onClick={() => setLocation('/')}
            className="rounded-full bg-green-600 px-7 py-3 text-white text-lg font-black hover:bg-green-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
