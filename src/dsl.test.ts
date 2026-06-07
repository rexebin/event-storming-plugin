/**
 * Comprehensive tests for the Event Storming DSL parser.
 */

import { describe, it, expect } from 'vitest';
import { parseDSL, normalizeId } from '../src/dsl';

describe('normalizeId', () => {
  it('should convert spaces to underscores', () => {
    expect(normalizeId('Order Placed')).toBe('Order_Placed');
   });

  it('should normalize special characters to underscores', () => {
   expect(normalizeId('Order#1')).toBe('Order_1');
   });

  it('should preserve alphanumeric characters', () => {
    expect(normalizeId('OrderPlaced123')).toBe('OrderPlaced123');
   });

  it('should handle empty strings', () => {
    expect(normalizeId('')).toBe('');
   });

  it('should replace special characters with underscores', () => {
   expect(normalizeId('!@#$%')).toBe('_____');
   });
});

describe('parseDSL', () => {
  describe('metadata parsing', () => {
    it('should extract title from DSL', () => {
      const dsl = '# Title: My Event Storming Session\nactor: Customer [purple]';
      const result = parseDSL(dsl);
      expect(result.title).toBe('My Event Storming Session');
      });

    it('should extract description from DSL', () => {
      const dsl = '# Description: Brief description\nactor: Customer [purple]';
      const result = parseDSL(dsl);
      expect(result.description).toBe('Brief description');
      });

    it('should default title when not provided', () => {
      const dsl = 'actor: Customer [purple]';
      const result = parseDSL(dsl);
      expect(result.title).toBe('Event Storming');
      });

    it('should default description to empty string when not provided', () => {
      const dsl = 'actor: Customer [purple]';
      const result = parseDSL(dsl);
      expect(result.description).toBe('');
      });
   });


  describe('actor parsing', () => {
    it('should parse actor nodes', () => {
      const dsl = 'actor: Customer [purple]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0]).toEqual({
        id: 'Customer',
        label: 'Customer',
        type: 'actor',
        color: '#D4D3D3',
        containerId: null,
        rootContainerId: null,
        processIndex: -1,
        noteTarget: null,
         notes: [],
        });
      });

    it('should parse multiple actors', () => {
      const dsl = 'actor: Customer [purple]\nactor: Admin [purple]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(2);
      });
   });

  describe('command parsing', () => {
    it('should parse command nodes', () => {
      const dsl = 'command: PlaceOrder [blue]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0]).toEqual({
        id: 'PlaceOrder',
        label: 'PlaceOrder',
        type: 'command',
        color: '#91D49C',
        containerId: null,
        rootContainerId: null,
        processIndex: -1,
        noteTarget: null,
         notes: [],
         });
       });
   });

  describe('event parsing', () => {
     it('should parse event nodes', () => {
       const dsl = 'event: OrderPlaced [orange]';
       const result = parseDSL(dsl);
       expect(result.nodes.length).toBe(1);
       expect(result.nodes[0]).toEqual({
         id: 'OrderPlaced',
         label: 'OrderPlaced',
         type: 'event',
         color: '#FFA500',
         containerId: null,
         rootContainerId: null,
         processIndex: -1,
         noteTarget: null,
         notes: [],
         });
       });

    it('should parse multiple events', () => {
      const dsl = 'event: OrderPlaced [orange]\nevent: PaymentReceived [orange]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(2);
      });
   });

  describe('aggregate parsing', () => {
    it('should parse standalone aggregate nodes (no block)', () => {
      const dsl = 'aggregate: Order [green]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].type).toBe('aggregate');
      expect(result.nodes[0].color).toBe('#FEE254');
      });

    it('should parse entity alias as aggregate', () => {
      const dsl = 'entity: User [green]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].type).toBe('aggregate');
      expect(result.nodes[0].id).toBe('User');
      });

    it('should parse aggregate as container with processes', () => {
      const dsl = `
        aggregate: Order [green] {
          process: Customer -> PlaceOrder -> OrderPlaced
          process: CancelOrder -> OrderCancelled
        }
      `;
      const result = parseDSL(dsl);
      expect(result.containers.length).toBe(1);
      expect(result.containers[0].label).toBe('Order');
      expect(result.containers[0].type).toBe('aggregate');
      expect(result.containers[0].processes.length).toBe(2);
      expect(result.containers[0].processes[0].stepIds).toEqual(['Customer', 'PlaceOrder', 'OrderPlaced']);
      expect(result.containers[0].processes[1].stepIds).toEqual(['CancelOrder', 'OrderCancelled']);
      });

    it('should create process links between consecutive steps', () => {
      const dsl = `
        aggregate: Order [green] {
          process: Customer -> PlaceOrder -> OrderPlaced
        }
      `;
      const result = parseDSL(dsl);
       // Customer -> PlaceOrder and PlaceOrder -> OrderPlaced
      expect(result.links.length).toBe(2);
      expect(result.links[0].source).toBe('Customer');
      expect(result.links[0].target).toBe('PlaceOrder');
      expect(result.links[1].source).toBe('PlaceOrder');
      expect(result.links[1].target).toBe('OrderPlaced');
      });

    it('should set containerId for nodes inside aggregate', () => {
      const dsl = `
        aggregate: Order [green] {
          process: PlaceOrder -> OrderPlaced
        }
      `;
      const result = parseDSL(dsl);
      const placeOrder = result.nodes.find((n) => n.id === 'PlaceOrder');
      expect(placeOrder?.containerId).toBe('Order');
      });
   });

  describe('readModel parsing', () => {
    it('should parse standalone readModel nodes (no block)', () => {
      const dsl = 'readModel: OrderSummary [cyan]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].type).toBe('readModel');
      expect(result.nodes[0].color).toBe('#5BAA62');
      });

    it('should parse readModel as container with events and notes', () => {
      const dsl = `
        readModel: OrderSummary [cyan] {
          event: OrderPlaced
          event: PaymentReceived
          note: "Shows total amount"
        }
      `;
      const result = parseDSL(dsl);
      expect(result.containers.length).toBe(1);
      expect(result.containers[0].label).toBe('OrderSummary');
      expect(result.containers[0].type).toBe('readModel');
      expect(result.containers[0].nodeIds.length).toBe(3);
      });

    it('should parse note with target reference', () => {
      const dsl = `
        readModel: OrderSummary [cyan] {
          event: OrderPlaced
          note: "Details" -> OrderPlaced
        }
      `;
      const result = parseDSL(dsl);
      const note = result.nodes.find((n) => n.type === 'note');
      expect(note).toBeDefined();
      expect(note?.label).toBe('Details');
      expect(note?.noteTarget).toBe('OrderPlaced');
      });
   });

  describe('query parsing', () => {
    it('should parse query nodes', () => {
      const dsl = 'query: GetOrderStatus [cyan]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].type).toBe('query');
      });
   });

  describe('policy parsing', () => {
    it('should parse policy nodes', () => {
      const dsl = 'policy: ValidateOrder [yellow]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].type).toBe('policy');
      expect(result.nodes[0].color).toBe('#859EBF');
      });
   });

  describe('external system parsing', () => {
    it('should parse external system nodes', () => {
      const dsl = 'externalSystem: PaymentGateway [pink]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].type).toBe('externalSystem');
      expect(result.nodes[0].color).toBe('#FB8597');
      });
   });

  describe('temporary object parsing', () => {
    it('should parse temporary object nodes', () => {
      const dsl = 'tempObject: OrderDto [lightgray]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].type).toBe('tempObject');
      expect(result.nodes[0].color).toBe('#FFF1AA');
      });
   });

  describe('color mapping', () => {
    it('should map known colors correctly', () => {
      const dsl = `
        event: E1 [orange]
        command: C1 [blue]
        actor: A2 [purple]
        policy: P1 [yellow]
        readModel: R1 [cyan]
        externalSystem: E2 [pink]
        tempObject: T1 [lightgray]
       `;
      const result = parseDSL(dsl);
      expect(result.nodes[0].color).toBe('#FFA500');     // event, orange
      expect(result.nodes[1].color).toBe('#91D49C');     // command, blue
      expect(result.nodes[2].color).toBe('#D4D3D3');     // actor, purple
      expect(result.nodes[3].color).toBe('#859EBF');     // policy, yellow
      expect(result.nodes[4].color).toBe('#5BAA62');     // readModel, cyan
      expect(result.nodes[5].color).toBe('#FB8597');     // externalSystem, pink
      expect(result.nodes[6].color).toBe('#FFF1AA');     // tempObject, lightgray
      });

    it('should default to gray for unknown colors', () => {
      const dsl = 'event: E1 [unknownColor]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].color).toBe('#6a737d');
      });

    it('should be case-insensitive for color names', () => {
      const dsl = 'event: E1 [ORANGE]\nevent: E2 [blue]\nevent: E3 [Green]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].color).toBe('#FFA500');
      expect(result.nodes[1].color).toBe('#91D49C');
      expect(result.nodes[2].color).toBe('#FEE254');
      });
   });

  describe('relationship parsing', () => {
    it('should parse basic relationships without label', () => {
      const dsl = `
        actor: Customer [purple]
        command: PlaceOrder [blue]
        Customer -> PlaceOrder : command
       `;
      const result = parseDSL(dsl);
      expect(result.links.length).toBe(1);
      expect(result.links[0]).toEqual({
        source: 'Customer',
        target: 'PlaceOrder',
       label: '',
        type: 'command',
        });
      });

    it('should parse labeled relationships', () => {
      const dsl = `
        command: PlaceOrder [blue]
        event: OrderPlaced [orange]
       PlaceOrder ->|triggers| OrderPlaced : event
       `;
      const result = parseDSL(dsl);
      expect(result.links.length).toBe(1);
      expect(result.links[0].label).toBe('triggers');
      expect(result.links[0].type).toBe('event');
      });

    it('should default link type to "default" when not specified', () => {
      const dsl = `
        actor: Customer [purple]
        command: PlaceOrder [blue]
        Customer -> PlaceOrder
       `;
      const result = parseDSL(dsl);
      expect(result.links[0].type).toBe('default');
      });

    it('should ignore links with undefined source or target node', () => {
      const dsl = `
        actor: Customer [purple]
        UndefinedNode -> Customer : command
       `;
      const result = parseDSL(dsl);
      expect(result.links.length).toBe(0);
      });
   });

  describe('container block parsing', () => {
    it('should handle nested elements in aggregate block', () => {
      const dsl = `
        aggregate: Order [green] {
          process: Customer -> PlaceOrder -> OrderPlaced
          event: OrderValidated
          note: "Business rule applies" -> OrderValidated
        }
      `;
      const result = parseDSL(dsl);
      expect(result.containers.length).toBe(1);
      expect(result.containers[0].processes.length).toBe(1);
       // event + note + process nodes
      const containerNodes = result.nodes.filter((n) => n.containerId === 'Order');
      expect(containerNodes.length).toBeGreaterThanOrEqual(5);
      });

    it('should handle multiple containers', () => {
      const dsl = `
        aggregate: Order [green] {
          process: PlaceOrder -> OrderPlaced
        }
        readModel: OrderSummary [cyan] {
          event: OrderPlaced
          note: "Summary view"
        }
      `;
      const result = parseDSL(dsl);
      expect(result.containers.length).toBe(2);
      expect(result.containers[0].label).toBe('Order');
      expect(result.containers[1].label).toBe('OrderSummary');
      });
   });

  describe('comment handling', () => {
    it('should skip single-line comments', () => {
      const dsl = `
        // This is a comment
        actor: Customer [purple]
        /* This is also a comment */
        command: PlaceOrder [blue]
       `;
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(2);
      });

    it('should handle empty DSL', () => {
      const result = parseDSL('');
      expect(result.nodes.length).toBe(0);
      expect(result.links.length).toBe(0);
      expect(result.containers.length).toBe(0);
      expect(result.title).toBe('Event Storming');
      });

    it('should handle DSL with only whitespace', () => {
      const result = parseDSL('    \n\n    \n  ');
      expect(result.nodes.length).toBe(0);
      });

    it('should handle DSL with only comments', () => {
      const dsl = `
        // Comment 1
        // Comment 2
        /* Multi-line comment */
       `;
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(0);
      });
   });

  describe('edge cases', () => {
    it('should handle node labels with spaces', () => {
      const dsl = 'actor: Customer Service [purple]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].id).toBe('Customer_Service');
      expect(result.nodes[0].label).toBe('Customer Service');
      });

    it('should handle multiple spaces in DSL lines', () => {
      const dsl = '   actor:   Customer    [purple]    ';
      const result = parseDSL(dsl);
      expect(result.nodes[0].id).toBe('Customer');
      expect(result.nodes[0].label).toBe('Customer');
      });

    it('should handle complex full DSL with containers', () => {
      const dsl = `
        # Title: Full Test DSL
        # Description: Comprehensive test

        aggregate: Order [green] {
          process: Customer -> PlaceOrder -> OrderPlaced
          process: CancelOrder -> OrderCancelled
          policy: ValidateOrder
          note: "Order must be validated"
        }

        readModel: OrderSummary [cyan] {
          event: OrderPlaced
          event: PaymentReceived
          note: "Shows order details"
        }

        externalSystem: EmailService [pink]
        EmailService ->|sends| OrderPlaced

        Customer ->|initiates| PlaceOrder : command
       `;
      const result = parseDSL(dsl);
      expect(result.title).toBe('Full Test DSL');
      expect(result.description).toBe('Comprehensive test');
      expect(result.containers.length).toBe(2);
      expect(result.containers[0].label).toBe('Order');
      expect(result.containers[1].label).toBe('OrderSummary');
      expect(result.nodes.length).toBeGreaterThanOrEqual(10);
      });

    it('should parse policy with yes/no branching', () => {
     const dsl = `
       policy: DoWeHaveStock [yes: IsOrderDetailValid?, no: OutOfStock]
       command: IsOrderDetailValid? [blue]
       error: OutOfStock [red]
       `;
     const result = parseDSL(dsl);
     const policy = result.nodes.find((n) => n.id === 'DoWeHaveStock');
     expect(policy).toBeDefined();
     expect(policy!.type).toBe('policy');
     expect(policy!.next).toBe('IsOrderDetailValid_');
     expect(policy!.altNext).toBe('OutOfStock');
      });

    it('should parse process as container type', () => {
     const dsl = `
       process: CustomerOrderView [cyan] {
         actor: Customer
         query: GetOrderDetails
         view: OrderDetailView
       }
       `;
     const result = parseDSL(dsl);
     expect(result.containers.length).toBe(1);
     expect(result.containers[0].type).toBe('process');
     expect(result.containers[0].label).toBe('CustomerOrderView');
      });

    it('should parse view nodes', () => {
     const dsl = 'view: OrderDetailView';
     const result = parseDSL(dsl);
     expect(result.nodes.length).toBe(1);
     expect(result.nodes[0].type).toBe('view');
     expect(result.nodes[0].color).toBe('#FEE254');
      });

    it('should parse error nodes', () => {
     const dsl = 'error: OutOfStock [red]';
     const result = parseDSL(dsl);
     expect(result.nodes.length).toBe(1);
     expect(result.nodes[0].type).toBe('error');
     expect(result.nodes[0].color).toBe('#8DCFF9');
      });

    it('should set next on process chain nodes', () => {
     const dsl = `
       aggregate: Order [green] {
         process: Customer -> PlaceOrder -> OrderPlaced
       }
       `;
     const result = parseDSL(dsl);
     const customer = result.nodes.find((n) => n.id === 'Customer');
     expect(customer!.next).toBe('PlaceOrder');
     const placeOrder = result.nodes.find((n) => n.id === 'PlaceOrder');
     expect(placeOrder!.next).toBe('OrderPlaced');
      });

    it('should parse named process groups inside containers', () => {
     const dsl = `
       aggregate: Order [green] {
         process: Place Order {
           command: PlaceOrder
           event: OrderPlaced
         }
       }
       `;
     const result = parseDSL(dsl);
     expect(result.containers[0].processes.length).toBe(1);
     expect(result.containers[0].processes[0].name).toBe('Place Order');
     expect(result.containers[0].processes[0].stepIds.length).toBe(2);
      });

   it('should resolve DSL references even when names differ by spaces or punctuation', () => {
     const xml = `<eventstorming><aggregate name="Order"><container name="Place Order">
        <command name="PlaceOrder" next="InventoryService"/>
        <externalsystem name="InventoryService" next="DoWeHaveStock"/>
        <policy name="Do We Have Stock?" altNext="Out Of Stock"/>
      </container></aggregate></eventstorming>`;
     parseDSL(xml);
   });

   it('should preserve external system containers with pink container color', () => {
     const xml = `<externalsystem name="Inventory Service"><container name="Inventory Check">
        <command name="Check Inventory"/>
      </container></externalsystem>`;
     parseDSL(xml);
   });

   it('should parse Note nodes as note type with note color', () => {
     const xml = `<eventstorming><aggregate name="User"><container name="User Registration">
        <event name="UserRegistered" next="Some Note"/>
        <note name="Some Note"><note>Attached to the event</note></note>
      </container></aggregate></eventstorming>`;
     parseDSL(xml);
   });

   it('parses notes from child <note> element on a note flow node', () => {
     const xml = `\`\`\`eventstorming
<eventstorming>
  <aggregate name="Order">
    <container name="Test">
      <event name="OrderPlaced" next="Some Note" />
      <note name="Some Note"><note>This is a note attached to the event.</note></note>
    </container>
  </aggregate>
</eventstorming>
\`\`\``;
     const result = parseDSL(xml);
     const noteNode = result.nodes.find(n => n.label === 'Some Note');
     expect(noteNode?.notes).toEqual(['This is a note attached to the event.']);
   });

   it('should not assign implicit next when next="" (XML)', () => {
     const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
       <command name="Place Order" next=""/>
       <event name="Order Placed"/>
     </container></aggregate></eventstorming>`;
     const result = parseDSL(xml);
     const placeOrder = result.nodes.find((n) => n.label === 'Place Order');
     expect(placeOrder!.next).toBeNull();
   });

   it('should auto-assign implicit next for nodes without explicit next (XML)', () => {
     const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
       <command name="Place Order"/>
       <event name="Order Placed"/>
     </container></aggregate></eventstorming>`;
     const result = parseDSL(xml);
     const placeOrder = result.nodes.find((n) => n.label === 'Place Order');
     expect(placeOrder!.next).toBe('Flow_Order_Placed');
   });

   it('should skip implicit linking for next="" but continue for later siblings (XML)', () => {
     const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
       <command name="Place Order" next=""/>
       <event name="Order Placed"/>
       <command name="Ship Order"/>
     </container></aggregate></eventstorming>`;
     const result = parseDSL(xml);
     expect(result.nodes.find((n) => n.label === 'Place Order')!.next).toBeNull();
     expect(result.nodes.find((n) => n.label === 'Order Placed')!.next).toBe('Flow_Ship_Order');
   });

   it('should keep the README eventstorming example parseable', async () => {
     const readme = (await import('../README.md?raw')).default;
     const match = readme.match(/```(?:eventstorming|xml)\n([\s\S]*?)\n```/);

     expect(match).toBeTruthy();

     const result = parseDSL(match![1]);
     expect(result.containers.length).toBeGreaterThan(0);
     expect(result.nodes.length).toBeGreaterThan(0);
   });
   });

  describe('custom id support', () => {
    it('should use custom id when provided in text DSL', () => {
      const dsl = 'actor: Customer [purple] [id="cust123"]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('cust123');
      expect(result.nodes[0].label).toBe('Customer');
    });

    it('should auto-generate id from name when no custom id provided', () => {
      const dsl = 'actor: Customer [purple]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].id).toBe('Customer');
    });

    it('should allow multiple nodes with the same name but different custom ids', () => {
      const dsl = `
        actor: Customer [purple] [id="cust1"]
        actor: Customer [purple] [id="cust2"]
      `;
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(2);
      expect(result.nodes[0].id).toBe('cust1');
      expect(result.nodes[1].id).toBe('cust2');
      expect(result.nodes[0].label).toBe('Customer');
      expect(result.nodes[1].label).toBe('Customer');
    });

    it('should preserve label when custom id differs from name', () => {
      const dsl = 'command: PlaceOrder [blue] [id="PO_001"]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].id).toBe('PO_001');
      expect(result.nodes[0].label).toBe('PlaceOrder');
    });

    it('should parse XML nodes with custom id attribute', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="PlaceOrder" id="PO_001"/>
        <event name="OrderPlaced" id="OP_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.label === 'PlaceOrder');
      const orderPlaced = result.nodes.find((n) => n.label === 'OrderPlaced');
      expect(placeOrder!.id).toBe('PO_001');
      expect(orderPlaced!.id).toBe('OP_001');
    });

    it('should resolve next reference by name first (current behavior)', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="Place Order" id="PO_001" next="Order Placed"/>
        <event name="Order Placed" id="OP_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.id === 'PO_001');
      // next resolves to the actual target node's id (custom id, not prefixed)
      expect(placeOrder!.next).toBe('OP_001');
    });

    it('should use auto-generated id when next reference matches no node name', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="Place Order" id="PO_001" next="NonExistent"/>
        <event name="Something Else" id="SE_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.id === 'PO_001');
      // No name match → falls through to prefix + normalizeId
      expect(placeOrder!.next).toBe('Flow_NonExistent');
    });

    it('should create implicit error node when altNext reference does not match any existing node', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="Place Order" id="PO_001" next="SomeTarget" altNext="NonExistent"/>
        <event name="Something Else" id="SE_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);

      // The command's altNext should resolve to the implicit error node's ID
      const placeOrder = result.nodes.find((n) => n.id === 'PO_001');
      expect(placeOrder!.altNext).toBe('Flow_NonExistent');

      // An actual error node should exist in the model, placed in the same container as the referencing node
      const errorNode = result.nodes.find((n) => n.id === 'Flow_NonExistent');
      expect(errorNode).toBeTruthy();
      expect(errorNode!.type).toBe('error');
      expect(errorNode!.label).toBe('NonExistent');
      expect(errorNode!.containerId).toBe('Order_Flow');
    });

    it('should create implicit error node for unmatched altNext in text DSL policy branching', () => {
      const dsl = `
        aggregate: Order [green] {
          process: Flow [blue] -> PlaceOrder [yellow]
        }
        readModel: ValidationSystem [purple] {
          policy: Validate [yes: Success, no: FailTarget]
        }
      `;
      const result = parseDSL(dsl);

      // The policy's altNext should resolve to the implicit error node's ID
      const policy = result.nodes.find((n) => n.id === 'Validate');
      expect(policy).toBeTruthy();
      expect(policy!.altNext).toBe('FailTarget');

      // An actual error node should exist in the model, placed in the same container as the referencing node
      const errorNode = result.nodes.find((n) => n.id === 'FailTarget');
      expect(errorNode).toBeTruthy();
      expect(errorNode!.type).toBe('error');
      expect(errorNode!.label).toBe('FailTarget');
      expect(errorNode!.containerId).toBe('ValidationSystem');
    });

    it('should create implicit error node for unmatched next in text DSL', () => {
      const dsl = `
        readModel: ValidationSystem [purple] {
          policy: Validate [yes: MissingTarget, no: Success]
        }
      `;
      const result = parseDSL(dsl);
      const policy = result.nodes.find((n) => n.id === 'Validate');
      expect(policy!.next).toBe('MissingTarget');
      const errorNode = result.nodes.find((n) => n.id === 'MissingTarget');
      expect(errorNode).toBeTruthy();
      expect(errorNode!.type).toBe('error');
      expect(errorNode!.label).toBe('MissingTarget');
      expect(errorNode!.containerId).toBe('ValidationSystem');
    });

    it('should use COLOR_MAP.red (cyan) for implicit error node color', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="Place Order" id="PO_001" altNext="NonExistent"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const errorNode = result.nodes.find((n) => n.id === 'Flow_NonExistent');
      expect(errorNode).toBeTruthy();
      // Error nodes use COLOR_MAP.red which is cyan (#8DCFF9), not red
      expect(errorNode!.color).toBe('#8DCFF9');
    });

    it('should NOT match altNext references across containers by id', () => {
      const xml = `<eventstorming>
        <aggregate name="Order">
          <container name="Flow">
            <command name="Place Order" id="PO_001"/>
            <error name="OutOfStock" id="OutOfStock"/>
          </container>
        </aggregate>
        <process name="Inventory Service">
          <policy name="Has Stock?" id="HS_001" altNext="OutOfStock"/>
        </process>
      </eventstorming>`;
      const result = parseDSL(xml);
      expect(result.containers.length).toBeGreaterThanOrEqual(2);
      const hasStock = result.nodes.find((n) => n.id === 'HS_001');
      expect(hasStock).toBeTruthy();
      // Has Stock? should create an implicit error node in its own container,
      // NOT resolve to the explicit "OutOfStock" (id="OutOfStock") from Order container
      expect(hasStock!.altNext).not.toBe('OutOfStock');
    });

    it('should NOT match altNext references across containers by name', () => {
      const xml = `<eventstorming>
        <aggregate name="Order">
          <container name="Flow">
            <command name="Place Order" id="PO_001"/>
            <error name="OutOfStock" id="ES_FLOW"/>
          </container>
        </aggregate>
        <process name="Inventory Service">
          <policy name="Has Stock?" id="HS_001" altNext="OutOfStock"/>
        </process>
      </eventstorming>`;
      const result = parseDSL(xml);

      // Has Stock? should NOT resolve to the "OutOfStock" in Order container by name match.
      // Instead it should create an implicit error node in Inventory Service container.
      const hasStock = result.nodes.find((n) => n.id === 'HS_001');
      const localImplicit = result.nodes.find(
        (n) => n.type === 'error' && n.containerId === 'Inventory_Service',
      );
      expect(hasStock!.altNext).not.toBe('ES_FLOW');
      expect(localImplicit).toBeTruthy();
    });

    it('should set next via custom id in text DSL process chain', () => {
      const dsl = `
        aggregate: Order [green] {
          process: Customer [id="CUST"] -> PlaceOrder [id="PO"]
        }
      `;
      const result = parseDSL(dsl);
      const customer = result.nodes.find((n) => n.id === 'CUST');
      expect(customer).toBeDefined();
      expect(customer!.next).toBe('PO');
    });

    it('should support id attribute on all node types in text DSL', () => {
      const dsl = `
        event: OrderPlaced [orange] [id="evt1"]
        command: PlaceOrder [blue] [id="cmd1"]
        actor: Customer [purple] [id="act1"]
        policy: Validate [yellow] [id="pol1"]
        readModel: Summary [cyan] [id="rm1"]
        externalSystem: Gateway [pink] [id="ext1"]
      `;
      const result = parseDSL(dsl);
      expect(result.nodes[0].id).toBe('evt1');
      expect(result.nodes[1].id).toBe('cmd1');
      expect(result.nodes[2].id).toBe('act1');
      expect(result.nodes[3].id).toBe('pol1');
      expect(result.nodes[4].id).toBe('rm1');
      expect(result.nodes[5].id).toBe('ext1');
    });

    it('should set id on XML nodes with attributes like next', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <policy name="Validate" id="pol1" next="Result" altNext="Fail"/>
        <event name="Result" id="res1"/>
        <error name="Fail" id="fail1"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const policy = result.nodes.find((n) => n.id === 'pol1');
      expect(policy).toBeDefined();
      expect(policy!.next).toBe('res1');
      expect(policy!.altNext).toBe('fail1');
    });

    it('should preserve label when custom id contains special characters', () => {
      const dsl = 'actor: Customer Service [purple] [id="cs-2024!"]';
      const result = parseDSL(dsl);
      expect(result.nodes[0].id).toBe('cs-2024!');
      expect(result.nodes[0].label).toBe('Customer Service');
    });

    it('should not treat [id="..."] as color', () => {
      const dsl = 'actor: Customer [id="cust1"]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('cust1');
      expect(result.nodes[0].label).toBe('Customer');
      // Should use default actor color, not treat 'id' as a color
      expect(result.nodes[0].color).toBe('#D4D3D3');
    });

    it('should support standalone nodes with custom id outside containers', () => {
      const dsl = `
        actor: Customer [purple] [id="ext_cust"]
        externalSystem: Gateway [pink] [id="ext_gw"]
      `;
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(2);
      expect(result.nodes[0].id).toBe('ext_cust');
      expect(result.nodes[1].id).toBe('ext_gw');
    });

    it('should resolve altNext by node name, not custom id', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <policy name="Check Stock" id="pol1" altNext="StockError"/>
        <error name="StockError" id="ERR_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const policy = result.nodes.find((n) => n.id === 'pol1');
      // altNext matches by node NAME "StockError", resolves to that node's actual id
      expect(policy!.altNext).toBe('ERR_001');
    });

    it('should generate id from name for XML nodes without custom id', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="PlaceOrder"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const node = result.nodes[0];
      expect(node.id).toBe('Flow_PlaceOrder');
    });

    it('should use auto-generated id when XML id attribute is empty', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="PlaceOrder" id=""/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('Flow_PlaceOrder');
    });

    it('should use auto-generated id when text DSL [id=""] is empty', () => {
      const dsl = 'command: PlaceOrder [blue] [id=""]';
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('PlaceOrder');
    });

    it('should resolve altNext by node name, not custom id', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <policy name="Check Stock" id="POL_01" next="GoodStock" altNext="OutOfStock"/>
        <event name="GoodStock" id="GOOD"/>
        <error name="OutOfStock" id="OUT"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const policy = result.nodes.find((n) => n.id === 'POL_01');
      expect(policy!.next).toBe('GOOD');
      // altNext matches by node NAME "OutOfStock", resolves to that node's actual id
      expect(policy!.altNext).toBe('OUT');
    });

    it('should keep customId on nodes even when name resolves first', () => {
      const dsl = `
        aggregate: Order [green] {
          process: Customer [id="CUST_123"] -> PlaceOrder [id="PO_456"]
        }
      `;
      const result = parseDSL(dsl);
      const customer = result.nodes.find((n) => n.label === 'Customer');
      expect(customer!.id).toBe('CUST_123');
      expect(customer!.customId).toBe('CUST_123');
      const po = result.nodes.find((n) => n.label === 'PlaceOrder');
      expect(po!.id).toBe('PO_456');
      expect(po!.customId).toBe('PO_456');
    });

    it('should prefer policy over error when altNext name collides on same label', () => {
      const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
        <command name="Record Failed Attempt" altNext="Failed Exception" offset="1"/>
        <policy name="Failed Exception" next="Call Recorded"></policy>
        <error id="failed-exception-1" name="Failed Exception"></error>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const cmd = result.nodes.find((n) => n.label === 'Record Failed Attempt');
      // altNext="Failed Exception" should resolve to the policy (first match), not the error
      expect(cmd!.altNext).toBe('Flow_Failed_Exception');
    });

    it('should resolve explicit custom id reference when name collides', () => {
      const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
        <command name="Record Failed Attempt" altNext="Failed Exception" offset="1"/>
        <policy name="Failed Exception" next="Call Recorded"></policy>
        <error id="failed-exception-1" name="Failed Exception"></error>
        <event name="Failed Attempt Recorded" next="" altNext="failed-exception-1"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const cmd = result.nodes.find((n) => n.label === 'Record Failed Attempt');
      const evt = result.nodes.find((n) => n.label === 'Failed Attempt Recorded');
      // altNext="Failed Exception" → first match by name = policy
      expect(cmd!.altNext).toBe('Flow_Failed_Exception');
      // altNext="failed-exception-1" is an explicit custom id → resolves to that node
      expect(evt!.altNext).toBe('failed-exception-1');
    });

    it('should prefer non-error for next when label collides', () => {
      const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
        <policy name="Check It" next="Failed Exception"/>
        <policy name="Failed Exception"></policy>
        <error id="err1" name="Failed Exception"></error>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const policy = result.nodes.find((n) => n.label === 'Check It');
      expect(policy!.next).toBe('Flow_Failed_Exception');
    });

  describe('container boundary enforcement', () => {
    it('should track rootContainerId as the container scoped id on nodes within explicit containers', () => {
      const xml = `<eventstorming><process name="OrderFlow">
        <container name="Checkout">
          <command name="PlaceOrder" />
          <event name="OrderPlaced" />
        </container>
      </process></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.label === 'PlaceOrder');
      // rootContainerId is computed as parentDslContainer.id + '_' + normalized(name)
      expect(placeOrder!.rootContainerId).toBe('OrderFlow_Checkout');
    });

    it('should block linking between nodes in sibling sub-containers (different roots)', () => {
      // "Place Order" and "Inventory Check" are siblings under <aggregate> but each creates its own scope
      const xml = `<eventstorming><aggregate name="Order">
        <container name="Place Order">
          <command name="PlaceOrder" next="CheckStock" />
        </container>
        <container name="Inventory Check">
          <policy name="CheckStock" />
        </container>
      </aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.label === 'PlaceOrder');
      // PlaceOrder's rootContainerId differs from CheckStock's rootContainerId → name match blocked
      expect(placeOrder!.next).not.toBe('Inventory_Check_CheckStock');
    });

    it('should block cross-root linking via direct ID reference', () => {
      const xml = `<eventstorming>
        <aggregate name="Order">
          <container name="Place Order">
            <command name="PlaceOrder" id="PO_001" />
          </container>
        </aggregate>
        <process name="Payment Service">
          <container name="Payment">
            <event name="OrderPaid" id="PO_001" />
          </container>
        </process></eventstorming>`;
      const result = parseDSL(xml);
      // Two different nodes happen to share the same custom ID "PO_001" in different roots
      // A reference to PO_001 should NOT cross root boundaries
      expect(result.nodes.filter((n) => n.id === 'PO_001').length).toBe(2);
    });

    it('should block name-based linking across different root containers', () => {
      const xml = `<eventstorming>
        <aggregate name="Order">
          <container name="Place Order">
            <command name="PlaceOrder" altNext="OutOfStock" />
          </container>
        </aggregate>
        <process name="Inventory Service">
          <container name="Inventory Check">
            <error name="OutOfStock" />
          </container>
        </process></eventstorming>`;
      const result = parseDSL(xml);
      // OutOfStock in Inventory Service should NOT be resolved by a node in Order container
      const placeOrder = result.nodes.find((n) => n.label === 'PlaceOrder');
      expect(placeOrder!.altNext).not.toBe('Inventory_Check_OutOfStock');
      // Should create an implicit error node instead, scoped to PlaceOrder's root
      const implicitError = result.nodes.find(
        (n) => n.type === 'error' && n.containerId === 'Order_Place_Order' && n.label === 'OutOfStock'
      );
      expect(implicitError).toBeTruthy();
    });

    it('should create implicit error nodes with matching rootContainerId', () => {
      const xml = `<eventstorming><aggregate name="Order">
        <container name="Place Order">
          <policy name="CheckStock" altNext="MissingItem" />
        </container>
      </aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const implicitError = result.nodes.find(
        (n) => n.type === 'error' && n.label === 'MissingItem'
      );
      expect(implicitError).toBeTruthy();
      // Should match the referencing node's rootContainerId
      expect(implicitError!.rootContainerId).toBe('Order_Place_Order');
    });

    it('should block linking between nodes in different nested sub-containers', () => {
      // IsAddressValid (PlaceOrder) and AddressInvalid (Another Sub Process) are in DIFFERENT scopes
      const xml = `<eventstorming><aggregate name="Order">
        <container name="Place Order">
          <command name="PlaceOrder" next="DoSomething" />
          <container name="PlaceOrder">
            <policy name="IsAddressValid" altNext="AddressInvalid" />
            <container name="Another Sub Process">
              <command name="DoSomething" />
              <error name="AddressInvalid" />
            </container>
          </container>
        </container>
      </aggregate></eventstorming>`;
      const result = parseDSL(xml);
      // AddressInvalid is in a different root scope than IsAddressValid → no link
      const isAddressValid = result.nodes.find((n) => n.label === 'IsAddressValid');
      expect(isAddressValid!.altNext).not.toBe('Another_Sub_Process_AddressInvalid');
    });

    it('should allow linking between nodes in the SAME container (same rootContainerId)', () => {
      // Both nodes are direct children of <container name="Place Order">, no nested containers
      const xml = `<eventstorming><aggregate name="Order">
        <container name="Place Order">
          <command name="PlaceOrder" next="InventoryService" />
          <externalSystem name="InventoryService" />
        </container>
      </aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.label === 'PlaceOrder');
      // Both nodes share rootContainerId = "Order_Place_Order" → linking works
      expect(placeOrder!.next).toBe('Place_Order_InventoryService');
    });
  });

    it('should resolve Complex Vertical Example altNext references correctly', () => {
      const xml = `<eventstorming><aggregate name="Complex Vertical Example">
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
      </aggregate></eventstorming>`;
      const result = parseDSL(xml);
      // "Have reached max retries?" altNext should resolve to the policy "Failed Exception"
      const hasReachedMaxRetries = result.nodes.find((n) => n.label === 'Have reached max retries?');
      expect(hasReachedMaxRetries!.altNext).toBe('Complex_Vertical_Example_Failed_Exception');
      // "Record Failed Attempt" altNext should also resolve to the policy (name match, type preference)
      const recordFailed = result.nodes.find((n) => n.label === 'Record Failed Attempt');
      expect(recordFailed!.altNext).toBe('Complex_Vertical_Example_Failed_Exception');
      // "Failed Attempt Recorded" altNext is explicit custom id → resolves to the error node
      const failedRecorded = result.nodes.find((n) => n.label === 'Failed Attempt Recorded');
      expect(failedRecorded!.altNext).toBe('failed-exception-1');
    });
  });
});
