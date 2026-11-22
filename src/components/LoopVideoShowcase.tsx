import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  Sparkles,
  Camera,
  Film,
} from "lucide-react";
import type { HomepageVideo, HomepagePhoto } from "@/lib/local-homepage-store";

interface LoopVideoShowcaseProps {
  video: HomepageVideo | null;
  allVideos?: HomepageVideo[];
  onOpenGallery?: () => void;
  featuredPhotos?: HomepagePhoto[];
}

export function LoopVideoShowcase({
  video,
  allVideos = [],
  onOpenGallery,
  featuredPhotos = [],
}: LoopVideoShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentVideo, setCurrentVideo] = useState<HomepageVideo | null>(video);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // muted by default for seamless browser autoplay
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    if (video) setCurrentVideo(video);
  }, [video]);

  const activeVideoUrl =
    currentVideo?.video_url ||
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  const activeThumbnail =
    currentVideo?.thumbnail_url || "/assets/student-affairs-reference.jpg";

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    // Autoplay in loop
    vid.loop = true;
    vid.muted = true;
    vid.play().catch(() => {
      // Browser autoplay policy might pause until user interaction
      setIsPlaying(false);
    });
  }, [activeVideoUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="w-full">
      {/* Outer Warm Terracotta / Amber Gradient Accent Frame matching user's concept */}
      <div className="relative rounded-3xl p-1 sm:p-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 shadow-2xl">
        {/* Main Video Box */}
        <div
          ref={containerRef}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
          className="relative w-full aspect-[16/9] md:aspect-[21/9] min-h-[320px] sm:min-h-[420px] md:min-h-[480px] bg-slate-950 rounded-[22px] overflow-hidden group select-none flex items-center justify-center shadow-inner"
        >
          {/* HTML5 Video playing in loop */}
          <video
            ref={videoRef}
            src={activeVideoUrl}
            poster={activeThumbnail}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onClick={togglePlay}
            className="w-full h-full object-cover cursor-pointer"
          />

          {/* Top Floating Badges */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-2 pointer-events-none">
            {/* Loop Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-bold shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="tracking-wide">Videos will play in loop</span>
            </div>

            {/* Title / Campus Tag */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/90 backdrop-blur-md text-slate-950 text-xs font-black shadow-lg">
              <Sparkles className="h-3.5 w-3.5 fill-current" />
              <span>GNITS Campus Spotlight</span>
            </div>
          </div>

          {/* Center Play/Pause Overlay indicator when paused */}
          {!isPlaying && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center cursor-pointer"
            >
              <div className="h-20 w-20 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                <Play className="h-10 w-10 fill-current ml-1" />
              </div>
              <span className="mt-3 text-white font-extrabold text-sm sm:text-base drop-shadow-md">
                Click to Resume Loop Playback
              </span>
            </div>
          )}

          {/* Floating Controls Bar */}
          <div
            className={`absolute bottom-0 inset-x-0 z-30 p-3 sm:p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
              showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {/* Title Overlay */}
            <div className="mb-2 px-1">
              <h3 className="text-sm sm:text-base md:text-lg font-black text-white drop-shadow-md line-clamp-1">
                {currentVideo?.title || "GNITS Campus Life & Student Forum Highlights"}
              </h3>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center gap-2 sm:gap-3 rounded-2xl bg-white/10 backdrop-blur-md px-3 sm:px-4 py-2 border border-white/20 text-white shadow-xl">
              {/* Play/Pause */}
              <button
                type="button"
                onClick={togglePlay}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
              </button>

              {/* Time */}
              <span className="text-xs font-mono font-semibold text-slate-200 min-w-[70px] sm:min-w-[85px] text-center">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Seeker */}
              <div className="flex-1 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:h-2 transition-all"
                />
              </div>

              {/* Audio / Mute toggle with prominent status */}
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition-colors cursor-pointer"
                title={isMuted ? "Click to enable audio" : "Mute audio"}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="h-4 w-4 text-amber-300" />
                    <span className="hidden sm:inline text-[11px] text-amber-200">Unmute</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 text-emerald-300" />
                    <span className="hidden sm:inline text-[11px] text-emerald-200">Sound On</span>
                  </>
                )}
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                aria-label="Fullscreen"
              >
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-bar below Video: Video Playlist Switcher & Daily Photos Gallery Trigger */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
        {/* Available Videos Pill list if multiple videos uploaded */}
        {allVideos.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Film className="h-3.5 w-3.5" />
              <span>Campus Reels:</span>
            </span>
            {allVideos.map((vid) => (
              <button
                key={vid.id}
                type="button"
                onClick={() => setCurrentVideo(vid)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  currentVideo?.id === vid.id
                    ? "bg-[#2563eb] text-white shadow-xs"
                    : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {vid.title}
              </button>
            ))}
          </div>
        )}

        {/* View Daily Photos Gallery Quick Button */}
        {onOpenGallery && (
          <button
            type="button"
            onClick={onOpenGallery}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 shadow-xs text-xs font-bold text-slate-800 hover:text-[#2563eb] transition-colors cursor-pointer"
          >
            <Camera className="h-4 w-4 text-[#2563eb]" />
            <span>View Campus Daily Photos Gallery ({featuredPhotos.length}+)</span>
          </button>
        )}
      </div>
    </div>
  );
}
