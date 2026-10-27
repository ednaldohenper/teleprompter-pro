import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import type { Script, Settings as SettingsType } from "@shared/schema";
import { useVoiceScroll } from "@/hooks/use-voice-scroll";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  Mic,
  MicOff,
  Minus,
  Plus,
  FlipHorizontal,
  ChevronUp,
  ChevronDown,
  Settings,
  Gauge,
  Type,
  X,
  Columns,
  RotateCw,
  RefreshCw,
  SkipForward,
  ListOrdered,
  Video,
  VideoOff,
  Circle,
  Square,
  Download,
} from "lucide-react";

export default function TeleprompterPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const scriptId = parseInt(params.id || "0");

  const searchParams = new URLSearchParams(window.location.search);
  const queueParam = searchParams.get("queue");
  const autoplayParam = searchParams.get("autoplay");
  const queueIds = queueParam ? queueParam.split(",").map(Number).filter(Boolean) : [];
  const currentQueueIndex = queueIds.indexOf(scriptId);
  const hasNextInQueue = currentQueueIndex >= 0 && currentQueueIndex < queueIds.length - 1;
  const nextScriptId = hasNextInQueue ? queueIds[currentQueueIndex + 1] : null;
  const isInQueue = queueIds.length > 1;

  const urlMirrored = searchParams.get("mirror") === "1";
  const urlVoice = searchParams.get("voice") === "1";
  const urlFontSize = searchParams.get("fs") ? parseInt(searchParams.get("fs")!) : null;
  const urlSpeed = searchParams.get("sp") ? parseInt(searchParams.get("sp")!) : null;
  const urlMargin = searchParams.get("mg") ? parseInt(searchParams.get("mg")!) : null;
  const urlRotated = searchParams.get("rot") === "1";
  const hasUrlSettings = searchParams.has("mirror");

  const { data: script, isLoading } = useQuery<Script>({
    queryKey: ["/api/scripts", scriptId],
    enabled: scriptId > 0,
  });

  const { data: nextScript } = useQuery<Script>({
    queryKey: ["/api/scripts", nextScriptId],
    enabled: !!nextScriptId,
  });

  const { data: settings } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
  });

  const [isPlaying, setIsPlaying] = useState(!!autoplayParam);
  const [fontSize, setFontSize] = useState(urlFontSize ?? 48);
  const [speed, setSpeed] = useState(urlSpeed ?? 3);
  const [mirrored, setMirrored] = useState(urlMirrored);
  const [voiceEnabled, setVoiceEnabled] = useState(urlVoice);
  const [showControls, setShowControls] = useState(!autoplayParam);
  const [progressPercent, setProgressPercent] = useState(0);
  const [margin, setMargin] = useState(urlMargin ?? 5);
  const [rotated, setRotated] = useState(urlRotated);
  const [settingsLoaded, setSettingsLoaded] = useState(hasUrlSettings);
  const [liveContent, setLiveContent] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [voiceSupported] = useState(() => {
    return !!(typeof window !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  });

  const [cameraActive, setCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recorderSupported] = useState(() => typeof window !== "undefined" && typeof MediaRecorder !== "undefined");
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const controlsTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (settings && !settingsLoaded) {
      setFontSize(settings.defaultFontSize);
      setSpeed(settings.defaultSpeed);
      setMirrored(settings.defaultMirrored);
      setMargin(settings.defaultMargin);
      setSettingsLoaded(true);
    }
  }, [settings, settingsLoaded]);

  const syncDoc = useCallback(async (showSpinner = false) => {
    if (!script?.googleDocId) return;
    if (showSpinner) setSyncing(true);
    try {
      const url = `/api/gdocs/sync/${script.googleDocId}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const doc = await res.json();
        if (doc.content) {
          setLiveContent(doc.content);
        }
      }
    } catch {
    } finally {
      if (showSpinner) setSyncing(false);
    }
  }, [script?.googleDocId]);

  useEffect(() => {
    if (!script?.googleDocId) return;
    setLiveContent(null);
    syncDoc();
    const interval = setInterval(() => syncDoc(), 15000);
    return () => clearInterval(interval);
  }, [script?.googleDocId, syncDoc]);

  const { isListening, isSpeaking, getEffectiveSpeed, startListening, stopListening } = useVoiceScroll({
    baseSpeed: speed,
  });

  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  useEffect(() => {
    if (urlVoice) {
      const timer = setTimeout(() => startListening(), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const isPlayingRef = useRef(false);
  const voiceEnabledRef = useRef(false);
  const speedRef = useRef(speed);
  const getEffectiveSpeedRef = useRef(getEffectiveSpeed);
  const hasNextRef = useRef(hasNextInQueue);
  const countdownActiveRef = useRef(false);
  const startCountdownRef = useRef<() => void>(() => {});
  isPlayingRef.current = isPlaying;
  voiceEnabledRef.current = voiceEnabled;
  speedRef.current = speed;
  getEffectiveSpeedRef.current = getEffectiveSpeed;
  hasNextRef.current = hasNextInQueue;
  countdownActiveRef.current = countdown !== null;

  useEffect(() => {
    const TICK_MS = 32;

    const tick = () => {
      let currentSpeed = 0;
      if (voiceEnabledRef.current) {
        currentSpeed = getEffectiveSpeedRef.current();
      } else if (isPlayingRef.current) {
        currentSpeed = speedRef.current;
      }

      const el = scrollContainerRef.current;
      if (currentSpeed > 0 && el) {
        const pxPerTick = (currentSpeed * 18 * TICK_MS) / 1000;
        el.scrollTop = el.scrollTop + pxPerTick;
      }
    };

    const updateProgress = () => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight) return;
      const pct = Math.min((scrollTop / (scrollHeight - clientHeight)) * 100, 100);
      setProgressPercent(pct);

      if (pct >= 99.5 && (isPlayingRef.current || voiceEnabledRef.current) && hasNextRef.current && !countdownActiveRef.current) {
        startCountdownRef.current();
      }
    };

    const scrollInterval = window.setInterval(tick, TICK_MS);
    const progressInterval = window.setInterval(updateProgress, 500);

    return () => {
      clearInterval(scrollInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const navigateToNext = useCallback(() => {
    if (!nextScriptId) return;
    const remainingQueue = queueIds.join(",");
    stopListening();
    const params = new URLSearchParams({
      queue: remainingQueue,
      autoplay: "1",
      mirror: mirrored ? "1" : "0",
      voice: voiceEnabled ? "1" : "0",
      fs: String(fontSize),
      sp: String(speed),
      mg: String(margin),
      rot: rotated ? "1" : "0",
    });
    window.location.href = `/teleprompter/${nextScriptId}?${params.toString()}`;
  }, [nextScriptId, queueIds, stopListening, mirrored, voiceEnabled, fontSize, speed, margin, rotated]);

  const skipToNext = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    navigateToNext();
  }, [navigateToNext]);

  const cancelCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    setIsPlaying(false);
    stopListening();
    setVoiceEnabled(false);
  }, [stopListening]);

  const startCountdown = useCallback(() => {
    if (!hasNextInQueue || countdown !== null) return;
    setIsPlaying(false);
    setShowControls(true);
    setCountdown(10);
    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          navigateToNext();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [hasNextInQueue, countdown, navigateToNext]);

  startCountdownRef.current = startCountdown;

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      cameraStreamRef.current = stream;
      setCameraActive(true);
    } catch {
      setCameraActive(false);
    }
  }, []);

  const cameraRefCallback = useCallback((node: HTMLVideoElement | null) => {
    (cameraVideoRef as any).current = node;
    if (node && cameraStreamRef.current) {
      node.srcObject = cameraStreamRef.current;
      node.setAttribute("playsinline", "true");
      node.setAttribute("webkit-playsinline", "true");
      node.muted = true;
      node.play().catch(() => {});
    }
  }, [cameraActive]);

  const stopCamera = useCallback(() => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsRecording(false);
    setRecordingTime(0);
  }, [isRecording]);

  const startRecording = useCallback(() => {
    if (!cameraStreamRef.current || !recorderSupported) return;

    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    recordedChunksRef.current = [];
    setRecordingTime(0);

    const stream = cameraStreamRef.current;
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach(t => { t.enabled = true; });

    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4",
    ];
    let mimeType = "";
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        break;
      }
    }

    try {
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch {
      setIsRecording(false);
    }
  }, [recorderSupported, recordedUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const downloadRecording = useCallback(() => {
    if (!recordedUrl) return;
    const a = document.createElement("a");
    a.href = recordedUrl;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const ext = recordedUrl.includes("mp4") ? "mp4" : "webm";
    a.download = `gravacao-${script?.title || "teleprompter"}-${timestamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [recordedUrl, script?.title]);

  const formatRecTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const resetScroll = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      setProgressPercent(0);
    }
  };

  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

  const hideControlsAfterDelay = () => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => {
      if (isPlaying || voiceEnabled) {
        setShowControls(false);
      }
    }, 4000);
  };

  useEffect(() => {
    if (isPlaying || voiceEnabled) {
      hideControlsAfterDelay();
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [isPlaying, voiceEnabled]);


  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Skeleton className="h-8 w-48 bg-white/5" />
      </div>
    );
  }

  if (!script) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
        <p className="text-white/40 mb-4">Script não encontrado</p>
        <Button variant="ghost" className="text-white/60" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div
      className="bg-black text-white"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        ...(rotated ? {
          width: "100vh",
          height: "100vw",
          transform: "rotate(90deg)",
          transformOrigin: "top left",
          top: 0,
          left: "100vw",
        } : {}),
      }}
      onClick={toggleControls}
    >
      <div
        className="absolute left-0 right-0 h-0.5 z-50"
        style={{ top: "env(safe-area-inset-top)" }}
        data-testid="progress-bar"
      >
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div
        ref={scrollContainerRef}
        className="scrollbar-hide"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          overflowY: "scroll",
          WebkitOverflowScrolling: "touch",
          ...(mirrored ? { transform: "scaleX(-1)" } : {}),
        }}
        onScroll={() => {
          if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            if (scrollHeight > clientHeight) {
              setProgressPercent(Math.min((scrollTop / (scrollHeight - clientHeight)) * 100, 100));
            }
          }
        }}
        data-testid="scroll-container"
      >
        <div className="pt-[15vh] pb-[100vh]" style={{ paddingLeft: `${margin}%`, paddingRight: `${margin}%` }}>
          <p
            className="leading-relaxed font-semibold text-white whitespace-pre-wrap"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: 1.5,
            }}
            data-testid="text-script-content"
          >
            {liveContent || script.content}
          </p>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10" />

      <div className="absolute left-0 right-0 top-[30%] pointer-events-none z-20">
        <div className="h-[2px] bg-emerald-500/30" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-500 rounded-full" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-500 rounded-full" />
      </div>

      {cameraActive && (
        <div
          className="absolute top-2 right-2 z-30 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg"
          style={{ width: "120px", height: "160px" }}
          onClick={(e) => e.stopPropagation()}
          data-testid="camera-preview"
        >
          <video
            ref={cameraRefCallback}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          {isRecording && (
            <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-white font-mono">{formatRecTime(recordingTime)}</span>
            </div>
          )}
        </div>
      )}

      {isRecording && !showControls && (
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-white font-mono">{formatRecTime(recordingTime)}</span>
        </div>
      )}

      {recordedUrl && !isRecording && (
        <div
          className="absolute top-4 left-4 z-30"
          onClick={(e) => e.stopPropagation()}
          data-testid="download-recording-floating"
        >
          <Button
            size="sm"
            className="bg-emerald-600 text-white border-emerald-700 gap-1.5"
            onClick={downloadRecording}
          >
            <Download className="h-4 w-4" />
            Baixar vídeo
          </Button>
        </div>
      )}

      {showControls && (
        <div
          className="absolute top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <Button
              size="icon"
              variant="ghost"
              className="text-white/70"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm text-white/50 truncate flex-1 text-center font-medium">
              #{script.number} {script.title}
            </span>
            {script.googleDocId && (
              <Button
                size="icon"
                variant="ghost"
                className="text-blue-400"
                onClick={() => syncDoc(true)}
                disabled={syncing}
                data-testid="button-sync-doc"
              >
                <RefreshCw className={`h-5 w-5 ${syncing ? "animate-spin" : ""}`} />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="text-white/40"
              onClick={() => setShowControls(false)}
              data-testid="button-hide-controls"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {showControls && (
        <div
          className="absolute bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-center gap-3">
              <Button
                size="icon"
                variant="ghost"
                className="text-white/70"
                onClick={resetScroll}
                data-testid="button-reset"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>

              <Button
                size="icon"
                className={`${
                  isPlaying || voiceEnabled
                    ? "bg-red-600 text-white border-red-700"
                    : "bg-emerald-600 text-white border-emerald-700"
                } h-12 w-12 rounded-full`}
                onClick={() => {
                  if (voiceEnabled) {
                    stopListening();
                    setVoiceEnabled(false);
                    setIsPlaying(false);
                  } else {
                    setIsPlaying(!isPlaying);
                  }
                }}
                data-testid="button-play-pause"
              >
                {isPlaying || voiceEnabled ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
              </Button>

              <Button
                size="icon"
                className={`rounded-full ${
                  !voiceSupported
                    ? "bg-zinc-800 text-white/20 border-zinc-700 cursor-not-allowed"
                    : voiceEnabled
                      ? isSpeaking
                        ? "bg-emerald-500 text-white border-emerald-600"
                        : "bg-amber-600 text-white border-amber-700"
                      : "bg-zinc-800 text-white/50 border-zinc-700"
                }`}
                onClick={() => {
                  if (!voiceSupported) return;
                  if (!voiceEnabled) {
                    startListening();
                    setVoiceEnabled(true);
                    setIsPlaying(false);
                  } else {
                    stopListening();
                    setVoiceEnabled(false);
                  }
                }}
                data-testid="button-voice-toggle"
              >
                {voiceEnabled ? (
                  isSpeaking ? <Mic className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className={`text-white/70 ${mirrored ? "text-emerald-400" : ""}`}
                onClick={() => setMirrored(!mirrored)}
                data-testid="button-mirror"
              >
                <FlipHorizontal className="h-5 w-5" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className={`text-white/70 ${rotated ? "text-emerald-400" : ""}`}
                onClick={() => setRotated(!rotated)}
                data-testid="button-rotate"
              >
                <RotateCw className="h-5 w-5" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className={`text-white/70 ${cameraActive ? "text-blue-400" : ""}`}
                onClick={() => cameraActive ? stopCamera() : startCamera()}
                data-testid="button-camera-toggle"
              >
                {cameraActive ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
            </div>

            {cameraActive && recorderSupported && (
              <div className="flex items-center justify-center gap-3">
                {!isRecording ? (
                  <Button
                    size="sm"
                    className="bg-red-600 text-white border-red-700 gap-1.5 rounded-full px-4"
                    onClick={startRecording}
                    data-testid="button-start-recording"
                  >
                    <Circle className="h-3 w-3 fill-current" />
                    Gravar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-zinc-700 text-white border-zinc-600 gap-1.5 rounded-full px-4"
                    onClick={stopRecording}
                    data-testid="button-stop-recording"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    Parar ({formatRecTime(recordingTime)})
                  </Button>
                )}
                {recordedUrl && !isRecording && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white border-emerald-700 gap-1.5 rounded-full px-4"
                    onClick={downloadRecording}
                    data-testid="button-download-recording"
                  >
                    <Download className="h-3 w-3" />
                    Baixar
                  </Button>
                )}
              </div>
            )}
            {cameraActive && !recorderSupported && (
              <div className="flex items-center justify-center text-xs text-white/30">
                Gravação não suportada neste navegador
              </div>
            )}

            {!voiceSupported && (
              <div className="flex items-center justify-center text-xs text-white/30">
                Reconhecimento de voz não disponível neste navegador
              </div>
            )}
            {voiceSupported && voiceEnabled && (
              <div className="flex items-center justify-center gap-2 text-xs">
                {isSpeaking ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Ouvindo... acompanhando sua fala
                  </span>
                ) : isListening ? (
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                    Aguardando fala...
                  </span>
                ) : (
                  <span className="text-white/30">Microfone desativado</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Gauge className="h-4 w-4 text-white/30 shrink-0" />
                <Slider
                  value={[speed]}
                  onValueChange={([v]) => setSpeed(v)}
                  min={1}
                  max={10}
                  step={1}
                  className="flex-1"
                  data-testid="slider-live-speed"
                />
                <span className="text-xs text-white/40 font-mono w-6 text-right">{speed}x</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white/50 h-8 w-8"
                  onClick={() => setFontSize(Math.max(20, fontSize - 4))}
                  data-testid="button-font-decrease"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-xs text-white/40 font-mono w-10 text-center">{fontSize}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white/50 h-8 w-8"
                  onClick={() => setFontSize(Math.min(120, fontSize + 4))}
                  data-testid="button-font-increase"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Columns className="h-4 w-4 text-white/30 shrink-0" />
              <Slider
                value={[margin]}
                onValueChange={([v]) => setMargin(v)}
                min={0}
                max={30}
                step={1}
                className="flex-1"
                data-testid="slider-margin"
              />
              <span className="text-xs text-white/40 font-mono w-10 text-right">{margin}%</span>
            </div>
          </div>
        </div>
      )}

      {!showControls && (
        <div
          className="absolute bottom-4 right-4 z-40"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-1">
            {voiceEnabled && isSpeaking && (
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 animate-pulse mb-1" />
            )}
            {voiceEnabled && !isSpeaking && isListening && (
              <span className="inline-block w-3 h-3 rounded-full bg-amber-400 mb-1" />
            )}
          </div>
        </div>
      )}

      {countdown !== null && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
          data-testid="countdown-overlay"
        >
          <div className="flex flex-col items-center gap-6 px-8">
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <ListOrdered className="h-4 w-4" />
              <span>Fila: {currentQueueIndex + 1} de {queueIds.length}</span>
            </div>
            <div className="text-center">
              <p className="text-white/50 text-sm mb-1">Próximo script</p>
              <p className="text-white text-xl font-bold">
                {nextScript ? `#${nextScript.number} ${nextScript.title}` : "Carregando..."}
              </p>
            </div>
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke="#10b981" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - countdown / 10)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <span className="text-4xl font-bold text-white tabular-nums">{countdown}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="text-white/60"
                onClick={cancelCountdown}
                data-testid="button-cancel-countdown"
              >
                <X className="h-4 w-4 mr-1" />
                Parar
              </Button>
              <Button
                className="bg-emerald-600 text-white border-emerald-700"
                onClick={skipToNext}
                data-testid="button-skip-next"
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Pular agora
              </Button>
            </div>
          </div>
        </div>
      )}

      {isInQueue && showControls && countdown === null && (
        <div
          className="absolute top-12 left-0 right-0 z-40 flex justify-center"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-md px-3 py-1.5 text-xs text-white/50">
            <ListOrdered className="h-3 w-3" />
            <span>{currentQueueIndex + 1} / {queueIds.length}</span>
            {hasNextInQueue && (
              <Button
                size="icon"
                variant="ghost"
                className="text-white/50 h-6 w-6"
                onClick={skipToNext}
                data-testid="button-skip-queue"
              >
                <SkipForward className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
