import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import type { HomepageVideo } from "@/lib/local-homepage-store";

interface CollegeVideoCardProps {
  video: HomepageVideo | null;
}

export function CollegeVideoCard({ video }: CollegeVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(205); // 3:25 default
  const [showControls, setShowControls] = useState(true);

  const videoUrl =
    video?.video_url ||
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  const thumbnailUrl = video?.thumbnail_url || "/assets/student-affairs-reference.jpg";

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch((err) => console.log("Play error:", err));
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const handleEnded = () => setIsPlaying(false);
    vid.addEventListener("ended", handleEnded);
    return () => vid.removeEventListener("ended", handleEnded);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative rounded-3xl overflow-hidden shadow-xl border border-white/80 bg-slate-900 group min-h-[300px] sm:min-h-[340px] md:min-h-[360px] flex items-center justify-center select-none"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
    >
      {/* Background Video Element */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl}
        onTimeUpdate={handleTimeUpdate}
        playsInline
        className="absolute inset-0 h-full w-full object-cover cursor-pointer"
        onClick={togglePlay}
      />

      {/* Dark Vignette Overlay for aesthetics */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none transition-opacity duration-300 ${
          isPlaying && !showControls ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Big Center Circular Play Button (when paused) */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="relative z-20 flex flex-col items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-105"
        >
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/95 text-[#0f172a] shadow-2xl flex items-center justify-center border border-white/60">
            <Play className="h-8 w-8 sm:h-9 sm:w-9 fill-current ml-1 text-[#0f172a]" />
          </div>
          <span className="mt-3 text-lg sm:text-xl font-black text-white drop-shadow-md tracking-wide">
            College Video
          </span>
        </div>
      )}

      {/* Video Playback Bar at the bottom matching reference mockup */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-5 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-4 rounded-xl bg-black/60 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 text-white shadow-lg border border-white/10">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors focus:outline-none"
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
            ) : (
              <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Time Display (e.g., 0:00 / 3:25) */}
          <span className="text-xs sm:text-sm font-semibold tracking-wider text-slate-200 min-w-[70px] sm:min-w-[85px] text-center font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Seeker Bar */}
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-white hover:h-2 transition-all"
            />
          </div>

          {/* Mute/Volume Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors focus:outline-none"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors focus:outline-none"
            aria-label="Toggle Fullscreen"
          >
            <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
