import type { ReactNode } from "react";
import {
  BookOpen,
  Bot,
  ChartNoAxesColumnIncreasing,
  Code2,
  FolderOpen,
  House,
} from "lucide-react";

const PRIMARY_NAVIGATION = [
  { label: "今日学习", href: "#workspace", icon: House, current: true },
  { label: "课程", href: "#course-rail", icon: BookOpen },
  { label: "编程实验", href: "#teaching-canvas", icon: Code2 },
  { label: "作品", href: "#workspace", icon: FolderOpen },
  {
    label: "学习进度",
    href: "#course-rail",
    icon: ChartNoAxesColumnIncreasing,
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#workspace" aria-label="Mambo AI 教室首页">
          <span className="brand__mark" aria-hidden="true">
            <Bot size={22} strokeWidth={2.2} />
          </span>
          <span>Mambo AI 教室</span>
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
      </header>

      <div className="app-shell__body">{children}</div>
    </div>
  );
}
