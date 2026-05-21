# Event Storming Diagram Renderer for GitHub and VS Code

A **browser extension** (Manifest V3) and **VS Code Markdown preview extension** that render **event storming** diagrams from fenced code blocks.

## Features

- 🎨 Full event storming visual language: events, commands, queries, aggregates, actors, policies, views, read models, external systems, errors, temp objects, notes
- 📦 Container-based layout: JSON DSL containers render as visual boxes for aggregates, external systems, read models, and processes
- 🗂️ Group subgraphs: each child group renders inside its own nested container with the group name in the top-left corner
- ⬅️→ Left-to-right process flows: actor → command/query/policy → event inside containers
- ↘️ Directional arrows with shared-target fan-in layouts for commands and views
- 🔍 Interactive zoom & pan
- 💡 Tooltips on hover, including attached notes
- 📝 Note badge on nodes that have notes
- 🎯 Collapsible diagrams with toggle button
- 🌈 Color-coded rectangles (black border) per event storming standard:
  - **Orange** (`#FFA500`) → Domain Events
  - **Light Green** (`#91D49C`) → Commands
  - **Dark Green** (`#5BAA62`) → Queries / Read Models
  - **Yellow** (`#FEE254`) → Aggregates
  - **Yellow** (`#FEE254`) → Views
  - **Gray** (`#D4D3D3`) → Actors
  - **Blue** (`#859EBF`) → Policies
  - **Pink** (`#FB8597`) → External Systems
  - **Cyan** (`#8DCFF9`) → Errors
  - **Light Yellow** (`#FFF1AA`) → Temp Objects / Notes

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Build

```bash
npm run build
```

This bundles TypeScript (via esbuild IIFE) and copies assets into `dist/`.

### 3. Run Tests

```bash
npm test
```

### 4. Load in Edge (or Chrome)

1. Open `edge://extensions/` (or `chrome://extensions/`)
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### 5. Package for VS Code

```bash
npm run package:vscode
```

This creates a `.vsix` file that can be shared or installed using **Extensions: Install from VSIX...**

## Usage on GitHub

In any Markdown file (README, issue, PR comment, wiki), you can use:

- `eventstorming` for the text DSL
- `json` for the JSON DSL, which gives editors JSON syntax help

```json
[
  {
    "type": "Aggregate",
    "name": "User",
    "children": [
      {
        "name": "User Registration",
        "nodes": [
          { "type": "Actor", "name": "Customer", "next": "Register" },
          { "type": "Command", "name": "Register", "next": "Is Email Valid?" },
          { "type": "Policy", "name": "Is Email Valid?", "next": "UserRegistered", "negativeNext": "Invalid Email" },
          { "type": "Error", "name": "Invalid Email", "notes": ["The email address provided is not valid. Please enter a valid email address and try again."] },
          { "type": "Event", "name": "UserRegistered" }
        ],
        "notes": ["This process handles user registration, including validating the email address and creating a new user account if the email is valid."]
      }
    ]
  },
  {
    "type": "Aggregate",
    "name": "Morning Routine",
    "children": [
      {
        "name": "Wake Up",
        "nodes": [
          { "type": "Actor", "name": "Me", "next": "Wake Up" },
          { "type": "Command", "name": "Wake Up", "next": "Is Alarm Ringing?" },
          { "type": "Policy", "name": "Is Alarm Ringing?", "next": "Got Out of Bed", "negativeNext": "Sleep In" },
          { "type": "Error", "name": "Sleep In" },
          { "type": "Event", "name": "Got Out of Bed" }
        ]
      },
      {
        "name": "Shower",
        "nodes": [
          { "type": "Command", "name": "Have Shower", "next": "Is the shower running?" },
          { "type": "Policy", "name": "Is the shower running?", "next": "Have shower gel?", "negativeNext": "Switch on shower" },
          { "type": "ExternalSystem", "name": "Switch on shower", "next": "Have shower gel?" },
          { "type": "Policy", "name": "Have shower gel?", "next": "Had Shower", "negativeNext": "Go Buy Shower Gel" },
          { "type": "Error", "name": "Go Buy Shower Gel" },
          { "type": "Event", "name": "Had Shower" }
        ]
      }
    ]
  },
  {
    "type": "Aggregate",
    "name": "Order",
    "children": [    
      {
        "name": "Place Order",
        "nodes": [
          { "type": "Command", "name": "PlaceOrder", "next": "InventoryService" },
          { "type": "ExternalSystem", "name": "InventoryService", "next": "Do We Have Stock?" },
          { "type": "Policy", "name": "Do We Have Stock?", "next": "Is Order Detail Valid?", "negativeNext": "Out Of Stock" },
          { "type": "Policy", "name": "Is Order Detail Valid?", "next": "PaymentGateway", "negativeNext": "Invalid Order Detail" },
          { "type": "Error", "name": "Invalid Order Detail", "notes": ["Order details are invalid, please review your order and try again."] },
          { "type": "ExternalSystem", "name": "PaymentGateway", "next": "Is Payment Successful?" },
          { "type": "Policy", "name": "Is Payment Successful?", "next": "OrderPlaced", "negativeNext": "PaymentFailed" },
          { "type": "Error", "name": "PaymentFailed", "notes": ["Payment failed, please try again or use a different payment method.", "Client should handle this error."] },
          { "type": "Event", "name": "OrderPlaced" }       
        ]
      },      
      {
        "name": "Cancel Order",
        "nodes": [
          { "type": "Actor", "name": "Customer", "next": "CancelOrder" },
          { "type": "Actor", "name": "Staff", "next": "CancelOrder" },
          { "type": "Event", "name": "PaymentFailed", "next": "CancelOrder" },
          { "type": "Command", "name": "CancelOrder", "next": "Is Cancellation Allowed?" },
          { "type": "Policy", "name": "Is Cancellation Allowed?", "next": "OrderCancelled", "negativeNext": "CancellationDenied" },
          { "type": "Event", "name": "OrderCancelled", "notes": ["Order has been cancelled successfully.", "another note"] }         
        ]
      }
    ]
  },
  {
    "type": "ExternalSystem",
    "name": "Inventory Service",
    "children": [
      { "name": "Inventory Check", "nodes": [
        {"type": "Command", "name": "Check Inventory", "next": "Get Inventory"},
        {"type": "Query", "name": "Get Inventory", "next": "Has Stock?"},
        {"type": "Policy", "name": "Has Stock?", "next": "InventoryCheckPassed", "negativeNext": "Out of Stock"},
        {"type": "Event", "name": "Inventory Check Passed"}
      ]}
    ]
  },
  {
    "type": "ReadModel",
    "name": "OrderDetail",
    "children": [
      {
        "name": "Order Detail Projection",
        "nodes": [
          { "type": "Event", "name": "OrderPlaced", "next": "Order Detail View" },
          { "type": "Event", "name": "OrderCancelled", "next": "Order Detail View" },
          { "type": "Event", "name": "OrderUpdated", "next": "Order Detail View" },
          { "type": "Event", "name": "OrderShipped", "next": "Order Detail View" },
          { "type": "View", "name": "Order Detail View", "notes": ["This view is used to display the details of an order, including its status, items, and other relevant information."] }
        ]
      }
    ]
  },
  {
    "type": "Process",
    "name": "Customer Order View",
    "children": [
      {
        "name": "View Order Details",
        "nodes": [
          { "type": "Actor", "name": "Customer", "next": "GetOrderDetails" },
          { "type": "Query", "name": "GetOrderDetails", "next": "Order Detail Projection" },
          { "type": "View", "name": "Order Detail Projection" }
        ]
      }
    ]
  }
]
```

The diagram will render inline, replacing the code block automatically.

For the JSON DSL shown above, supported container types are `Aggregate`, `ExternalSystem`, `ReadModel`, and `Process`.

## Usage in VS Code

Open a Markdown file containing an `eventstorming` fenced block or a matching `json` fenced block, then run **Markdown: Open Preview to the Side**.

The built-in Markdown preview keeps normal Markdown rendering and replaces matching blocks with the diagram UI.

> **Note:** The current VS Code integration targets the desktop Markdown preview.

## DSL Reference

The current DSL is JSON. Its shape matches the implementation in `src/dsl-type.ts`:

```ts
type ContainerType = "Aggregate" | "ExternalSystem" | "ReadModel" | "Process";

type NodeType =
  | "Aggregate"
  | "Actor"
  | "Command"
  | "Event"
  | "Query"
  | "Policy"
  | "Error"
  | "ExternalSystem"
  | "Note"
  | "View";

interface Container {
  type: ContainerType;
  name: string;
  notes?: string[];
  children: Group[];
}

interface Group {
  name: string;
  nodes: Node[];
  notes?: string[];
}

interface Node {
  type: NodeType;
  name: string;
  next?: string;
  negativeNext?: string;
  notes?: string[];
}
```

### Schema Notes

- `children` defines independent process groups inside a container.
- `next` links to another node in the same group and renders to the **right**.
- `negativeNext` is used for policy failure paths and renders **below** the policy.
- If a policy omits a matching negative-path node, the renderer creates a default error node.
- `notes` can be added to containers, groups, or nodes. Nodes with notes show a small badge, and hover tooltips include the note text.

## Project Structure

```
├── src/                  # TypeScript source
│   ├── content.ts          # GitHub content script
│   ├── dsl.ts              # DSL parser + types
│   ├── dsl-type.ts          # Container/Process type definitions
│   ├── dsl.test.ts          # DSL parser tests
│   ├── renderer.ts          # D3.js diagram renderer
│   ├── renderer.test.ts     # Renderer tests
│   └── types.d.ts          # D3 type declarations
├── dist/                   # Built output (load this as extension)
│   ├── manifest.json
│   ├── content.js          # Single bundled file (IIFE)
│   └── style.css
├── package.json
├── tsconfig.json
├── build.mjs               # esbuild bundler
└── vitest.config.ts        # Test configuration
```

### Testing

73 tests (51 DSL + 22 renderer) using Vitest with jsdom:

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

## License

MIT
