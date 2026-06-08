/**
 * Comprehensive tests for the Event Storming DSL parser (XML format).
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
  describe('basic XML parsing', () => {
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
      const xml = `<eventstorming>
  <aggregate name="Order">
    <container name="Test">
      <event name="OrderPlaced" next="Some Note" />
      <note name="Some Note"><note>This is a note attached to the event.</note></note>
    </container>
  </aggregate>
</eventstorming>`;
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
    it('should parse XML nodes with custom id attribute', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="PlaceOrder" id="PO_001"/>
        <event name="OrderPlaced" id="OP_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.label === 'PlaceOrder');
      const orderPlaced = result.nodes.find((n) => n.label === 'OrderPlaced');
      expect(placeOrder!.id).toBe('custom-PO_001');
      expect(orderPlaced!.id).toBe('custom-OP_001');
    });

    it('should resolve next reference to a node with custom id by raw value', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="Place Order" id="PO_001" next="OP_001"/>
        <event name="Order Placed" id="OP_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.id === 'custom-PO_001');
      // next="OP_001" -> resolveReference tries "custom-OP_001" -> matches custom-id node
      expect(placeOrder!.next).toBe('custom-OP_001');
    });

    it('should set next to null when next reference does not match any node', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="Place Order" id="PO_001" next="NonExistent"/>
        <event name="Something Else" id="SE_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.id === 'custom-PO_001');
      expect(placeOrder!.next).toBeNull();

      const errorNode = result.nodes.find((n) => n.label === 'NonExistent');
      expect(errorNode).toBeUndefined();
    });

    it('should create implicit error node when altNext reference does not match any existing node', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="Place Order" id="PO_001" next="SomeTarget" altNext="NonExistent"/>
        <event name="Something Else" id="SE_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);

      // The command's altNext should resolve to the implicit error node's ID
      const placeOrder = result.nodes.find((n) => n.id === 'custom-PO_001');
      expect(placeOrder!.altNext).toBe('Flow_NonExistent');

      // An actual error node should exist in the model, placed in the same container as the referencing node
      const errorNode = result.nodes.find((n) => n.id === 'Flow_NonExistent');
      expect(errorNode).toBeTruthy();
      expect(errorNode!.type).toBe('error');
      expect(errorNode!.label).toBe('NonExistent');
      expect(errorNode!.containerId).toBe('Flow');
    });

    it('should NOT create implicit error node for unresolved next reference in XML DSL', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <command name="Place Order" id="PO_001" next="CrossContainerTarget"/>
        <event name="Order Placed" id="OP_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);

      const placeOrder = result.nodes.find((n) => n.id === 'custom-PO_001');
      expect(placeOrder!.next).toBeNull();

      const errorNode = result.nodes.find((n) => n.label === 'CrossContainerTarget');
      expect(errorNode).toBeUndefined();
    });

    it('should NOT cause subsequent nodes to link to unresolved next ref error node', () => {
      const xml = `<eventstorming><process name="Cancel Order">
        <container name="Flow">
          <actor name="Customer 1" next="Place Order" altNext="CancelOrder 1"/>
          <command name="CancelOrder 1" altNext="Exception!"/>
          <event name="OrderCancelled 1"/>
        </container>
      </process></eventstorming>`;
      const result = parseDSL(xml);

      // No error node should exist for the unresolved next="Place Order"
      const placeOrderError = result.nodes.find((n) => n.label === 'Place Order' && n.type === 'error');
      expect(placeOrderError).toBeUndefined();

      // OrderCancelled 1 should NOT be linked to the "Place Order" error node
      const orderCancelled = result.nodes.find((n) => n.label === 'OrderCancelled 1');
      expect(orderCancelled).toBeTruthy();
      expect(orderCancelled!.next).toBeUndefined();
    });

    it('should use COLOR_MAP.red (cyan) for implicit error node color in process container', () => {
      const xml = `<eventstorming><process name="Cancel Order">
        <container name="Flow">
          <command name="CancelOrder" altNext="Exception!"/>
          <event name="OrderCancelled"/>
        </container>
      </process></eventstorming>`;
      const result = parseDSL(xml);

      const orderCancelled = result.nodes.find((n) => n.label === 'OrderCancelled');
      expect(orderCancelled).toBeTruthy();
      expect(orderCancelled!.next).toBeUndefined();

      // The error node should exist and be in the child container's process stepIds for layout purposes
      const errorNode = result.nodes.find((n) => n.label === 'Exception!' && n.type === 'error');
      expect(errorNode).toBeTruthy();
      const flowContainer = result.containers.find((c) => c.label === 'Flow');
      expect(flowContainer?.processes[0]?.stepIds).toContain(errorNode!.id);
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
      const hasStock = result.nodes.find((n) => n.id === 'custom-HS_001');
      expect(hasStock).toBeTruthy();
      // Has Stock? should create an implicit error node in its own container,
      // NOT resolve to the explicit "OutOfStock" (id="custom-Outofstock") from Order container
      expect(hasStock!.altNext).not.toBe('custom-Outofstock');
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
      const hasStock = result.nodes.find((n) => n.id === 'custom-HS_001');
      const localImplicit = result.nodes.find(
        (n) => n.type === 'error' && n.containerId === 'Inventory_Service',
      );
      expect(hasStock!.altNext).not.toBe('custom-ES_FLOW');
      expect(localImplicit).toBeTruthy();
    });

    it('should set id on XML nodes with attributes like next', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <policy name="Validate" id="pol1" next="res1" altNext="fail1"/>
        <event name="Result" id="res1"/>
        <error name="Fail" id="fail1"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const policy = result.nodes.find((n) => n.id === 'custom-pol1');
      expect(policy).toBeDefined();
      // next/altNext use raw values - resolveReference adds "custom-" prefix internally
      expect(policy!.next).toBe('custom-res1');
      expect(policy!.altNext).toBe('custom-fail1');
    });

    it('should resolve altNext by node name for target without custom id, and by custom id for target with one', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <policy name="Check Stock" id="pol1" altNext="StockError"/>
        <error name="StockError" id="ERR_001"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const policy = result.nodes.find((n) => n.id === 'custom-pol1');
      // StockError node has customId -> must be matched by "custom-err_001", not by name
      // Since altNext="StockError" doesn't match custom-err_001, an implicit error node is created
      expect(policy!.altNext).toBe('Flow_StockError');
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

    it('should resolve altNext by name for target without customId, and by raw value for target with one', () => {
      const xml = `<eventstorming><aggregate name="Order"><container name="Flow">
        <policy name="Check Stock" id="POL_01" next="GOOD" altNext="OutOfStock"/>
        <event name="GoodStock" id="GOOD"/>
        <error name="OutOfStock" id="OUT"/>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const policy = result.nodes.find((n) => n.id === 'custom-POL_01');
      // next="GOOD" -> resolveReference tries "custom-GOOD" -> matches custom-id node
      expect(policy!.next).toBe('custom-GOOD');
      // altNext="OutOfStock" -> resolveReference tries "custom-OutofStock" (no match), then name match excludes customId nodes -> implicit error node
      expect(policy!.altNext).toBe('Flow_OutOfStock');
    });

    it('should prefer policy over error when altNext name collides on same label', () => {
      const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
        <command name="Record Failed Attempt" altNext="Failed Exception" offset="1"/>
        <policy name="Failed Exception" next="Call Recorded"></policy>
        <error id="failed-exception-1" name="Failed Exception"></error>
      </container></aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const cmd = result.nodes.find((n) => n.label === 'Record Failed Attempt');
      // altNext="Failed Exception" should resolve to the policy (first match, no customId), not the error
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
      // altNext="Failed Exception" -> first match by name = policy (no customId)
      expect(cmd!.altNext).toBe('Flow_Failed_Exception');
      // altNext="failed-exception-1" is an explicit custom id -> resolves to custom-failed-exception-1
      expect(evt!.altNext).toBe('custom-failed-exception-1');
    });

    describe('custom ID matching priority (spec/id-matching-priority.md)', () => {
      it('should prepend "custom-" prefix to custom id in XML', () => {
        const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
          <policy name="UserRegistrationFailedException" id="reg-failed"></policy>
        </container></aggregate></eventstorming>`;
        const result = parseDSL(xml);
        const policy = result.nodes.find((n) => n.label === 'UserRegistrationFailedException');
        expect(policy!.id).toBe('custom-reg-failed');
        expect(policy!.customId).toBe('reg-failed');
      });

      it('should not double-prefix if custom id already has "custom-" prefix', () => {
        const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
          <policy name="SomePolicy" id="custom-already"></policy>
        </container></aggregate></eventstorming>`;
        const result = parseDSL(xml);
        const policy = result.nodes.find((n) => n.label === 'SomePolicy');
        expect(policy!.id).toBe('custom-already');
      });

      it('should match node by custom id first (with implicit "custom-" prefix)', () => {
        const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
          <policy name="Failed Exception" id="my-fail-policy" />
          <policy name="Another Policy" />
        </container></aggregate></eventstorming>`;
        const result = parseDSL(xml);
        // Reference by "custom-my-fail-policy" should resolve to the node with customId
        const policy2 = result.nodes.find((n) => n.label === 'Another Policy');
        expect(policy2!.id).not.toBe('custom-my-fail-policy');
      });

      it('should not match node by name when it has a custom id', () => {
        // Two nodes with same label "Failed Exception" - one has customId, one doesn't
        const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
          <policy name="Failed Exception" id="my-fail" />
          <policy name="Failed Exception" />
        </container></aggregate></eventstorming>`;
        const result = parseDSL(xml);
        // Both nodes exist
        const policy1 = result.nodes.find((n) => n.id === 'custom-my-fail');
        const policy2 = result.nodes.find((n) => n.id !== 'custom-my-fail' && n.label === 'Failed Exception');
        expect(policy1).toBeDefined();
        expect(policy2).toBeDefined();
        // The one without customId should still be findable by name
        // The one with customId should NOT be matched by name-based resolution
        expect(policy1!.customId).toBe('my-fail');
      });

      it('should resolve altNext by raw value when referencing a node with custom id', () => {
        const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
          <policy name="Check Stock" next="Has Stock?" altNext="order-failed" />
          <event name="Order Failed" id="order-failed" />
        </container></aggregate></eventstorming>`;
        const result = parseDSL(xml);
        const checkStock = result.nodes.find((n) => n.label === 'Check Stock');
        // altNext="order-failed" -> resolveReference tries "custom-order-failed" -> matches
        expect(checkStock!.altNext).toBe('custom-order-failed');
      });

      it('should allow two nodes with same label but different custom ids to coexist without name collision', () => {
        const xml = `<eventstorming><aggregate name="Test"><container name="Flow">
          <policy name="Failed Exception" id="fail-1" />
          <policy name="Failed Exception" id="fail-2" />
        </container></aggregate></eventstorming>`;
        const result = parseDSL(xml);
        const fail1 = result.nodes.find((n) => n.id === 'custom-fail-1');
        const fail2 = result.nodes.find((n) => n.id === 'custom-fail-2');
        expect(fail1).toBeDefined();
        expect(fail2).toBeDefined();
      });
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

    it('should support nodes with custom id in XML', () => {
      const xml = `<eventstorming><process name="Flow">
        <command name="Customer" id="ext_cust" />
        <externalSystem name="Gateway" id="ext_gw" />
      </process></eventstorming>`;
      const result = parseDSL(xml);
      expect(result.nodes.length).toBe(2);
      expect(result.nodes[0].id).toBe('custom-ext_cust');
      expect(result.nodes[1].id).toBe('custom-ext_gw');
    });

    it('should return empty model for text DSL input (format no longer supported)', () => {
      const dsl = `aggregate: Order [green] {
        process: Customer [id="CUST_123"] -> PlaceOrder [id="PO_456"]
      }`;
      const result = parseDSL(dsl);
      expect(result.nodes.length).toBe(0); // text DSL no longer supported, returns empty model
    });
  });

  describe('container boundary enforcement', () => {
    it('should track parentId/subContainers on containers and containerId on nodes', () => {
      const xml = `<eventstorming><process name="OrderFlow">
        <container name="Checkout">
          <command name="PlaceOrder" />
          <event name="OrderPlaced" />
        </container>
      </process></eventstorming>`;
      const result = parseDSL(xml);
      const placeOrder = result.nodes.find((n) => n.label === 'PlaceOrder');
      // Node's containerId = immediate parent container
      expect(placeOrder!.containerId).toBe('Checkout');
      // Parent container has correct parentId and subContainers
      const checkout = result.containers.find((c) => c.id === 'Checkout');
      expect(checkout?.parentId).toBe('OrderFlow');
      const orderFlow = result.containers.find((c) => c.id === 'OrderFlow');
      expect(orderFlow?.subContainers.map((c) => c.id)).toEqual(['Checkout']);
    });

    it('should allow linking between nodes in sibling sub-containers under same parent', () => {
      // "Place Order" and "Inventory Check" are siblings under <aggregate>, scopeBoundary = aggregate id
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
      // Sibling containers share parent -> scopeBoundary allows name match
      expect(placeOrder!.next).toBe('Inventory_Check_CheckStock');
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
      // Two different nodes happen to share the same custom ID "PO_001" in different roots (now "custom-PO_001")
      expect(result.nodes.filter((n) => n.id === 'custom-PO_001').length).toBe(2);
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
      const placeOrder = result.nodes.find((n) => n.label === 'PlaceOrder');
      // OutOfStock in Inventory Service should NOT be resolved by a node in Order container
      expect(placeOrder!.altNext).not.toBe('Inventory_Check_OutOfStock');
      // Should create an implicit error node, scoped to PlaceOrder's root
      const implicitError = result.nodes.find(
        (n) => n.type === 'error' && n.containerId === 'Place_Order' && n.label === 'OutOfStock'
      );
      expect(implicitError).toBeTruthy();
    });

    it('should create implicit error nodes scoped to the referencing node container', () => {
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
      // Error node containerId = referencing node's immediate parent container
      expect(implicitError!.containerId).toBe('Place_Order');
    });

    it('should allow linking between nodes in nested sub-containers sharing same root container', () => {
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
      const isAddressValid = result.nodes.find((n) => n.label === 'IsAddressValid');
      const addressInvalid = result.nodes.find((n) => n.label === 'AddressInvalid');
      // Nested sub-containers share parent container scope -> altNext link resolves
      expect(isAddressValid!.altNext).toBe(addressInvalid!.id);
    });

    const crossRootXml = `<eventstorming>
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
    </eventstorming>`;

    it('sibling sub-containers within same root share the same parent container', () => {
      const result = parseDSL(crossRootXml);
      const placeOrderContainer = result.containers.find((c) => c.id === 'Place_Order');
      const cancelOrderContainer = result.containers.find((c) => c.id === 'Cancel_Order_Container');
      // Both are subContainers of the same parent (Order Lifecycle Container)
      expect(placeOrderContainer?.parentId).toBe(cancelOrderContainer?.parentId);
    });

    it('nodes in different root containers have different parent containers', () => {
      const result = parseDSL(crossRootXml);
      const placeOrderCmd = result.nodes.find((n) => n.label === 'PlaceOrder');
      const customer1 = result.nodes.find((n) => n.label === 'Customer 1');

      expect(placeOrderCmd!.containerId).not.toBe(customer1!.containerId);
    });

    it('Cancel Order Container customer next="PlaceOrder" resolves to PlaceOrder in sibling sub-container (same root)', () => {
      const result = parseDSL(crossRootXml);
      // The Customer node in Cancel Order Container has id containing that sub-container prefix
      const cancelOrderCustomer = result.nodes.find(
        (n) => n.label === 'Customer' && n.id.includes('Cancel_Order_Container')
      );
      const placeOrderCmd = result.nodes.find((n) => n.label === 'PlaceOrder');

      expect(cancelOrderCustomer!.next).toBe(placeOrderCmd!.id);
    });

    it('Cancel Order Container customer altNext="CancelOrder" resolves within same root', () => {
      const result = parseDSL(crossRootXml);
      const cancelOrderCustomer = result.nodes.find(
        (n) => n.label === 'Customer' && n.id.includes('Cancel_Order_Container')
      );
      const cancelOrderCmd = result.nodes.find((n) => n.label === 'CancelOrder');

      expect(cancelOrderCustomer!.altNext).toBe(cancelOrderCmd!.id);
    });

    it('Customer 1 next="Place Order" is blocked across root containers and resolves to null', () => {
      const result = parseDSL(crossRootXml);
      const customer1 = result.nodes.find((n) => n.label === 'Customer 1');
      const placeOrderCmd = result.nodes.find((n) => n.label === 'PlaceOrder');

      expect(customer1!.next).not.toBe(placeOrderCmd!.id);
      expect(customer1!.next).toBeNull();

      // No implicit error node created for next (only altNext creates them)
      const implicitError = result.nodes.find(
        (n) => n.type === 'error' && n.label === 'Place Order' && n.containerId === customer1!.containerId
      );
      expect(implicitError).toBeUndefined();
    });

    it('Customer 1 altNext="CancelOrder 1" resolves within Cancel Order 1 Container (same root)', () => {
      const result = parseDSL(crossRootXml);
      const customer1 = result.nodes.find((n) => n.label === 'Customer 1');
      const cancelOrder1 = result.nodes.find((n) => n.label === 'CancelOrder 1');

      expect(customer1!.altNext).toBe(cancelOrder1!.id);
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
      // Both nodes share rootContainerId = "Order_Place_Order" -> linking works
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
    // "Failed Attempt Recorded" altNext is explicit custom id -> resolves to custom-failed-exception-1
    const failedRecorded = result.nodes.find((n) => n.label === 'Failed Attempt Recorded');
    expect(failedRecorded!.altNext).toBe('custom-failed-exception-1');
  });

  describe('nested container synthetic process creation', () => {
    const xml = `<eventstorming>
      <aggregate name="Order">
        <container name="Place Order">
          <command name="PlaceOrder" next="IsAddressValid" />
          <container name="PlaceOrder">
            <policy name="IsAddressValid" altNext="AddressIsInValid" />
            <policy name="IsEmailValid" next="Do Something" altNext="Email is invalid" />
            <container name="Another Sub Process">
              <command name="Do Something" />
              <policy name="Is Something Valid?" next="InventoryService" altNext="Something Is Invalid" />
              <error name="Something Is Invalid" next=""></error>
            </container>
          </container>
          <externalSystem name="InventoryService" />
          <policy name="Do We Have Stock?" altNext="Out Of Stock" />
          <event name="OrderPlaced" />
        </container>
      </aggregate>
    </eventstorming>`;

    it('top-level aggregate has one process named after its direct child container', () => {
      const result = parseDSL(xml);
      const order = result.containers.find(c => c.label === 'Order');
      expect(order).toBeDefined();
      expect(order!.processes).toHaveLength(1);
      expect(order!.processes[0].name).toBe('Place Order');
    });

    it('aggregate process includes all nodes from all nesting levels', () => {
      const result = parseDSL(xml);
      const order = result.containers.find(c => c.label === 'Order');
      const stepIds = order!.processes[0].stepIds;
      const labels = stepIds.map(id => result.nodes.find(n => n.id === id)?.label);
      expect(labels).toContain('PlaceOrder');
      expect(labels).toContain('IsAddressValid');
      expect(labels).toContain('IsEmailValid');
      expect(labels).toContain('Do Something');
      expect(labels).toContain('Is Something Valid?');
      expect(labels).toContain('Something Is Invalid');
      expect(labels).toContain('InventoryService');
      expect(labels).toContain('Do We Have Stock?');
      expect(labels).toContain('OrderPlaced');
    });

    it('aggregate process has subGroups for nested containers', () => {
      const result = parseDSL(xml);
      const order = result.containers.find(c => c.label === 'Order');
      const subGroups = order!.processes[0].subGroups ?? [];
      const sgNames = subGroups.map(sg => sg.name);
      expect(sgNames).toContain('PlaceOrder');
      expect(sgNames).toContain('Another Sub Process');
    });

    it('PlaceOrder subGroup contains nodes from both PlaceOrder and Another Sub Process', () => {
      const result = parseDSL(xml);
      const order = result.containers.find(c => c.label === 'Order');
      const subGroups = order!.processes[0].subGroups ?? [];
      const placeOrderSG = subGroups.find(sg => sg.name === 'PlaceOrder');
      const anotherSG = subGroups.find(sg => sg.name === 'Another Sub Process');
      expect(placeOrderSG).toBeDefined();
      expect(anotherSG).toBeDefined();
      // PlaceOrder subGroup should contain all nested nodes (superset of Another Sub Process)
      for (const id of anotherSG!.nodeIds) {
        expect(placeOrderSG!.nodeIds).toContain(id);
      }
      // PlaceOrder subGroup should have more nodes than Another Sub Process
      expect(placeOrderSG!.nodeIds.length).toBeGreaterThan(anotherSG!.nodeIds.length);
    });
  });

  describe('offset attribute parsing', () => {
    it('parses offset from XML inline process node', () => {
      const xml = `<eventstorming><process name="Test">
        <command name="A" offset="1" next="B"/>
        <command name="B"/>
      </process></eventstorming>`;
      const result = parseDSL(xml);
      const nodeA = result.nodes.find(n => n.label === 'A');
      expect(nodeA!.offset).toBe(1);
      const nodeB = result.nodes.find(n => n.label === 'B');
      expect(nodeB!.offset).toBeUndefined();
    });

    it('parses offset from XML nested container node', () => {
      const xml = `<eventstorming><aggregate name="Test">
        <container name="Flow">
          <command name="Record Failed Attempt" altNext="Failed Exception" offset="1"/>
          <policy name="Failed Exception" next="Call Recorded"/>
        </container>
      </aggregate></eventstorming>`;
      const result = parseDSL(xml);
      const cmd = result.nodes.find(n => n.label === 'Record Failed Attempt');
      expect(cmd!.offset).toBe(1);
    });
  });
});
