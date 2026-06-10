import Editor from "@monaco-editor/react";

type Props = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
};

export function ToolCodeEditor({ value, onChange, readOnly = false, height = "420px" }: Props) {
  return (
    <div className="overflow-hidden rounded-md border border-border/70">
      <Editor
        height={height}
        defaultLanguage="typescript"
        value={value}
        onChange={(next) => onChange?.(next ?? "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
