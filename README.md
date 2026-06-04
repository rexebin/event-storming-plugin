# Event Storming Diagram Renderer for GitHub and VS Code

A **browser extension** (Manifest V3) and **VS Code Markdown preview extension** that render **event storming** diagrams from fenced code blocks.

## Features

- 🎨 Full event storming visual language: events, commands, queries, aggregates, actors, policies, views, read models, external systems, errors, and note nodes
- 📦 Container-based layout: JSON DSL containers render as visual boxes for aggregates, external systems, read models, and process containers
- 🗂️ Nested process groups: each child group renders inside a dashed sub-container with the group name in the top-left corner
- ⬅️→ Left-to-right process flows: actor → command/query/policy → event inside containers, with policy failure branches rendered below
- ↘️ Directional arrows with shared-target fan-in layouts for commands and views
- 🔍 Interactive zoom & pan
- 💡 Notes-only tooltips: tooltips appear only for containers, groups, or nodes that have notes
- 📝 Note badges on containers, groups, and nodes that have notes
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
    "notes": ["This aggregate represents a user in the system, including their registration and profile management processes."],
    "containers": [
      {
        "name": "User Registration",
        "notes": ["This process handles user registration, including validating the email address and creating a new user account if the email is valid."],
        "children": [
          { "type": "Actor", "name": "Customer1", "next": "Register" },
          { "type": "Command", "name": "Register", "next": "Is Email Valid?" },
          { "type": "Policy", "name": "Is Email Valid?", "next": "UserRegistered", "negativeNext": "Invalid Email" },
          { "type": "Error", "name": "Invalid Email", "notes": ["The email address provided is not valid. Please enter a valid email address and try again."] },
          { "type": "Event", "name": "UserRegistered", "next":"Some Note" },
          { "type": "Note", "name": "Some Note", "notes": ["This is a note attached to the UserRegistered event."] }
        ]
      }
    ]
  },
  {
    "type": "Aggregate",
    "name": "Morning Routine",
    "containers": [
      {
        "name": "Wake Up",
        "children": [
          { "type": "Actor", "name": "Me", "next": "Wake Up" },
          { "type": "Command", "name": "Wake Up", "next": "Is Alarm Ringing?" },
          { "type": "Policy", "name": "Is Alarm Ringing?", "next": "Got Out of Bed", "negativeNext": "Sleep In" },
          { "type": "Error", "name": "Sleep In" },
          { "type": "Event", "name": "Got Out of Bed" }
        ]
      },
      {
        "name": "Shower",
        "children": [
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
    "name": "User Profile",
    "containers": [
      {
        "name": "Update Profile",
        "notes": ["This process allows users to update their profile information, but only if they are authenticated. If the user is not authenticated, an error is returned."],
        "children": [
          { "type": "Actor", "name": "Customer", "next": "UpdateProfile" },
          { "type": "Command", "name": "UpdateProfile", "next": "Is User Authenticated?" },
          { "type": "Policy", "name": "Is User Authenticated?", "next": "ProfileUpdated", "negativeNext": "Authentication Required" },
          { "type": "Error", "name": "Authentication Required", "notes": ["You must be logged in to update your profile. Please log in and try again."] },
          { "type": "Event", "name": "ProfileUpdated" }
        ]
      }
    ]
  },
  {
    "type": "Aggregate",
    "name": "Order",
    "containers": [
      {
        "name": "Place Order",
        "children": [
          { "type": "Command", "name": "PlaceOrder", "next": "IsAddressValid" },
          { 
            "name": "PlaceOrder", 
            "children": [
               { "type": "Policy", "name": "IsAddressValid", "next": "IsEmailValid", "negativeNext": "AddressIsInValid" },
               { "type": "Policy", "name": "IsEmailValid", "next": "Do Something", "negativeNext": "Email is invalid" },
               { 
                "name": "Another Sub Process", 
                "children": [
                  { "type": "Command", "name": "Do Something", "next": "Is Something Valid?" },
                  { "type": "Policy", "name": "Is Something Valid?", "next": "InventoryService", "negativeNext": "Something Is Invalid" },
                  { "type": "Error", "name": "Something Is Invalid", "notes": ["Something is invalid, please review and try again."] }
                ]
               }
            ]
          },
          { "type": "ExternalSystem", "name": "InventoryService", "next": "Do We Have Stock?" },
          { "type": "Policy", "name": "Do We Have Stock?", "next": "Is Order Detail Valid?", "negativeNext": "Out Of Stock" },
          { "type": "Policy", "name": "Is Order Detail Valid?", "next": "PaymentGateway", "negativeNext": "Invalid Order Detail" },
          { "type": "Error", "name": "Invalid Order Detail", "notes": ["Order details are invalid, please review your order and try again."] },
          { "type": "ExternalSystem", "name": "PaymentGateway", "next": "Is Payment Successful?" },
          { "type": "Policy", "name": "Is Payment Successful?", "next": "OrderPlaced", "negativeNext": "PaymentFailed" },
          { "type": "Error", "name": "PaymentFailed", "notes": ["Payment failed, please try again or use a different payment method.", "Client should handle this error."] },
          { "type": "Event", "name": "OrderPlaced" }
        ]
      }    
    ]
  },
  {
    "type": "ExternalSystem",
    "name": "Inventory Service",
    "containers": [
      {
        "name": "Inventory Check",
        "children": [
          { "type": "Command", "name": "Check Inventory", "next": "Get Inventory" },
          { "type": "Query", "name": "Get Inventory", "next": "Has Stock?" },
          { "type": "Policy", "name": "Has Stock?", "next": "InventoryCheckPassed", "negativeNext": "Out of Stock" },
          { "type": "Event", "name": "Inventory Check Passed" }
        ]
      }
    ]
  },
  {
    "type": "Projector",
    "name": "OrderDetail",
    "containers": [
      {
        "name": "Order Detail Projection",
        "children": [
          { "type": "Event", "name": "OrderPlaced", "next": "Order Detail View" },
          { "type": "Event", "name": "OrderCancelled", "next": "Order Detail View" },
          { "type": "Event", "name": "OrderUpdated", "next": "Order Detail View" },
          { "type": "Event", "name": "OrderShipped", "next": "Order Detail View" },
          { "type": "ReadModel", "name": "Order Detail View", "notes": ["This view is used to display the details of an order, including its status, items, and other relevant information."] }
        ]
      }
    ]
  },
  {
    "type": "Process",
    "name": "Customer Order View",
    "containers": [
      {
        "name": "View Order Details",
        "children": [
          { "type": "Actor", "name": "Customer", "next": "GetOrderDetails" },
          { "type": "Query", "name": "GetOrderDetails", "next": "Order Detail Projection" },
          { "type": "ReadModel", "name": "Order Detail Projection" }
        ]
      }
    ]
  }
]
```

The diagram will render inline, replacing the code block automatically.

For the JSON DSL shown above, supported diagram types are `Aggregate`, `ExternalSystem`, `Projector`, and `Process`.

## Usage in VS Code

Open a Markdown file containing an `eventstorming` fenced block or a matching `json` fenced block, then run **Markdown: Open Preview to the Side**.

The built-in Markdown preview keeps normal Markdown rendering and replaces matching blocks with the diagram UI.

> **Note:** The current VS Code integration targets the desktop Markdown preview.

## DSL Reference

The current DSL is JSON. Its shape matches the implementation in `src/dsl-type.ts`:

```ts
enum DiagramType {
  Aggregate = "Aggregate",
  ExternalSystem = "ExternalSystem",
  Projector = "Projector",
  Process = "Process",
}

enum NodeType {
  Aggregate = "Aggregate",
  Actor = "Actor",
  Command = "Command",
  Event = "Event",
  Query = "Query",
  Policy = "Policy",
  Error = "Error",
  ExternalSystem = "ExternalSystem",
  Note = "Note",
  ReadModel = "ReadModel",
}

interface Diagram {
  type: DiagramType;
  name: string;
  notes?: string[];
  containers: Container[];
}

interface Container {
  name: string;
  notes?: string[];
  children: (Node | Container)[];
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

- The top-level array contains `Diagram` objects, each rendered as a labelled outer box.
- `containers` defines named process groups inside a diagram, rendered as dashed sub-boxes.
- `children` inside a container holds `Node` elements or nested `Container` elements (recursive nesting supported).
- `next` links to another node in the same container and renders to the **right**.
- `negativeNext` is used for policy failure paths and renders **below** the policy.
- If a policy omits a matching negative-path node, the renderer creates a default error node.
- `notes` can be added to diagrams, containers, or nodes. Elements with notes show a small `i` badge, and hovering them shows a notes-only tooltip.
- `Note` is a supported node type and renders as a light-yellow note node rather than a command.

### Recursive Containers

A container's `children` array may mix `Node` elements with nested `Container` elements. Each nested container becomes its own labelled sub-group rendered inside the parent container.

```json
[
  {
    "type": "Aggregate",
    "name": "Order",
    "containers": [
      {
        "name": "Order Lifecycle",
        "notes": ["Top-level group grouping placement and cancellation sub-flows."],
        "children": [
          {
            "name": "Place Order",
            "children": [
              { "type": "Actor", "name": "Customer", "next": "PlaceOrder" },
              { "type": "Command", "name": "PlaceOrder", "next": "Is Payment Valid?" },
              { "type": "Policy", "name": "Is Payment Valid?", "next": "OrderPlaced", "negativeNext": "PaymentFailed" },
              { "type": "Error", "name": "PaymentFailed" },
              { "type": "Event", "name": "OrderPlaced" }
            ]
          },
          {
            "name": "Cancel Order",
            "children": [
              { "type": "Actor", "name": "Customer", "next": "CancelOrder" },
              { "type": "Command", "name": "CancelOrder", "next": "OrderCancelled" },
              { "type": "Event", "name": "OrderCancelled" }
            ]
          }
        ]
      }
    ]
  }
]
```

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
