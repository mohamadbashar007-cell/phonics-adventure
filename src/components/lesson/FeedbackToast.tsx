import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export type FeedbackToastState = {
  type: 'success' | 'error' | 'warning';
  text: string;
} | null;

interface FeedbackToastProps {
  feedback: FeedbackToastState;
}

export default function FeedbackToast({ feedback }: FeedbackToastProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[10000] flex justify-center px-4">
      <AnimatePresence>
        {feedback && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 32, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className={`flex max-w-full items-center gap-3 rounded-2xl border-4 border-white/90 px-6 py-3 text-lg font-black text-white shadow-2xl md:px-8 md:text-xl ${
              feedback.type === 'success'
                ? 'bg-green-500'
                : feedback.type === 'warning'
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-red-500'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check className="shrink-0" size={28} strokeWidth={3.5} />
            ) : feedback.type === 'warning' ? (
              <AlertTriangle className="shrink-0" size={27} strokeWidth={3} />
            ) : (
              <X className="shrink-0" size={28} strokeWidth={3.5} />
            )}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
