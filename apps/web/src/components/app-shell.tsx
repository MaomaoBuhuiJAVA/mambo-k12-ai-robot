import type { ReactNode } from "react";
import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Code2,
  FolderOpen,
  House,
} from "lucide-react";

import { DeviceStatus } from "@/features/device/device-status";

const PRIMARY_NAVIGATION = [
  { label: "今日学习", href: "/#workspace", icon: House, current: true },
  { label: "课程", href: "/?view=path#course-rail", icon: BookOpen },
  { label: "编程实验", href: "/lab", icon: Code2 },
  { label: "作品", href: "/progress#works", icon: FolderOpen },
  {
    label: "学习进度",
    href: "/progress",
    icon: ChartNoAxesColumnIncreasing,
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/preview" aria-label="返回首页">
          <span className="brand__mark brand__mark--star" aria-hidden="true" />
          <span>Mambo AI 教室</span>
          <small className="brand__back">返回首页</small>
        </a>

        <nav className="primary-navigation" aria-label="主导航">
          {PRIMARY_NAVIGATION.map((item) => {
            const Icon = item.icon;

            return (
              <a
                className="primary-navigation__link"
                href={item.href}
                aria-current={"current" in item ? "page" : undefined}
                key={item.label}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <DeviceStatus />
      </header>

      <div className="app-shell__body">{children}</div>
    </div>
  );
}
