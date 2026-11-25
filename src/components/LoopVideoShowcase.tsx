import { useState, useRef, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ChevronDown,
  Video as VideoIcon,
  Pencil,
} from "lucide-react";
import type { HomepageVideo, HomepagePhoto } from "@/lib/local-homepage-store";
import { getLocalVideoBlobUrl } from "@/lib/video-storage";

interface LoopVideoShowcaseProps {
  video: HomepageVideo | null;
  allVideos?: HomepageVideo[];
  onOpenGallery?: () => void;
  featuredPhotos?: HomepagePhoto[];
  onScrollToDean?: () => void;
  onEditVideo?: () => void;
}

export function LoopVideoShowcase({
  video,
  onScrollToDean,
  onEditVideo,
}: LoopVideoShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [localFallbackUrl, setLocalFallbackUrl] = useState<string | null>(null);
  const [serverError, setServerError] = useState(false);

  // Authoritative server-provided video URL (only active when admin has added a video)
  const serverVideoUrl =
    video &&
    video.is_active &&
    video.video_url?.trim() &&
    !video.video_url.includes("ForBiggerBlazes") &&
    video.video_url.trim() !== "/assets/campus_loop_video.mp4"
      ? video.video_url.trim()
      : null;

  // Use server video URL unless it failed or is absent, falling back cleanly to local IndexedDB video
  const activeVideoUrl = (!serverError && serverVideoUrl) || localFallbackUrl || null;

  // Reset error state if video prop updates, and load IndexedDB fallback when needed
  useEffect(() => {
    setPlaybackFailed(false);
    setServerError(false);

    if (!serverVideoUrl) {
      let active = true;
      getLocalVideoBlobUrl().then((url) => {
        if (active && url) setLocalFallbackUrl(url);
      });
      return () => {
        active = false;
      };
    }
    return undefined;
  }, [video?.id, video?.video_url, serverVideoUrl]);

  // Listen for live video updates broadcast across tabs
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        channel = new BroadcastChannel("gnits_video_broadcast");
        channel.onmessage = (ev) => {
          if (ev.data?.type === "VIDEO_UPDATED") {
            setPlaybackFailed(false);
            setServerError(false);
            getLocalVideoBlobUrl().then((url) => {
              if (url) setLocalFallbackUrl(url);
            });
          }
        };
      }
    } catch {
      // ignore
    }
    return () => {
      channel?.close();
    };
  }, []);

  const handleVideoError = () => {
    if (serverVideoUrl && !serverError) {
      setServerError(true);
      getLocalVideoBlobUrl().then((url) => {
        if (url) {
          setLocalFallbackUrl(url);
          setPlaybackFailed(false);
        } else {
          console.warn("Campus video stream unavailable.");
          setPlaybackFailed(true);
        }
      });
      return;
    }
    console.warn("Campus video stream unavailable.");
    setPlaybackFailed(true);
  };

  // Watch for native fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Automatic un-stoppable loop playback with audio
  useEffect(() => {
    if (playbackFailed) return;
    const vid = videoRef.current;
    if (!vid) return;

    vid.loop = true;

    // 1. Attempt unmuted playback so sound works immediately
    vid.muted = false;
    vid
      .play()
      .then(() => {
        setIsMuted(false);
      })
      .catch(() => {
        // If browser autoplay policy requires initial user interaction for sound,
        // start muted to ensure continuous autoplay, then unmute on first user interaction
        vid.muted = true;
        setIsMuted(true);
        vid.play().catch(() => {});
      });

    // 2. Unmute as soon as the user interacts anywhere on the page
    const unmuteOnInteraction = () => {
      if (videoRef.current) {
        videoRef.current.muted = false;
        setIsMuted(false);
        videoRef.current.play().catch(() => {});
      }
      window.removeEventListener("click", unmuteOnInteraction);
      window.removeEventListener("keydown", unmuteOnInteraction);
      window.removeEventListener("touchstart", unmuteOnInteraction);
    };

    window.addEventListener("click", unmuteOnInteraction, { once: true });
    window.addEventListener("keydown", unmuteOnInteraction, { once: true });
    window.addEventListener("touchstart", unmuteOnInteraction, { once: true });

    return () => {
      window.removeEventListener("click", unmuteOnInteraction);
      window.removeEventListener("keydown", unmuteOnInteraction);
      window.removeEventListener("touchstart", unmuteOnInteraction);
    };
  }, [activeVideoUrl, playbackFailed]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      videoRef.current.play().catch(() => {});
    }
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  // Ensure video cannot be stopped/paused
  const handleEnsurePlaying = () => {
    if (!playbackFailed && videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-4.5rem)] sm:h-[calc(100vh-5rem)] min-h-[520px] max-h-[960px] bg-black overflow-hidden flex items-center justify-center select-none"
    >
      {playbackFailed || !activeVideoUrl ? (
        // Clean campus showcase banner when no video is active or video fails
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 text-center">
          <img
            src="/assets/student-affairs-reference.jpg"
            alt="GNITS Campus"
            className="absolute inset-0 w-full h-full object-cover opacity-35 blur-xs"
          />
          <div className="relative z-10 max-w-md bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-2xl">
            <VideoIcon className="h-12 w-12 text-blue-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold">GNITS Campus Video Showcase</h3>
            <p className="text-xs text-slate-300 mt-1">
              {video?.title || "Welcome to Dean Student Affairs Portal"}
            </p>
          </div>
        </div>
      ) : (
        /* Endless Auto-Loop Video (Active only when user adds a video) */
        <video
          ref={videoRef}
          src={activeVideoUrl}
          poster="/assets/student-affairs-reference.jpg"
          autoPlay
          loop
          playsInline
          onError={handleVideoError}
          onPause={handleEnsurePlaying}
          onEnded={handleEnsurePlaying}
          className="w-full h-full object-cover pointer-events-none"
        />
      )}

      {/* Floating Sound, Fullscreen & optional Admin Edit Video controls in bottom-right corner */}
      {((!playbackFailed && Boolean(activeVideoUrl)) || Boolean(onEditVideo)) && (
        <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 z-30 flex items-center gap-2.5">
          {!playbackFailed && Boolean(activeVideoUrl) && (
            <>
              {/* Sound Toggle Button */}
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/25 text-white text-xs sm:text-sm font-bold shadow-2xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                title={isMuted ? "Click to enable sound" : "Sound is active"}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="h-4 w-4 text-amber-300" />
                    <span className="text-amber-200">Unmute Sound</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300">Sound On</span>
                  </>
                )}
              </button>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/25 text-white shadow-2xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
                aria-label="Fullscreen"
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            </>
          )}

          {onEditVideo && (
            <button
              type="button"
              onClick={onEditVideo}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f2757] hover:bg-[#1e3a8a] text-white text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Video</span>
            </button>
          )}
        </div>
      )}

      {/* Subtle Scroll to Dean's Profile in bottom-center */}
      {onScrollToDean && (
        <div className="absolute bottom-4 sm:bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={onScrollToDean}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white/90 hover:text-white text-xs font-semibold shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <span>Dean's Profile</span>
            <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
          </button>
        </div>
      )}
    </div>
  );
}
