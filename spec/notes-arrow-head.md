Redesign notes:

- instead of using next/altNext to point to a note node, repurpose the name less next element to add note node\
- name less child note elements will not be gathered to notes for tooltips anymore
- note element doesn't have a name attribute anymore
- note element only placed as a child of a node, or will be ignored.
- note will have a link to the parent node, arrow head will be at the parent node end.
- the note node has x and y attributes that specify the position of the note relative to the parent node. The x and y attributes can be positive or negative integers, where:
  - x = 0 means the note is in the same column as the parent node
  - x > 0 means the note is to the right of the parent node, with the value indicating how many columns away it is
  - x < 0 means the note is to the left of the parent node, with the value indicating how many columns away it is
  - y = 0 means the note is in the same row as the parent node
  - y > 0 means the note is above the parent node, with the value indicating how many rows away it is
  - y < 0 means the note is below the parent node, with the value indicating how many rows away it is
  - the note node can be placed in any position relative to the parent node, allowing for more flexible and intuitive note placement. 
  - The rendering logic will need to be updated to calculate the position of the note based on the x and y attributes and render it accordingly.
  - maintain the grid-based layout system, but allow notes to be placed in any position relative to the parent node, while still maintaining the overall structure of the diagram.
- for example:
  ```xml
   <policy name="Policy 1">
     <note x="0" y="1">I am a note above the parent</note>
     <note x="0" y="-1">I am a note below the parent</note>
     <note x="1" y="0">I am a note to the right of the parent</note>
     <note x="-1" y="0">I am a note to the left of the parent</note>
     <note x="1" y="-1">I am a note to the right the parent, on the row below</note>
     <note x="-1" y="-1">I am a note to the left of the parent, on the row below</note>
     <note x="1" y="1">I am a note to the right of the parent, on the row above</note>
     <note x="-1" y="1">I am a note to the left of the parent, on the row above</note>
     <note x="2" y="0">I am a note to the right of the parent, two columns away</note>
     <note x="0" y="2">I am a note above the parent, two rows away</note>
     <note x="-2" y="0">I am a note to the left of the parent, two columns away</note>
     <note x="0" y="-2">I am a note below the parent, two rows away</note>
     <note x="2" y="-2">I am a note to the right of the parent, two columns away, two rows below</note>
     <note x="-2" y="-2">I am a note to the left of the parent, two columns away, two rows below</note>
     <note x="2 " y="2">I am a note to the right of the parent, two columns away, two row above</note>
   </policy>
 - ```
 - add example to default playground DSL and readme.md.

## Implementation Plan

### 1. Data model: Add `parentId`, `noteX`, `noteY` to DSLNode; remove `noteTarget`
- **File**: `src/parser/models.ts`
- Add fields: `parentId?: string | null`, `noteX?: number`, `noteY?: number`
- Remove field: `noteTarget` (always null, no longer needed)

### 2. Parsing: Handle all `<note>` elements as positioned notes
- **File**: `src/parser/parsing.ts`
- In `buildContainerTree`: collect `<note>` children and determine their parent DSLNode from surrounding element context
- Create DSLNode for each note with x/y attributes, `parentId` set to containing node id, auto-generated ID
- Skip `<note>` without x or y attributes (tooltip-only content)
- Remove: the skip for `<note name="X">` — ALL notes now use x/y positioning

### 3. Layout: Position notes by grid offset from parent
- **File**: `src/layout/main.ts` — `layoutUnpositionedNodes()`
- After non-note nodes positioned, compute note positions using grid offsets
- If parent not found, skip the note entirely (spec: "only placed as child of node, or ignored")

### 4. Links: Create note-to-parent links (arrowhead at parent end)
- **File**: `src/layout/main.ts` — create `{ source: note.id, target: parentId, type: 'default' }`
- **File**: `src/render/render-nodes.ts` — remove the `isNoteTarget` arrowhead reversal

### 5. Tooltips: Remove attached note node gathering
- **File**: `src/notes.ts` — simplify `getNodeNotes()`, remove `isAttachedNote()`

### 6. Tests, docs, playground examples as per plan