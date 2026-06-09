import Editor from '@monaco-editor/react'

interface EditorPanelProps {
  initialValue: string
  onChange: (value: string) => void
}

export function EditorPanel({ initialValue, onChange }: EditorPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <Editor
        height="100%"
        defaultLanguage="xml"
        defaultValue={initialValue}
        onChange={(value) => onChange(value ?? '')}
        theme="vs-dark"
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          padding: { top: 8, bottom: 8 },
          lineNumbers: 'on',
          tabSize: 2,
        }}
      />
    </div>
  )
}
