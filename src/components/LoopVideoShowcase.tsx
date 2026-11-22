import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ChevronDown,
} from "lucide-react";
import type { HomepageVideo, HomepagePhoto } from "@/lib/local-homepage-store";
import { getLocalVideoBlobUrl } from "@/lib/video-storage";

interface LoopVideoShowcaseProps {
  video: HomepageVideo | null;
  allVideos?: HomepageVideo[];
  onOpenGallery?: () => void;
  featuredPhotos?: HomepagePhoto[];
  onScrollToDean?: () => void;
}

export function LoopVideoShowcase({
  video,
  onScrollToDean,
}: LoopVideoShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentVideo, setCurrentVideo] = useState<HomepageVideo | null>(video);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // muted by default for browser autoplay policy
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Check for local uploaded video from IndexedDB
  useEffect(() => {
    let active = true;
    getLocalVideoBlobUrl().then((url) => {
      if (active && url) setLocalVideoUrl(url);
    });

    // Listen for updates from admin panel across tabs
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        channel = new BroadcastChannel("gnits_video_broadcast");
        channel.onmessage = (ev) => {
          if (ev.data?.type === "VIDEO_UPDATED") {
            getLocalVideoBlobUrl().then((url) => {
              if (url) setLocalVideoUrl(url);
            });
          }
        };
      }
    } catch {
      // ignore
    }

    return () => {
      active = false;
      channel?.close();
    };
  }, []);

  useEffect(() => {
    if (video) setCurrentVideo(video);
  }, [video]);

  // Priority: 1. Local uploaded video Blob -> 2. Server video URL -> 3. Fallback video
  const activeVideoUrl =
    localVideoUrl ||
    currentVideo?.video_url ||
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

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

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      className="relative w-full h-[calc(100vh-4.5rem)] sm:h-[calc(100vh-5rem)] min-h-[520px] max-h-[960px] bg-black overflow-hidden flex items-center justify-center select-none group"
    >
      {/* Edge-to-edge pure video display with NO boxes, NO badges, NO text */}
      <video
        ref={videoRef}
        src={activeVideoUrl}
        autoPlay
        loop
        muted={isMuted}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
        className="w-full h-full object-cover cursor-pointer"
      />

      {/* Center Play Indicator when paused */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] flex items-center justify-center cursor-pointer transition-opacity"
        >
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
            <Play className="h-10 w-10 sm:h-12 sm:w-12 fill-current ml-1" />
          </div>
        </div>
      )}

      {/* Floating Bottom Minimal Controls (Auto-shows on hover or when paused, NO text, NO duration) */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 flex flex-col gap-2.5 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Minimal Control Bar: Play/Pause, Seeker, Sound Toggle, Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-4 rounded-2xl bg-black/50 backdrop-blur-xl px-3 sm:px-5 py-2 sm:py-2.5 border border-white/20 text-white shadow-2xl">
          {/* Play/Pause */}
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

          {/* Progress / Seek bar */}
          <div className="flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 sm:h-2 bg-white/25 rounded-lg appearance-none cursor-pointer accent-white hover:h-2.5 transition-all"
            />
          </div>

          {/* Audio Sound On / Mute toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold transition-colors cursor-pointer"
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

        {/* Subtle Scroll to Dean's Profile prompt */}
        {onScrollToDean && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={onScrollToDean}
              className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white/80 hover:text-white text-xs font-medium transition-all cursor-pointer"
            >
              <span>Dean's Profile</span>
              <ChevronDown className="h-3 w-3 animate-bounce" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
