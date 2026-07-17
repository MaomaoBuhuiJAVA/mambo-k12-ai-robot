"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, X } from "lucide-react";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface MediaInputProps {
  image: string | null;
  onImageChange: (image: string | null) => void;
  onTranscript: (transcript: string) => void;
}

export function MediaInput({ image, onImageChange, onTranscript }: MediaInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptionRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const shouldTranscribeRef = useRef(false);
  const [status, setStatus] = useState("");
  const [recording, setRecording] = useState(false);

  function setStatusIfMounted(nextStatus: string) {
    if (mountedRef.current) setStatus(nextStatus);
  }

  function clearMediaResources(updateState = true) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    if (updateState && mountedRef.current) setRecording(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      transcriptionRef.current?.abort();
      transcriptionRef.current = null;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      clearMediaResources(false);
    };
  }, []);

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      setStatusIfMounted("图片需为 JPEG、PNG 或 WebP，且不超过 4 MiB。");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (!mountedRef.current) return;
      onImageChange(String(reader.result));
      setStatus("");
    };
    reader.readAsDataURL(file);
  }

  async function transcribe(chunks: BlobPart[], mimeType: string) {
    if (!mountedRef.current) return;
    const controller = new AbortController();
    transcriptionRef.current = controller;
    try {
      const form = new FormData();
      form.append("audio", new Blob(chunks, { type: mimeType || "audio/webm" }), "recording.webm");
      const response = await fetch("/api/transcribe", { method: "POST", body: form, signal: controller.signal });
      const payload = await response.json() as { transcript?: string };
      if (!response.ok || !payload.transcript) throw new Error("transcription unavailable");
      if (mountedRef.current) onTranscript(payload.transcript);
    } catch (error) {
      if (mountedRef.current && (error as DOMException).name !== "AbortError") {
        setStatus("录音已保存，但暂时无法转成文字，请直接输入问题。");
      }
    } finally {
      if (transcriptionRef.current === controller) transcriptionRef.current = null;
    }
  }

  async function toggleRecording() {
    if (recording) {
      shouldTranscribeRef.current = true;
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatusIfMounted("当前设备不支持录音，可以直接输入问题。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const shouldTranscribe = shouldTranscribeRef.current && mountedRef.current;
        shouldTranscribeRef.current = false;
        clearMediaResources();
        if (shouldTranscribe) void transcribe(chunks, recorder.mimeType);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setStatus("正在录音，最长 30 秒。");
      timerRef.current = setTimeout(() => {
        shouldTranscribeRef.current = true;
        recorder.stop();
      }, 30_000);
    } catch {
      clearMediaResources();
      setStatusIfMounted("没有获得麦克风权限，可以直接输入问题。");
    }
  }

  return (
    <div className="media-input">
      <input ref={inputRef} className="sr-only" id="classroom-image" aria-label="添加图片" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} />
      <button type="button" className="media-input__button" aria-label="选择图片" onClick={() => inputRef.current?.click()}><ImagePlus size={17} /></button>
      <button type="button" className="media-input__button" aria-label={recording ? "停止录音" : "录音"} onClick={toggleRecording}><Mic size={17} /></button>
      {image && <span className="media-input__preview"><Image src={image} alt="待发送图片预览" width={30} height={30} unoptimized /><button type="button" aria-label="移除图片" onClick={() => onImageChange(null)}><X size={14} /></button></span>}
      {status && <span className="media-input__status" role="status">{status}</span>}
    </div>
  );
}
