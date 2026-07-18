"use client";

import { Bot, ChevronDown, CircleAlert, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import type { PublicDeviceStatus } from "@/lib/core-api";

import styles from "./device-status.module.css";

const POLL_INTERVAL_MS = 18_000;
const WEB_MODE: PublicDeviceStatus = {
  status: "unavailable",
  name: null,
  online: false,
  lastSeenAt: null,
  capabilities: [],
};

const CAPABILITY_LABELS: Record<string, string> = {
  audio: "音频",
  camera: "摄像头",
  display: "屏幕",
  microphone: "麦克风",
  npu: "NPU",
  ping: "连接检测",
  speaker: "扬声器",
  get_status: "状态读取",
};

function isDeviceStatus(value: unknown): value is PublicDeviceStatus {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return ["configured", "online", "offline", "unavailable", "unconfigured"].includes(
    String(candidate.status),
  )
    && typeof candidate.online === "boolean"
    && (typeof candidate.name === "string" || candidate.name === null)
    && (typeof candidate.lastSeenAt === "string" || candidate.lastSeenAt === null)
    && Array.isArray(candidate.capabilities)
    && candidate.capabilities.length <= 8
    && candidate.capabilities.every((item) => typeof item === "string");
}

function heartbeatLabel(value: string | null) {
  if (!value) return "暂无心跳";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "暂无心跳";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function DeviceStatus() {
  const [device, setDevice] = useState<PublicDeviceStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    let activeController: AbortController | null = null;

    async function refresh() {
      if (!mounted || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      const controller = new AbortController();
      activeController = controller;
      try {
        const response = await fetch("/api/device", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Device status unavailable");
        const body: unknown = await response.json();
        if (!isDeviceStatus(body)) throw new Error("Invalid device status");
        if (mounted) setDevice(body);
      } catch {
        if (mounted && !controller.signal.aborted) setDevice(WEB_MODE);
      } finally {
        if (activeController === controller) activeController = null;
        inFlight = false;
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      activeController?.abort(new DOMException("Device status unmounted", "AbortError"));
    };
  }, []);

  if (!device) {
    return (
      <div className={styles.root} data-state="loading" aria-hidden="false">
        <span className={styles.icon}><Bot size={17} aria-hidden="true" /></span>
        <span className={styles.copy}>
          <strong>检查机器人</strong>
          <span>请稍候</span>
        </span>
        <span className="sr-only" role="status">正在检查机器人连接</span>
      </div>
    );
  }

  const online = device.status === "online" && device.online;
  const title = online
    ? `${device.name ?? "机器人"}已连接，展开查看设备能力`
    : "当前使用网页模式，教学不受影响";

  return (
    <details className={styles.root} data-state={online ? "online" : "web"}>
      <summary className={styles.summary} title={title}>
        <span className={styles.icon}>
          {online ? <Wifi size={17} aria-hidden="true" /> : <WifiOff size={17} aria-hidden="true" />}
        </span>
        <span className={styles.copy}>
          <strong>{online ? "机器人已连接" : "网页模式"}</strong>
          <span>{online ? "设备状态正常" : "教学不受影响"}</span>
        </span>
        <ChevronDown className={styles.chevron} size={15} aria-hidden="true" />
      </summary>
      <div className={styles.popover}>
        {online ? (
          <>
            <p className={styles.deviceName}><Bot size={15} aria-hidden="true" />{device.name}</p>
            <p>最后心跳：{heartbeatLabel(device.lastSeenAt)}</p>
            <p>
              能力：{device.capabilities.length
                ? device.capabilities.map((item) => CAPABILITY_LABELS[item] ?? item).join("、")
                : "基础连接"}
            </p>
          </>
        ) : (
          <p className={styles.webModeNote}>
            <CircleAlert size={15} aria-hidden="true" />
            机器人暂不可用，网页课程、对话与练习仍可正常使用。
          </p>
        )}
      </div>
    </details>
  );
}
