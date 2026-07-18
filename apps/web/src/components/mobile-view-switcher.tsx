import { BookOpenText, MessagesSquare, Route } from "lucide-react";

export type MobileView = "conversation" | "content" | "path";

const VIEWS: ReadonlyArray<{
  value: MobileView;
  label: string;
  icon: typeof MessagesSquare;
}> = [
  { value: "conversation", label: "对话", icon: MessagesSquare },
  { value: "content", label: "内容", icon: BookOpenText },
  { value: "path", label: "路径", icon: Route },
];

interface MobileViewSwitcherProps {
  activeView: MobileView;
  onViewChange: (view: MobileView) => void;
}

export function MobileViewSwitcher({
  activeView,
  onViewChange,
}: MobileViewSwitcherProps) {
  return (
    <nav className="mobile-view-switcher" aria-label="学习工作台视图">
      {VIEWS.map((view) => {
        const Icon = view.icon;

        return (
          <button
            className="mobile-view-switcher__button"
            type="button"
            aria-pressed={activeView === view.value}
            key={view.value}
            onClick={() => onViewChange(view.value)}
          >
            <Icon size={21} aria-hidden="true" />
            <span>{view.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
