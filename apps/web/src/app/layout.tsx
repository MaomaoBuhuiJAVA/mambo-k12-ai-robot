import type { Metadata } from "next";
import { CloudTransitionProvider } from "@/components/cloud-transition/cloud-transition-provider";
import { RobotGestureProvider } from "@/components/robot/robot-gesture-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mambo AI 教室",
  description: "面向 K12 学生的自适应 AI 学习工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <CloudTransitionProvider>
          <RobotGestureProvider>{children}</RobotGestureProvider>
        </CloudTransitionProvider>
      </body>
    </html>
  );
}
