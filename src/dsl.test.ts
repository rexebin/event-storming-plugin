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
     const result = parseDSL(xml);
   });

   it('should preserve external system containers with pink container color', () => {
     const xml = `<externalsystem name="Inventory Service"><container name="Inventory Check">
        <command name="Check Inventory"/>
      </container></externalsystem>`;
     const result = parseDSL(xml);
   });

   it('should parse Note nodes as note type with note color', () => {
     const xml = `<eventstorming><aggregate name="User"><container name="User Registration">
        <event name="UserRegistered" next="Some Note"/>
        <note name="Some Note"><note>Attached to the event</note></note>
      </container></aggregate></eventstorming>`;
     const result = parseDSL(xml);
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

   it('should not assign implicit next when noNext is set (XML)', () => {
     const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
       <command name="Place Order" noNext="true"/>
       <event name="Order Placed"/>
     </container></aggregate></eventstorming>`;
     const result = parseDSL(xml);
     const placeOrder = result.nodes.find((n) => n.label === 'Place Order');
     expect(placeOrder!.next).toBeUndefined();
     expect(placeOrder!.noNext).toBe(true);
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
});
