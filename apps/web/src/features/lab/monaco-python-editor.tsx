"use client";

import dynamic from "next/dynamic";
import type { EditorProps } from "@monaco-editor/react";

import styles from "./python-lab.module.css";

const MonacoEditor = dynamic<EditorProps>(
  () => import("@monaco-editor/react").then((module) => module.default),
  {
    ssr: false,
    loading: () => <div className={styles.editorLoading}>正在准备代码编辑器…</div>,
  },
);

interface MonacoPythonEditorProps {
  value: string;
  onChange(value: string): void;
}

export function MonacoPythonEditor({ value, onChange }: MonacoPythonEditorProps) {
  return (
    <div className={styles.editor} aria-label="Python 代码编辑器">
      <MonacoEditor
        height="100%"
        language="python"
        theme="vs-dark"
        value={value}
        onChange={(nextValue: string | undefined) => onChange(nextValue ?? "")}
        options={{
          automaticLayout: true,
          fontFamily: "Cascadia Code, Cascadia Mono, Consolas, monospace",
          fontSize: 15,
          lineHeight: 23,
          minimap: { enabled: false },
          padding: { top: 14, bottom: 14 },
          scrollBeyondLastLine: false,
          tabSize: 4,
          wordWrap: "on",
          ariaLabel: "Python 代码",
        }}
      />
    </div>
  );
}
