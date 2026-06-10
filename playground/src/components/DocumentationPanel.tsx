export function DocumentationPanel() {
  return (
    <div className="h-full overflow-auto bg-[#1e1e1e] p-4 text-sm text-gray-300">
      <h2 className="text-base font-semibold text-white mb-3">XML DSL Reference</h2>

      {/* Structure */}
      <section className="mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Structure</h3>

        <div className="space-y-1.5 text-xs">
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-orange-300">&lt;eventstorming&gt;</code> — Root element, wraps the entire diagram.</p>

          <p className="ml-4"><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-blue-300">&lt;aggregate&gt;</code> — Aggregate root grouping.</p>
          <p className="ml-4"><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-blue-300">&lt;externalsystem&gt;</code> — External system boundary.</p>
          <p className="ml-4"><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-blue-300">&lt;projector&gt;</code> — Projector/View grouping.</p>
          <p className="ml-4"><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-blue-300">&lt;process&gt;</code> — Business process grouping.</p>

          <p className="mt-2 ml-4"><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-blue-300">&lt;container&gt;</code> — Nestable sub-group inside any container. Supports recursive nesting.</p>
        </div>
      </section>

      {/* Node Types */}
      <section className="mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Node Types</h3>
        <div className="space-y-1.5 text-xs">
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-orange-300">&lt;event&gt;</code> — Orange, business event.</p>
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-green-300">&lt;command&gt;</code> — Light green, action verb.</p>
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-green-400">&lt;query&gt;</code> — Dark green, read request.</p>
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-yellow-300">&lt;aggregate&gt;</code> — Yellow, bounded consistency.</p>
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-gray-300">&lt;actor&gt;</code> — Gray, external participant.</p>
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-blue-300">&lt;policy&gt;</code> — Blue, rule or decision.</p>
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-cyan-300">&lt;error&gt;</code> — Cyan, error/exception path.</p>
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-pink-300">&lt;externalsystem&gt;</code> — Pink, external system interaction.</p>
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-yellow-400">&lt;note&gt;</code> — Light yellow, positioned annotation badge (requires x and y attributes).</p>
        </div>
      </section>

      {/* Attributes */}
      <section className="mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Attributes</h3>
        <div className="space-y-1.5 text-xs">
          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-purple-300">name</code> — Display label on the node. Required for visibility.</p>

          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-purple-300">id</code> — Optional custom identifier for referencing in <code className="bg-[#2d2d2d] px-1 py-0.5 rounded">next</code>/<code className="bg-[#2d2d2d] px-1 py-0.5 rounded">altNext</code>. Prefixed with <code className="bg-[#2d2d2d] px-1 py-0.5 rounded">custom-</code> internally.</p>

          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-purple-300">offset</code> — Integer horizontal shift (1 unit = NODE_W + NODE_GAP_X). Positive or negative values allowed.</p>

          <p><code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-purple-300">x</code>, <code className="bg-[#2d2d2d] px-1 py-0.5 rounded text-purple-300">y</code> — Grid column/row offsets for positioned notes. A <code className="bg-[#2d2d2d] px-1 py-0.5 rounded">&lt;note x="1" y="-1"&gt;</code> placed as a child creates a note badge at 1 column right, 1 row above its parent node.</p>
        </div>
      </section>

      {/* Notes */}
      <section className="mb-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2">Inline Notes</h3>
        <p className="text-xs text-gray-400">Use the <code className="bg-[#2d2d2d] px-1 py-0.5 rounded">notes="…"</code> attribute on any element to attach inline metadata annotations. Elements with notes show an `i` badge, and hovering them shows a notes-only tooltip.</p>
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-wider mb-2 mt-3">Positioned Notes</h3>
        <p className="text-xs text-gray-400"><code className="bg-[#2d2d2d] px-1 py-0.5 rounded">&lt;note x="…" y="…"&gt;…&lt;/note&gt;</code> as a child element renders a separate badge connected by an arrow from the note to its parent:</p>
        <p className="text-xs text-gray-400 mt-1"><code className="bg-[#2d2d2d] px-1 py-0.5 rounded">&lt;note x="1" y="-1"&gt;Requires manager approval&lt;/note&gt;</code></p>
        <p className="text-xs text-gray-400 mt-1"><code className="bg-[#2d2d2d] px-1 py-0.5 rounded">x</code>: grid column offset from parent (0 = same column, positive = right). <code className="bg-[#2d2d2d] px-1 py-0.5 rounded">y</code>: grid row offset (0 = same row, negative = above).</p>
      </section>
    </div>
  )
}
