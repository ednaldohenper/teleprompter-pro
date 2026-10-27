import { useRef, useState, useCallback } from "react";

export function useVoiceScroll({ baseSpeed }: { baseSpeed: number }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const healthCheckRef = useRef<number | null>(null);
  const smoothVolumeRef = useRef(0);
  const silenceCountRef = useRef(0);
  const speakingRef = useRef(false);
  const intensityRef = useRef(1);
  const smoothIntensityRef = useRef(1);
  const speechCountRef = useRef(0);
  const peakVolumeRef = useRef(40);
  const activeRef = useRef(false);

  const SILENCE_THRESHOLD = 10;
  const SILENCE_FRAMES_TO_STOP = 55;
  const SPEECH_FRAMES_TO_START = 3;
  const POLL_MS = 16;

  const resetState = useCallback(() => {
    smoothVolumeRef.current = 0;
    silenceCountRef.current = 0;
    speechCountRef.current = 0;
    speakingRef.current = false;
    intensityRef.current = 1;
    smoothIntensityRef.current = 1;
    peakVolumeRef.current = 40;
  }, []);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current);
      healthCheckRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    resetState();
    setIsListening(false);
    setIsSpeaking(false);
  }, [resetState]);

  const startListening = useCallback(async () => {
    stopListening();
    activeRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      if (!activeRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      analyser.connect(gainNode);
      gainNode.connect(audioContext.destination);

      analyserRef.current = analyser;

      setIsListening(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudio = () => {
        if (!analyserRef.current || !activeRef.current) return;

        try {
          analyser.getByteFrequencyData(dataArray);
        } catch {
          return;
        }

        const voiceBins = Math.floor(dataArray.length * 0.6);
        let sum = 0;
        for (let i = 0; i < voiceBins; i++) {
          sum += dataArray[i];
        }
        const average = sum / voiceBins;

        smoothVolumeRef.current = smoothVolumeRef.current * 0.6 + average * 0.4;
        const vol = smoothVolumeRef.current;

        if (vol > SILENCE_THRESHOLD) {
          silenceCountRef.current = 0;
          speechCountRef.current++;

          if (vol > peakVolumeRef.current) {
            peakVolumeRef.current = peakVolumeRef.current * 0.9 + vol * 0.1;
          } else {
            peakVolumeRef.current = peakVolumeRef.current * 0.998 + vol * 0.002;
          }

          const range = Math.max(peakVolumeRef.current - SILENCE_THRESHOLD, 1);
          const normalized = Math.min((vol - SILENCE_THRESHOLD) / range, 1);
          const rawIntensity = 0.4 + normalized * 0.8;
          smoothIntensityRef.current = smoothIntensityRef.current * 0.8 + rawIntensity * 0.2;
          intensityRef.current = smoothIntensityRef.current;

          if (!speakingRef.current && speechCountRef.current >= SPEECH_FRAMES_TO_START) {
            speakingRef.current = true;
            setIsSpeaking(true);
          }
        } else {
          speechCountRef.current = Math.max(0, speechCountRef.current - 1);

          if (speakingRef.current) {
            silenceCountRef.current++;
            smoothIntensityRef.current = smoothIntensityRef.current * 0.95 + 0.3 * 0.05;
            intensityRef.current = smoothIntensityRef.current;

            if (silenceCountRef.current >= SILENCE_FRAMES_TO_STOP) {
              speakingRef.current = false;
              setIsSpeaking(false);
              smoothIntensityRef.current = 1;
              intensityRef.current = 1;
            }
          }
        }
      };

      intervalRef.current = window.setInterval(checkAudio, POLL_MS);

      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          if (activeRef.current) {
            setTimeout(() => {
              if (activeRef.current) startListening();
            }, 500);
          }
        };
      });

      audioContext.onstatechange = () => {
        if (audioContext.state === "suspended" && activeRef.current) {
          audioContext.resume().catch(() => {});
        }
      };

      healthCheckRef.current = window.setInterval(() => {
        if (!activeRef.current) return;

        const ctx = audioContextRef.current;
        const strm = streamRef.current;

        if (!ctx || !strm) {
          startListening();
          return;
        }

        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }

        if (ctx.state === "closed") {
          startListening();
          return;
        }

        const tracks = strm.getAudioTracks();
        const allEnded = tracks.length === 0 || tracks.every(t => t.readyState === "ended");
        if (allEnded) {
          startListening();
          return;
        }
      }, 3000);

    } catch (err) {
      activeRef.current = false;
      setIsListening(false);
    }
  }, [stopListening]);

  const getEffectiveSpeed = useCallback(() => {
    if (speakingRef.current) {
      return baseSpeed * intensityRef.current;
    }
    return baseSpeed * 0.3;
  }, [baseSpeed]);

  return {
    isListening,
    isSpeaking,
    getEffectiveSpeed,
    startListening,
    stopListening,
  };
}
