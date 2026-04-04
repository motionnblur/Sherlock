import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { LiveVideoWindowProps } from '../interfaces/components';

const WINDOW_WIDTH_PX = 240;
const WINDOW_HEIGHT_PX = 240;

/**
 * Floating 240x240 live video window that plays an HLS stream.
 *
 * Lifecycle:
 * - Mounts an hls.js instance when streamUrl is provided.
 * - Destroys the hls.js instance on unmount or when the window is closed.
 * - Falls back to native <video> HLS if the browser supports it natively (Safari).
 *
 * Fullscreen:
 * - The entire container (title bar + video) enters fullscreen via the Fullscreen API.
 * - A fullscreenchange listener keeps isFullscreen in sync so pressing Esc also
 *   updates the button icon without any extra code.
 */
export default function LiveVideoWindow({
  streamUrl,
  isFetching,
  fetchError,
  onClose,
}: LiveVideoWindowProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // autoplay may be blocked; user interaction will resume playback
        });
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari)
      video.src = streamUrl;
      video.play().catch(() => {
        // autoplay may be blocked
      });
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-10 right-4 z-50 bg-panel border border-line flex flex-col"
      style={{ width: WINDOW_WIDTH_PX, height: WINDOW_HEIGHT_PX }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-elevated border-b border-line shrink-0">
        <span className="text-[9px] tracking-widest text-muted uppercase">Live Feed</span>
        <div className="flex items-center gap-0.5">
          <button
            id="live-video-fullscreen-btn"
            onClick={handleToggleFullscreen}
            className={`text-[10px] leading-none font-bold px-1 transition-colors ${
              isFullscreen ? 'text-neon hover:text-muted' : 'text-muted hover:text-neon'
            }`}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⊡' : '⛶'}
          </button>
          <button
            id="live-video-close-btn"
            onClick={onClose}
            className="text-muted hover:text-danger text-[10px] leading-none font-bold px-1"
            aria-label="Close live video window"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 relative flex items-center justify-center bg-surface overflow-hidden">
        {isFetching && (
          <span className="text-[9px] text-muted tracking-widest animate-pulse">
            ACQUIRING FEED…
          </span>
        )}

        {fetchError && !isFetching && (
          <span className="text-[9px] text-danger tracking-widest text-center px-2">
            ⚠ FEED ERROR
          </span>
        )}

        {streamUrl && !fetchError && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
            aria-label="Live drone camera feed"
          />
        )}
      </div>
    </div>
  );
}
