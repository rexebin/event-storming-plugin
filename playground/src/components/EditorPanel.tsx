import { useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'

interface EditorPanelProps {
  initialValue: string
  onChange: (value: string) => void
}

export function EditorPanel({ initialValue, onChange }: EditorPanelProps) {
  const editorRef = useRef<Parameters<NonNullable<Parameters<typeof Editor>[0]['onMount']>>[0] | null>(null)

  useEffect(() => {
    return () => {
      editorRef.current = null
    }
  }, [])

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
          renderLineHighlight: 'line',
          formatOnPaste: true,
          tabSize: 2,
        }}
        onMount={(editor) => {
          editorRef.current = editor
        }}
      />
    </div>
  )
}
