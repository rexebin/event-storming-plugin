# Event Storming Diagram Renderer for GitHub and VS Code

A **browser extension** (Manifest V3) and **VS Code Markdown preview extension** that render **event storming** diagrams from fenced code blocks.

> ⚠️ **Event storming diagrams should be small and concise.** A complex or sprawling event storming diagram is often a signal — not an achievement — that the underlying domain design or code structure needs simplification. 

> In DDD practice, event storming is a collaborative discovery tool for building shared understanding, not a comprehensive documentation artifact. 

> If your diagram feels overwhelming, consider: 
> 1. are you capturing implementation details instead of bounded behaviors? 
> 2. Are aggregates too fat? Is a single bounded context trying to model an entire enterprise workflow? 

> Good event storming models fit on a wall and spark conversation, not serve as reference architecture documents. See [Alberto Brandolini's Big Picture Event Storming](https://www.eventstorming.com/) and the [DDD Community guidelines](https://dddcommunity.org/) for best practices.

> This project aims to accommodate moderate complexity. PRs are welcome, but simplicity wins over supporting overly complex event storming diagrams.

## Features

- 🎨 Full event storming visual language: events, commands, queries, aggregates, actors, policies, views, read models, external systems, errors, and note nodes
- 📦 Container-based layout: XML DSL containers render as visual boxes for aggregates, external systems, read models, and process containers
- 🗂️ Nested process groups: each child group renders inside a dashed sub-container with the group name in the top-left corner
- ⬅️→ Left-to-right process flows: actor → command/query/policy → event inside containers, with failure branches rendered below nodes
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

In any Markdown file (README, issue, PR comment, wiki), write a fenced code block using either DSL format. The extension replaces the block with an interactive diagram inline.

### XML DSL

Use a ` ```xml ` block. XML is more concise to write by hand and supports multiple notes per element via child `<note>` elements.

```text
<eventstorming>
  <aggregate name="Complex Vertical Example (Ignore the logic, it's just for testing vertical layout)">
      <container name="Complex Vertical Example">
          <actor name="Customer" />
          <command name="Call Service" altNext="Have reached max retries?" />
          <policy name="Call Succeeded?" altNext="Service didn't respond correctly" next="Record Call" />
          <command name="Record Call" />
          <event name="Call Recorded" next="" />
          <error name="Service didn't respond correctly" altNext="Server Error?" next=""></error>
          <policy name="Server Error?" altNext="Status code is not 422" next="Have reached max retries?"  />
          <error name="Status code is not 422" altNext="Another condition?" ></error>
          <command name="Reject Call" altNext="Rejected Exception?" />
          <event name="Call Rejected" next="" />
          <policy name="Another condition?" next="" altNext="Record Call" />
          <policy name="Have reached max retries?" altNext="Failed Exception"  />
          <command name="Record Failed Attempt" altNext="Failed Exception" offset="1"/>
          <event name="Failed Attempt Recorded" next="" altNext="failed-exception-1"/>
          <policy name="Failed Exception" next="Call Recorded" ></policy>
          <error id="failed-exception-1" name="Failed Exception"></error>       
      </container>
  </aggregate>
  <aggregate name="User">
     <container name="User Registration">
        <actor name="Customer1" />
        <command name="Register" />
        <policy name="Is Email Valid?" altNext="Invalid Email" />
        <error name="Invalid Email" next=""><note>The email address provided is not valid. Please enter a valid email address and try again.</note></error>
        <event name="UserRegistered" />
        <note name="Some Note"><note>This is a note attached to the UserRegistered event.</note></note>
     </container>
  </aggregate>
  <aggregate name="Morning Routine">
      <container name="Wake Up">
          <actor name="Me"/>
          <command name="Wake Up" />
          <policy name="Is Alarm Ringing?" altNext="Sleep In" />
          <error name="Sleep In" next=""><note>You chose to sleep in instead of waking up.</note></error>
          <event name="Got Out of Bed" />
      </container>
      <container name="Shower">
          <command name="Have Shower" />
          <policy name="Is the shower running?" next="Have shower gel?" altNext="Switch on shower" />
          <externalSystem name="Switch on shower" />
          <policy name="Have shower gel?" altNext="Go Buy Shower Gel" />
          <error name="Go Buy Shower Gel" next="" />
          <event name="Had Shower" />
      </container>
  </aggregate>
  <aggregate name="User Profile">
      <container name="Update Profile">
          <note>This process allows users to update their profile information, but only if they are authenticated. If the user is not authenticated, an error is returned.</note>
          <actor name="Customer" />
          <command name="UpdateProfile" />
          <policy name="Is User Authenticated?" altNext="Authentication Required" />
          <error name="Authentication Required" next=""><note>You must be logged in to update your profile. Please log in and try again.</note></error>
          <event name="ProfileUpdated" />
      </container>
  </aggregate>
  <aggregate name="Order">
      <container name="Place Order">
          <command name="PlaceOrder" next="IsAddressValid" />
          <container name="PlaceOrder">
               <policy name="IsAddressValid" altNext="AddressIsInValid" />
               <policy name="IsEmailValid" next="Do Something" altNext="Email is invalid" />
               <container name="Another Sub Process">
                  <command name="Do Something" />
                  <policy name="Is Something Valid?" next="InventoryService" altNext="Something Is Invalid" />
                  <error name="Something Is Invalid" next=""><note>Something is invalid, please review and try again.</note></error>
               </container>
          </container>
          <externalSystem name="InventoryService" />
          <policy name="Do We Have Stock?" altNext="Out Of Stock" />
          <policy name="Is Order Detail Valid?" altNext="Invalid Order Detail" />
          <error name="Invalid Order Detail" next=""><note>Order details are invalid, please review your order and try again.</note></error>
          <externalSystem name="PaymentGateway" />
          <policy name="Is Payment Successful?" altNext="PaymentFailed" />
          <error name="PaymentFailed" next=""><note>Payment failed, please try again or use a different payment method. Client should handle this error.</note></error>
          <event name="OrderPlaced" />
      </container>
  </aggregate>
  <externalSystem name="Inventory Service">
      <container name="Inventory Check">
          <command name="Check Inventory" />
          <query name="Get Inventory" />
          <policy name="Has Stock?" next="InventoryCheckPassed" altNext="Out of Stock" />
          <event name="Inventory Check Passed" />
      </container>
  </externalSystem>
  <projector name="OrderDetail">
      <container name="Order Detail Projection">
          <event name="OrderPlaced" next="Order Detail View" />
          <event name="OrderCancelled" next="Order Detail View" />
          <event name="OrderUpdated" next="Order Detail View" />
          <event name="OrderShipped" />
          <projector name="Order Detail View"><note>This view is used to display the details of an order, including its status, items, and other relevant information.</note></projector>
      </container>
  </projector>
  <process name="Customer Order View">
      <container name="View Order Details">
          <actor name="Customer" />
          <query name="GetOrderDetails" />
          <projector name="Order Detail Projection" />
      </container>
  </process>
  
</eventstorming>
```

Rendered:

```xml
<eventstorming>
  <aggregate name="Complex Vertical Example (Ignore the logic, it's just for testing vertical layout)">
      <container name="Complex Vertical Example">
          <actor name="Customer" />
          <command name="Call Service" altNext="Have reached max retries?" />
          <policy name="Call Succeeded?" altNext="Service didn't respond correctly" next="Record Call" />
          <command name="Record Call" />
          <event name="Call Recorded" next="" offset="1"/>
          <error name="Service didn't respond correctly" altNext="Server Error?" next="" offset="-1"></error>
          <policy name="Server Error?" altNext="Status code is not 422" next="Have reached max retries?"  />
          <error name="Status code is not 422" altNext="Another condition?" ></error>
          <command name="Reject Call" altNext="Rejected Exception?" />
          <event name="Call Rejected" next="" />
          <policy name="Another condition?" next="" altNext="Record Call" />
          <policy name="Have reached max retries?" altNext="Failed Exception"  />
          <command name="Record Failed Attempt" altNext="Failed Exception" offset="1"/>
          <event name="Failed Attempt Recorded" next="" altNext="failed-exception-1"/>
          <policy name="Failed Exception" next="Call Recorded" ></policy>
          <error id="failed-exception-1" name="Failed Exception"></error>       
      </container>
  </aggregate>
  <aggregate name="User">
     <container name="User Registration">
        <actor name="Customer1" />
        <command name="Register" />
        <policy name="Is Email Valid?" altNext="Invalid Email" />
        <error name="Invalid Email" next=""><note>The email address provided is not valid. Please enter a valid email address and try again.</note></error>
        <event name="UserRegistered" />
        <note name="Some Note"><note>This is a note attached to the UserRegistered event.</note></note>
     </container>
  </aggregate>
  <aggregate name="Morning Routine">
      <container name="Wake Up">
          <actor name="Me"/>
          <command name="Wake Up" />
          <policy name="Is Alarm Ringing?" altNext="Sleep In" />
          <error name="Sleep In" next=""><note>You chose to sleep in instead of waking up.</note></error>
          <event name="Got Out of Bed" />
      </container>
      <container name="Shower">
          <command name="Have Shower" />
          <policy name="Is the shower running?" next="Have shower gel?" altNext="Switch on shower" />
          <externalSystem name="Switch on shower" />
          <policy name="Have shower gel?" altNext="Go Buy Shower Gel" />
          <error name="Go Buy Shower Gel" next="" />
          <event name="Had Shower" />
      </container>
  </aggregate>
  <aggregate name="User Profile">
      <container name="Update Profile">
          <note>This process allows users to update their profile information, but only if they are authenticated. If the user is not authenticated, an error is returned.</note>
          <actor name="Customer" />
          <command name="UpdateProfile" />
          <policy name="Is User Authenticated?" altNext="Authentication Required" />
          <error name="Authentication Required" next=""><note>You must be logged in to update your profile. Please log in and try again.</note></error>
          <event name="ProfileUpdated" next="" />
      </container>
  </aggregate>
  <aggregate name="Order">
      <container name="Place Order">
          <command name="PlaceOrder" next="IsAddressValid" />
          <container name="PlaceOrder">
               <policy name="IsAddressValid" altNext="AddressIsInValid" />
               <policy name="IsEmailValid" next="Do Something" altNext="Email is invalid" />
               <container name="Another Sub Process">
                  <command name="Do Something" />
                  <policy name="Is Something Valid?" next="InventoryService" altNext="Something Is Invalid" />
                  <error name="Something Is Invalid" next=""><note>Something is invalid, please review and try again.</note></error>
               </container>
          </container>
          <externalSystem name="InventoryService" />
          <policy name="Do We Have Stock?" altNext="Out Of Stock" />
          <policy name="Is Order Detail Valid?" altNext="Invalid Order Detail" />
          <error name="Invalid Order Detail" next=""><note>Order details are invalid, please review your order and try again.</note></error>
          <externalSystem name="PaymentGateway" />
          <policy name="Is Payment Successful?" altNext="PaymentFailed" />
          <error name="PaymentFailed" next=""><note>Payment failed, please try again or use a different payment method. Client should handle this error.</note></error>
          <event name="OrderPlaced" />
      </container>
  </aggregate>
  <externalSystem name="Inventory Service">
      <container name="Inventory Check">
          <command name="Should match the policy with id" next="this-is-a-id" />
          <command name="Should match the policy without id" next="Has Stock?" />
          <policy id="this-is-a-id" name="Has Stock?" next="Inventory Check Passed" altNext="Out of Stock" />
          <query name="Get Inventory" />
          <command name="Check Inventory" />
          <policy name="Has Stock?" next="Inventory Check Passed" altNext="Out of Stock" />
          <event name="Inventory Check Passed" />
      </container>
  </externalSystem>
  <projector name="OrderDetail">
      <container name="Order Detail Projection">
          <event name="OrderPlaced" next="Order Detail View" />
          <event name="OrderCancelled" next="Order Detail View" />
          <event name="OrderUpdated" next="Order Detail View" />
          <event name="OrderUpdated1" next="Order Detail View" />
          <event name="OrderUpdated2" next="Order Detail View" />
          <event name="OrderUpdated3" next="Order Detail View" />
          <event name="OrderUpdated4" next="Order Detail View" />
          <event name="OrderUpdated5" next="Order Detail View" />
          <event name="OrderUpdated6" next="Order Detail View" />
          <event name="OrderShipped" />
          <projector name="Order Detail View"><note>This view is used to display the details of an order, including its status, items, and other relevant information.</note></projector>
      </container>
  </projector>
  <process name="Customer Order View">
      <container name="View Order Details">
          <actor name="Customer" />
          <query name="GetOrderDetails" />
          <projector name="Order Detail Projection" />
      </container>
  </process>
  
</eventstorming>
```

## DSL Reference

### Node Types

| XML Element      | Event Storming Type | Color              |
| ---------------- | ------------------- | ------------------ |
| `<event>`        | Domain Event        | Orange             |
| `<command>`      | Command             | Light Green        |
| `<query>`        | Query               | Dark Green         |
| `<aggregate>`    | Aggregate           | Yellow             |
| `<projector>`    | Projector (View)    | Yellow             |
| `<actor>`        | Actor               | Gray               |
| `<policy>`       | Policy              | Blue               |
| `<error>`        | Error               | Cyan               |
| `<externalSystem>` | External System   | Pink               |
| `<projector>`    | Projector           | Dark Green         |
| `<note>`         | Note                | Light Yellow       |

### Attributes

- `name` — the label shown on the node
- `next` — links to another node in the same container and renders to the **right**. **`next` is optional** — if omitted, the node automatically connects to the immediately following sibling in the container, so you only need to set it when jumping non-sequentially.
- `altNext` — used for policy failure paths and renders **below** the policy. When a policy has an `altNext` pointing to an inline `error` node, that error node is automatically skipped when inferring the implicit `next`. The positive flow continues to the node after the error, while the error only appears on the negative branch.
- `offset` — shifts a node horizontally to the right by the given number of units. Use when an `altNext` failure branch would visually collide with a sibling node, e.g. `offset="1"`. The entire subtree (including nested `<container>` and altNext children) shifts together.
- `<note>...</note>` — child element to attach one or more notes to any node. Elements with notes show a small `i` badge, and hovering them shows a notes-only tooltip.

### Diagram Types

The top-level elements define the diagram layout container:

- `<aggregate>` — represents an aggregate root; containers inside render as grouped boxes
- `<externalSystem>` — represents an external system
- `<projector>` — represents a projector/view
- `<process>` — represents a business process

### Recursive Containers

A container may include nested `<container>` elements. Each nested container becomes its own labelled sub-group rendered inside the parent container.

However, the event storming diagram should be kept as flat as possible for readability, so use nested containers sparingly. They can be useful for grouping related sub-flows together, but too much nesting can make the diagram harder to read.

This extension only tests up to 2 levels of nesting.

```text
<eventstorming>
  <aggregate name="Order">
    <container name="Order Lifecycle">
      <note>Top-level group grouping placement and cancellation sub-flows.</note>
      <container name="Place Order">
        <actor name="Customer" />
        <command name="PlaceOrder" />
        <policy name="Is Payment Valid?" altNext="PaymentFailed" />
        <error name="PaymentFailed" />
        <event name="OrderPlaced" />
      </container>
      <container name="Cancel Order">
        <actor name="Customer" />
        <command name="CancelOrder" />
        <event name="OrderCancelled" />
      </container>
    </container>
  </aggregate>
</eventstorming>
```

Rendered:

```xml
<eventstorming>
  <aggregate name="Order">
    <container name="Order Lifecycle Container">
      <note>Top-level group grouping placement and cancellation sub-flows.</note>
      <container name="Place Order">
        <actor name="Customer" />
        <command name="PlaceOrder" />
        <policy name="Is Payment Valid?" altNext="PaymentFailed" />        
        <event name="OrderPlaced" />
      </container>
      <container name="Cancel Order Container">
        <actor name="Customer" next="PlaceOrder" altNext="CancelOrder" />
        <command name="CancelOrder" />
        <event name="OrderCancelled" />
      </container>
    </container>
    <container name="Cancel Order 1 Container">
        <actor name="Customer 1" next="Place Order" altNext="CancelOrder 1" />
        <command name="CancelOrder 1" altNext="Exception!" />
        <event name="OrderCancelled 1" />
    </container>
  </aggregate>
</eventstorming>
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

97 tests (56 DSL + 34 renderer + 5 block detection + 2 preview source) using Vitest with jsdom:

```bash
npm test              # Run once
npm run test:watch    # Watch mode
```

## License

GPL-3.0 License.
