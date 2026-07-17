"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  const [status, setStatus] = useState("");
  const [recording, setRecording] = useState(false);

  function cleanRecording() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  }

  useEffect(() => () => cleanRecording(), []);

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      setStatus("图片需为 JPEG、PNG 或 WebP，且不超过 4 MiB。");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { onImageChange(String(reader.result)); setStatus(""); };
    reader.readAsDataURL(file);
  }

  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("当前设备不支持录音，可以直接输入问题。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      recorder.onstop = async () => {
        cleanRecording();
        try {
          const form = new FormData();
          form.append("audio", new Blob(chunks, { type: recorder.mimeType || "audio/webm" }), "recording.webm");
          const response = await fetch("/api/transcribe", { method: "POST", body: form });
          const payload = await response.json() as { transcript?: string };
          if (!response.ok || !payload.transcript) throw new Error("transcription unavailable");
          onTranscript(payload.transcript);
        } catch { setStatus("录音已保存，但暂时无法转成文字，请直接输入问题。"); }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setStatus("正在录音，最多 30 秒。");
      timerRef.current = setTimeout(() => recorder.stop(), 30_000);
    } catch { cleanRecording(); setStatus("没有获得麦克风权限，可以直接输入问题。"); }
  }

  return <div className="media-input">
    <input ref={inputRef} className="sr-only" id="classroom-image" aria-label="添加图片" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} />
    <button type="button" className="media-input__button" aria-label="选择图片" onClick={() => inputRef.current?.click()}><ImagePlus size={17} /></button>
    <button type="button" className="media-input__button" aria-label={recording ? "停止录音" : "录音"} onClick={toggleRecording}><Mic size={17} /></button>
    {image && <span className="media-input__preview"><Image src={image} alt="待发送图片预览" width={30} height={30} unoptimized /><button type="button" aria-label="移除图片" onClick={() => onImageChange(null)}><X size={14} /></button></span>}
    {status && <span className="media-input__status" role="status">{status}</span>}
  </div>;
}
