import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Loader2, Play, X } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { handleImageError } from '../../utils/imagePaths';
import { getStoryVideoPath, preloadVideo } from '../../utils/storyVideos';
import { assetUrl } from '../../utils/assetUrl';
import { getStoryAudioPath } from '../../utils/audioPaths';

interface StoryScreenProps {
  letter: any;
  onComplete: () => void;
}

export default function StoryScreen({ letter, onComplete }: StoryScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const videoSrc = getStoryVideoPath(letter);
  const storyAudioSrc = getStoryAudioPath(letter);
  const hasStoryAudio = Boolean(storyAudioSrc);
  const resolvedStoryImageSrc = letter.story?.image ? assetUrl(letter.story.image) : '';
  const storyImageSrc =
    resolvedStoryImageSrc && imageKey > 0
      ? `${resolvedStoryImageSrc}${resolvedStoryImageSrc.includes('?') ? '&' : '?'}retry=${imageKey}`
      : resolvedStoryImageSrc;

  useEffect(() => {
    if (storyAudioSrc) {
      audioService.preloadAudioFile(storyAudioSrc);
    }
  }, [storyAudioSrc]);

  useEffect(() => {
    if (!isVideoOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeVideo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoOpen]);

  const closeVideo = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    setIsVideoOpen(false);
    setIsVideoLoading(false);
  };

  const openVideo = () => {
    setVideoFailed(false);
    setIsVideoLoading(true);
    setIsVideoOpen(true);
  };

  const warmVideoMetadata = () => {
    preloadVideo(videoSrc, 'metadata');
  };

  const openVideoDirectly = () => {
    if (videoSrc) {
      window.open(videoSrc, '_blank', 'noopener,noreferrer');
    }
  };

  const handleReadAloud = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const playedAudioFile = storyAudioSrc ? await audioService.playAudioFile(storyAudioSrc) : false;
      if (!playedAudioFile) {
        const textToRead = letter.story?.text || letter.soundDescription;
        await audioService.speak(textToRead);
      }
    } catch (error) {
      console.error("Audio service error in StoryScreen:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshImage = () => {
    setImageKey(prev => prev + 1);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center p-3 text-center md:p-6">
      <div className="grid w-full grid-cols-1 items-center gap-3 md:grid-cols-2 md:gap-8">
        {/* Visual Side */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex flex-col items-center"
        >
          <div className="relative mb-2 md:mb-6">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="rounded-full border-4 border-peach-200 bg-white p-3 shadow-2xl md:border-8 md:p-8"
            >
              <span className="text-5xl font-black text-blue-600 md:text-9xl">{letter.letter}</span>
            </motion.div>
          </div>

          {letter.story?.image && (
            <div className="relative group">
              <motion.img
                key={imageKey}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                src={storyImageSrc}
                alt={`Story for ${letter.letter}`}
                onError={handleImageError}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="max-h-[210px] w-full max-w-[240px] rounded-2xl border-4 border-white bg-white p-1 object-contain shadow-xl md:max-h-none md:max-w-sm md:rounded-3xl md:p-2"
              />
              <button
                onClick={handleRefreshImage}
                className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-blue-600"
                title="Refresh Image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              </button>
            </div>
          )}
        </motion.div>

        {/* Content Side */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="text-left"
        >
          <h2 className="mb-2 text-2xl font-black text-gray-800 md:mb-6 md:text-4xl">
            The Story of '{letter.letter}'
          </h2>

          <div className="relative mb-3 rounded-3xl border-2 border-peach-100 bg-white p-3 shadow-lg md:mb-8 md:p-8">
            <p className="mb-3 text-sm leading-relaxed text-gray-700 md:mb-6 md:text-xl">
              {letter.story?.text || "Let's learn the sound of this letter!"}
            </p>
            
            <div className="mb-3 flex flex-wrap items-center gap-2 md:mb-6 md:gap-4">
              <button
                onClick={handleReadAloud}
                disabled={isLoading}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-md transition-all md:gap-3 md:px-6 md:py-3 md:text-base ${
                  isLoading 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-yellow-400 text-gray-800 hover:bg-yellow-500 active:scale-95'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <Volume2 size={24} />
                )}
                {isLoading
                  ? hasStoryAudio
                    ? "Playing..."
                    : "Reading..."
                  : hasStoryAudio
                  ? "Play Story Audio"
                  : "Read Aloud"}
              </button>
              {videoSrc && (
                <>
                  <button
                    type="button"
                    onClick={openVideo}
                    onMouseEnter={warmVideoMetadata}
                    onFocus={warmVideoMetadata}
                    className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95 md:gap-3 md:px-6 md:py-3 md:text-base"
                  >
                    <Play size={24} />
                    Play Video
                  </button>
                  <button
                    type="button"
                    onClick={openVideoDirectly}
                    className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-md ring-2 ring-blue-200 transition-all hover:bg-blue-50 active:scale-95 md:px-4 md:py-3 md:text-base"
                  >
                    Open Video
                  </button>
                </>
              )}
              {hasStoryAudio && (
                <p className="text-sm text-gray-500">
                  Story narration provided.
                </p>
              )}
            </div>

            <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 p-3 md:p-4">
              <p className="text-base font-bold text-blue-600 md:text-lg">
                <span className="text-gray-500 font-medium">Action:</span> {letter.action}
              </p>
              <p className="text-sm text-blue-400 mt-1 italic">
                {letter.soundDescription}
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onComplete}
            className="w-full rounded-full bg-blue-600 py-3 text-xl font-black text-white shadow-xl transition-colors hover:bg-blue-700 md:py-4 md:text-2xl"
          >
            Start Learning ➜
          </motion.button>
        </motion.div>
      </div>

      {isVideoOpen && videoSrc && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-3 md:p-4"
          onMouseDown={closeVideo}
        >
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeVideo();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeVideo();
            }}
            className="fixed right-4 top-4 z-[1002] flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-900 shadow-2xl hover:bg-gray-100"
            aria-label="Close video"
          >
            <X size={28} />
          </button>
          <div
            className="relative z-[1001] w-full max-w-5xl rounded-2xl bg-black shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                closeVideo();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                closeVideo();
              }}
              className="absolute -right-2 -top-12 z-[1002] flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg hover:bg-gray-100"
              aria-label="Close video"
            >
              <X size={24} />
            </button>
            <video
              key={videoSrc}
              ref={videoRef}
              src={videoSrc}
              controls
              autoPlay
              playsInline
              preload="auto"
              onLoadStart={() => setIsVideoLoading(true)}
              onWaiting={() => setIsVideoLoading(true)}
              onPlaying={() => setIsVideoLoading(false)}
              onError={() => {
                setIsVideoLoading(false);
                setVideoFailed(true);
              }}
              onCanPlay={() => {
                setIsVideoLoading(false);
                setVideoFailed(false);
              }}
              className="h-auto max-h-[86dvh] w-full rounded-2xl bg-black"
            />
            {isVideoLoading && !videoFailed && (
              <div className="pointer-events-none absolute inset-0 z-[1001] flex items-center justify-center rounded-2xl bg-black/35 text-white">
                <Loader2 className="animate-spin" size={42} />
              </div>
            )}
            {videoFailed && (
              <div className="absolute inset-x-4 bottom-4 z-[1002] rounded-xl bg-white p-4 text-center shadow-xl">
                <p className="mb-3 font-bold text-gray-800">Video could not play here.</p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openVideoDirectly();
                  }}
                  className="rounded-full bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700"
                >
                  Open Video
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
