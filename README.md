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

```eventstorming
<eventstorming>
  <aggregate name="User">
     <container name="User Registration">
        <actor name="Customer1" next="Register" />
        <command name="Register" next="Is Email Valid?" />
        <policy name="Is Email Valid?" next="UserRegistered" negativeNext="Invalid Email" />
        <error name="Invalid Email"><note>The email address provided is not valid. Please enter a valid email address and try again.</note></error>
        <event name="UserRegistered" next="Some Note" />
        <note name="Some Note"><note>This is a note attached to the UserRegistered event.</note></note>
     </container>
  </aggregate>
    <aggregate name="Morning Routine">
      <container name="Wake Up">
          <actor name="Me" next="Wake Up" />
          <command name="Wake Up" next="Is Alarm Ringing?" />
          <policy name="Is Alarm Ringing?" next="Got Out of Bed" negativeNext="Sleep In" />
          <error name="Sleep In" />
          <event name="Got Out of Bed" />
      </container>
      <container name="Shower">
          <command name="Have Shower" next="Is the shower running?" />
          <policy name="Is the shower running?" next="Have shower gel?" negativeNext="Switch on shower" />
          <externalSystem name="Switch on shower" next="Have shower gel?" />
          <policy name="Have shower gel?" next="Had Shower" negativeNext="Go Buy Shower Gel" />
          <error name="Go Buy Shower Gel" />
          <event name="Had Shower" />
      </container>
  </aggregate>
  <aggregate name="User Profile">
      <container name="Update Profile">
          <note>This process allows users to update their profile information, but only if they are authenticated. If the user is not authenticated, an error is returned.</note>
          <actor name="Customer" next="UpdateProfile" />
          <command name="UpdateProfile" next="Is User Authenticated?" />
          <policy name="Is User Authenticated?" next="ProfileUpdated" negativeNext="Authentication Required" />
          <error name="Authentication Required"><note>You must be logged in to update your profile. Please log in and try again.</note></error>
          <event name="ProfileUpdated" />
      </container>
  </aggregate>
  <aggregate name="Order">
      <container name="Place Order">
          <command name="PlaceOrder" next="IsAddressValid" />
          <container name="PlaceOrder">
               <policy name="IsAddressValid" next="IsEmailValid" negativeNext="AddressIsInValid" />
               <policy name="IsEmailValid" next="Do Something" negativeNext="Email is invalid" />
               <container name="Another Sub Process">
                  <command name="Do Something" next="Is Something Valid?" />
                  <policy name="Is Something Valid?" next="InventoryService" negativeNext="Something Is Invalid" />
                  <error name="Something Is Invalid"><note>Something is invalid, please review and try again.</note></error>
               </container>
          </container>
          <externalSystem name="InventoryService" next="Do We Have Stock?" />
          <policy name="Do We Have Stock?" next="Is Order Detail Valid?" negativeNext="Out Of Stock" />
          <policy name="Is Order Detail Valid?" next="PaymentGateway" negativeNext="Invalid Order Detail" />
          <error name="Invalid Order Detail"><note>Order details are invalid, please review your order and try again.</note></error>
          <externalSystem name="PaymentGateway" next="Is Payment Successful?" />
          <policy name="Is Payment Successful?" next="OrderPlaced" negativeNext="PaymentFailed" />
          <error name="PaymentFailed"><note>Payment failed, please try again or use a different payment method. Client should handle this error.</note></error>
          <event name="OrderPlaced" />
      </container>    
  </aggregate>
  <externalSystem name="Inventory Service">
      <container name="Inventory Check">
          <command name="Check Inventory" next="Get Inventory" />
          <query name="Get Inventory" next="Has Stock?" />
          <policy name="Has Stock?" next="InventoryCheckPassed" negativeNext="Out of Stock" />
          <event name="Inventory Check Passed" />
      </container>
  </externalSystem>
  <projector name="OrderDetail">
      <container name="Order Detail Projection">
          <event name="OrderPlaced" next="Order Detail View" />
          <event name="OrderCancelled" next="Order Detail View" />
          <event name="OrderUpdated" next="Order Detail View" />
          <event name="OrderShipped" next="Order Detail View" />
          <readModel name="Order Detail View"><note>This view is used to display the details of an order, including its status, items, and other relevant information.</note></readModel>
      </container>
  </projector>
  <process name="Customer Order View">
      <container name="View Order Details">
          <actor name="Customer" next="GetOrderDetails" />
          <query name="GetOrderDetails" next="Order Detail Projection" />
          <readModel name="Order Detail Projection" />
      </container>
  </process>
</eventstorming>
```

The diagram will render inline, replacing the code block automatically.

The same diagram can also be written in JSON (use a `json` fenced block for editor syntax help):

```json
[
  {
    "type": "Aggregate",
    "name": "User",
    "containers": [
      {
        "name": "User Registration",
        "children": [
          { "type": "Actor", "name": "Customer1", "next": "Register" },
          { "type": "Command", "name": "Register", "next": "Is Email Valid?" },
          { "type": "Policy", "name": "Is Email Valid?", "next": "UserRegistered", "negativeNext": "Invalid Email" },
          { "type": "Error", "name": "Invalid Email", "notes": ["The email address provided is not valid. Please enter a valid email address and try again."] },
          { "type": "Event", "name": "UserRegistered", "next": "Some Note" },
          { "type": "Note", "name": "Some Note", "notes": ["This is a note attached to the UserRegistered event."] }
        ]
      }
    ]
  }
]
```

Supported diagram types are `Aggregate`, `ExternalSystem`, `Projector`, and `Process`.

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
- Notes can be added to diagrams, containers, or nodes. Elements with notes show a small `i` badge, and hovering them shows a notes-only tooltip. In the XML DSL, add one or more `<note>` child elements (without a `name` attribute) to attach notes; in the JSON DSL, use the `notes` string array.
- `Note` is a supported node type and renders as a light-yellow note node rather than a command. In the XML DSL a note node requires a `name` attribute: `<note name="My Note" />`.

### Recursive Containers

A container's `children` array may mix `Node` elements with nested `Container` elements. Each nested container becomes its own labelled sub-group rendered inside the parent container.

However, the event storming diagram should be kept as flat as possible for readability, so use nested containers sparingly. They can be useful for grouping related sub-flows together, but too much nesting can make the diagram harder to read. 

This extension only test up to 2 levels of nesting.

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
