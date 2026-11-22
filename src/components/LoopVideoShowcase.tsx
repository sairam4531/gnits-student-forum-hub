import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sparkles,
  Camera,
  Film,
  ChevronDown,
} from "lucide-react";
import type { HomepageVideo, HomepagePhoto } from "@/lib/local-homepage-store";

interface LoopVideoShowcaseProps {
  video: HomepageVideo | null;
  allVideos?: HomepageVideo[];
  onOpenGallery?: () => void;
  featuredPhotos?: HomepagePhoto[];
  onScrollToDean?: () => void;
}

export function LoopVideoShowcase({
  video,
  allVideos = [],
  onOpenGallery,
  featuredPhotos = [],
  onScrollToDean,
}: LoopVideoShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentVideo, setCurrentVideo] = useState<HomepageVideo | null>(video);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // muted by default for browser autoplay policy
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (video) setCurrentVideo(video);
  }, [video]);

  const activeVideoUrl =
    currentVideo?.video_url ||
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  const activeThumbnail =
    currentVideo?.thumbnail_url || "/assets/student-affairs-reference.jpg";

  // Watch for native fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.loop = true;
    vid.muted = true;
    vid.play().catch(() => {
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
    <div
      ref={containerRef}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      className="relative w-full h-[calc(100vh-4.5rem)] sm:h-[calc(100vh-5rem)] min-h-[520px] max-h-[960px] bg-black overflow-hidden flex items-center justify-center select-none group"
    >
      {/* Edge-to-edge HTML5 Video playing in loop with NO boxes */}
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

      {/* Top Floating Overlay (Pills & Badges) */}
      <div className="absolute top-4 sm:top-6 inset-x-4 sm:inset-x-8 z-30 flex items-center justify-between gap-3 pointer-events-none">
        {/* Loop Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full bg-black/65 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-bold shadow-xl pointer-events-auto">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="tracking-wide">Videos will play in loop</span>
        </div>

        {/* Right Badges & Photo Gallery Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          {onOpenGallery && (
            <button
              type="button"
              onClick={onOpenGallery}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white text-xs sm:text-sm font-bold shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <Camera className="h-4 w-4 text-amber-300" />
              <span>Daily Photos ({featuredPhotos.length}+)</span>
            </button>
          )}

          <div className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-amber-500/90 backdrop-blur-md text-slate-950 text-xs sm:text-sm font-black shadow-xl">
            <Sparkles className="h-4 w-4 fill-current" />
            <span>GNITS Campus Spotlight</span>
          </div>
        </div>
      </div>

      {/* Paused Center Overlay Indicator */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 z-20 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center cursor-pointer transition-opacity"
        >
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
            <Play className="h-10 w-10 sm:h-12 sm:w-12 fill-current ml-1" />
          </div>
          <span className="mt-4 text-white font-extrabold text-sm sm:text-lg drop-shadow-lg tracking-wide">
            Click to Resume Loop Playback
          </span>
        </div>
      )}

      {/* Floating Playlist Selector if multiple campus videos exist */}
      {allVideos.length > 1 && (
        <div className="absolute top-18 sm:top-20 right-4 sm:right-8 z-30 flex flex-wrap gap-2 max-w-sm justify-end pointer-events-auto">
          {allVideos.map((vid) => (
            <button
              key={vid.id}
              type="button"
              onClick={() => setCurrentVideo(vid)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md backdrop-blur-md cursor-pointer ${
                currentVideo?.id === vid.id
                  ? "bg-[#2563eb] text-white border border-blue-400"
                  : "bg-black/60 text-white/90 hover:bg-black/80 border border-white/20"
              }`}
            >
              <Film className="h-3 w-3 inline mr-1" />
              {vid.title}
            </button>
          ))}
        </div>
      )}

      {/* Floating Bottom Scrim & Controls Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-4 sm:p-6 md:p-8 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 flex flex-col gap-3 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Video Title & Campus Tagline */}
        <div className="px-1 max-w-4xl">
          <h2 className="text-base sm:text-xl md:text-2xl font-black text-white drop-shadow-md tracking-tight line-clamp-1">
            {currentVideo?.title || "GNITS Campus Life & Student Forum Highlights"}
          </h2>
          {currentVideo?.description && (
            <p className="hidden md:block text-xs sm:text-sm text-slate-200/90 line-clamp-1 mt-0.5 drop-shadow-xs">
              {currentVideo.description}
            </p>
          )}
        </div>

        {/* Video Control Bar */}
        <div className="flex items-center gap-2 sm:gap-4 rounded-2xl bg-white/15 backdrop-blur-xl px-3 sm:px-5 py-2.5 sm:py-3 border border-white/25 text-white shadow-2xl">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
            ) : (
              <Play className="h-5 w-5 sm:h-6 sm:w-6 fill-current" />
            )}
          </button>

          {/* Time Counter */}
          <span className="text-xs sm:text-sm font-mono font-semibold text-slate-200 min-w-[75px] sm:min-w-[95px] text-center">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Progress / Seek bar */}
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 sm:h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:h-2.5 transition-all"
            />
          </div>

          {/* Audio / Mute toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            title={isMuted ? "Click to enable sound" : "Mute sound"}
          >
            {isMuted ? (
              <>
                <VolumeX className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300" />
                <span className="text-amber-200">Sound On</span>
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-300" />
                <span className="text-emerald-200">Mute</span>
              </>
            )}
          </button>

          {/* Native Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
            aria-label="Fullscreen"
          >
            {isFullscreen ? (
              <Minimize className="h-5 w-5 sm:h-6 sm:w-6" />
            ) : (
              <Maximize className="h-5 w-5 sm:h-6 sm:w-6" />
            )}
          </button>
        </div>

        {/* Smooth Scroll Pill to Dean's Profile */}
        {onScrollToDean && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={onScrollToDean}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/25 text-white/90 hover:text-white text-xs font-semibold shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <span>Scroll to Dean's Profile &amp; Directorate</span>
              <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
