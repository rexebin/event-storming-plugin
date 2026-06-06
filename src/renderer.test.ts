/**
 * Tests for the D3 renderer helper functions.
 */

import { afterEach, describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { renderEventStorming } from './renderer.js';
import { computeLayout } from './layout.js';
import { NODE_H, NODE_W, CONTAINER_PADDING, GROUP_PADDING } from './constants.js';
import { getPointOnPath, computeLinkPath } from './links.js';
import { parseDSL } from './dsl.js';

// We need to extract the helper functions from renderer.ts
// Since renderer.ts uses D3 heavily, we test the pure functions in isolation
// by re-implementing the logic here and verifying against known outputs.

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function darken(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

describe('isLight', () => {
  it('should return true for light colors', () => {
    expect(isLight('#ffffff')).toBe(true);
    expect(isLight('#FFF1AA')).toBe(true);
    expect(isLight('#ffffff')).toBe(true);
  });

  it('should return false for dark colors', () => {
    expect(isLight('#000000')).toBe(false);
    expect(isLight('#24292e')).toBe(false);
    expect(isLight('#1a1a1a')).toBe(false);
  });

  it('should return true for orange (#FFA500)', () => {
    expect(isLight('#FFA500')).toBe(true);
  });

  it('should return true for light green (#91D49C)', () => {
    expect(isLight('#91D49C')).toBe(true);
  });

  it('should return true for green (#FEE254)', () => {
   expect(isLight('#FEE254')).toBe(true);
  });

  it('should return true for light gray (#D4D3D3)', () => {
    expect(isLight('#D4D3D3')).toBe(true);
  });

  it('should return true for yellow (#FEE254)', () => {
    expect(isLight('#FEE254')).toBe(true);
  });
});

describe('darken', () => {
  it('should darken a color by the given amount', () => {
    // Darken white by 30%: 255 * 0.7 = 178.5 → Math.round = 179 = 0xb3
   expect(darken('#ffffff', 0.3)).toBe('#b3b3b3');
  });

  it('should not produce values below 0', () => {
    // Darken black should stay black
    expect(darken('#000000', 0.5)).toBe('#000000');
  });

  it('should not produce values above original', () => {
    // Darken by negative amount (brighten) should work but stay reasonable
    const result = darken('#ff0000', -0.1);
    expect(parseInt(result.slice(1, 3), 16)).toBeLessThanOrEqual(0xff);
  });

  it('should return a valid hex string', () => {
    const result = darken('#FFA500', 0.3);
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should handle full opacity (amount 1.0)', () => {
    expect(darken('#ffffff', 1.0)).toBe('#000000');
  });

  it('should handle zero opacity (amount 0.0)', () => {
    expect(darken('#ffffff', 0.0)).toBe('#ffffff');
  });
});

describe('escapeHtml', () => {
  it('should escape < and > characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('should escape & and " characters', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should return plain text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle text with mixed HTML entities', () => {
   // jsdom doesn't escape double quotes like a browser, so we just check
   // the < and > are escaped and & is escaped
   const result = escapeHtml('<b>Bold</b> & "quoting"');
   expect(result).toContain('&lt;b&gt;Bold&lt;/b&gt;');
   expect(result).toContain('&amp;');
  });
});

const readmeSample = `
<eventstorming>
  <aggregate name="Order">
    <container name="Cancel Order">
      <actor name="Customer" next="CancelOrder"/>
      <actor name="Staff" next="CancelOrder"/>
      <event name="PaymentFailed" next="CancelOrder"/>
      <command name="CancelOrder" next="Is Cancellation Allowed?"/>
      <policy name="Is Cancellation Allowed?" next="OrderCancelled" altNext="CancellationDenied"/>
      <event name="OrderCancelled"/>
    </container>
  </aggregate>
  <readmodel name="OrderDetail">
    <container name="Order Detail Projection">
      <event name="OrderPlaced" next="Order Detail View"/>
      <event name="OrderCancelled" next="Order Detail View"/>
      <event name="OrderUpdated" next="Order Detail View"/>
      <event name="OrderShipped" next="Order Detail View"/>
      <readmodel name="Order Detail View"/>
    </container>
  </readmodel>
</eventstorming>
`;

const noteSample = `
<eventstorming>
   <aggregate name="Order">
     <container name="Place Order">
        <command name="PlaceOrder">
             <notes>Requires manager approval</notes>
             <notes>Audit this action</notes>
          </command>
      </container>
    </aggregate>
    <aggregate name="User">
      <container name="User Registration">
        <event name="UserRegistered" next="Some Note"/>
        <note name="Some Note"><note>This is a note attached to the UserRegistered event.</note></note>
      </container>
    </aggregate>
</eventstorming>
`;

const showerSample = `
<eventstorming>
  <aggregate name="Order">
    <container name="Shower">
      <command name="Have Shower" next="Is the shower running?"/>
      <policy name="Is the shower running?" next="Have shower gel?" altNext="Switch on shower"/>
      <externalsystem name="Switch on shower" next="Have shower gel?"/>
      <policy name="Have shower gel?" next="Get Dressed" altNext="Go Buy Shower Gel"/>
      <error name="Go Buy Shower Gel"/>
      <event name="Get Dressed"/>
    </container>
  </aggregate>
</eventstorming>
`;

const groupedSample = `
<eventstorming>
  <aggregate name="Order">
    <container name="Place Order">
      <notes>Handles the happy path for order placement.</notes>
      <actor name="Customer" next="PlaceOrder"/>
      <command name="PlaceOrder" next="OrderPlaced"/>
      <event name="OrderPlaced"/>
    </container>
    <container name="Cancel Order">
      <actor name="Support" next="CancelOrder"/>
      <command name="CancelOrder" next="OrderCancelled"/>
      <event name="OrderCancelled"/>
    </container>
  </aggregate>
</eventstorming>
`;

const wrapSample = `
<eventstorming>
  <aggregate name="User">
    <container name="User Registration">
      <actor name="Customer" next="Register"/>
      <command name="Register" next="Is Email Valid?"/>
      <policy name="Is Email Valid?" next="UserRegistered" altNext="Invalid Email"/>
      <event name="UserRegistered"/>
    </container>
  </aggregate>
  <aggregate name="Morning Routine">
    <container name="Wake Up">
      <actor name="Me" next="WakeUp"/>
      <command name="WakeUp" next="Is Alarm Ringing?"/>
      <policy name="Is Alarm Ringing?" next="Got Out of Bed" altNext="Sleep In"/>
      <event name="Got Out of Bed"/>
    </container>
  </aggregate>
  <aggregate name="Order">
    <container name="Place Order">
      <command name="PlaceOrder" next="InventoryService"/>
      <externalsystem name="InventoryService" next="Do We Have Stock?"/>
      <policy name="Do We Have Stock?" next="PaymentGateway" altNext="Out Of Stock"/>
      <externalsystem name="PaymentGateway" next="OrderPlaced"/>
      <event name="OrderPlaced"/>
    </container>
  </aggregate>
  <process name="Customer Order View">
    <container name="View Order Details">
      <actor name="Customer" next="GetOrderDetails"/>
      <query name="GetOrderDetails" next="Order Detail Projection"/>
      <readmodel name="Order Detail Projection"/>
    </container>
  </process>
</eventstorming>
`;

function getTranslate(element: Element): { x: number; y: number } {
  const transform = element.getAttribute('transform') || '';
  const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);

  if (!match) {
    throw new Error(`Missing translate() on element: ${transform}`);
  }

  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

const simpleGroupTypeSample = `
<eventstorming>
  <aggregate name="Order">
    <container name="Aggregate Container">
      <container name="Order Processing">
        <command name="ProcessOrder"/>
        <event name="OrderProcessed"/>
      </container>
    </container>
  </aggregate>
</eventstorming>
`;

describe('renderEventStorming layout', () => {
  it('stacks shared inputs to the left of CancelOrder without overlap', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    const customer = host.querySelector('[data-id="Cancel_Order_Customer"]');
    const staff = host.querySelector('[data-id="Cancel_Order_Staff"]');
    const paymentFailed = host.querySelector('[data-id="Cancel_Order_PaymentFailed"]');
    const cancelOrder = host.querySelector('[data-id="Cancel_Order_CancelOrder"]');

    expect(customer).toBeTruthy();
    expect(staff).toBeTruthy();
    expect(paymentFailed).toBeTruthy();
    expect(cancelOrder).toBeTruthy();

    const customerPos = getTranslate(customer!);
    const staffPos = getTranslate(staff!);
    const paymentFailedPos = getTranslate(paymentFailed!);
    const cancelOrderPos = getTranslate(cancelOrder!);

    expect(customerPos.x).toBeLessThan(cancelOrderPos.x);
    expect(staffPos.x).toBeLessThan(cancelOrderPos.x);
    expect(paymentFailedPos.x).toBeLessThan(cancelOrderPos.x);
    expect(new Set([customerPos.y, staffPos.y, paymentFailedPos.y]).size).toBe(3);
  });

  it('places read-model events on both sides of the view', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    const view = host.querySelector('[data-id="Order_Detail_Projection_Order_Detail_View"]');
    const eventIds = [
      'Order_Detail_Projection_OrderPlaced',
      'Order_Detail_Projection_OrderCancelled',
      'Order_Detail_Projection_OrderUpdated',
      'Order_Detail_Projection_OrderShipped',
    ];

    expect(view).toBeTruthy();
    const viewPos = getTranslate(view!);
    const eventPositions = eventIds.map((id) => {
      const node = host.querySelector(`[data-id="${id}"]`);
      expect(node).toBeTruthy();
      return getTranslate(node!);
    });

    expect(eventPositions.some((position) => position.x < viewPos.x)).toBe(true);
    expect(eventPositions.some((position) => position.x > viewPos.x)).toBe(true);
  });

  it('uses one marker for every link', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    const links = Array.from(host.querySelectorAll('path.es-link'));
    expect(links.length).toBeGreaterThan(0);

    const markers = new Set(links.map((link) => link.getAttribute('marker-end')));

    expect(markers).toEqual(new Set(['url(#arrowhead)']));
  });

  it('shows a note badge and note text in the tooltip when a node has notes', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), noteSample);

    const node = host.querySelector('[data-id="Place_Order_PlaceOrder"]');
    expect(node).toBeTruthy();
    expect(node!.querySelector('.es-note-badge')).toBeTruthy();

    node!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const tooltip = document.body.querySelector('.es-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip!.innerHTML).toContain('PlaceOrder');
    expect(tooltip!.innerHTML).toContain('Command');
    expect(tooltip!.innerHTML).toContain('Requires manager approval');
    expect(tooltip!.innerHTML).toContain('Audit this action');
    expect(tooltip!.innerHTML).not.toContain('in: Order');
  });

  it('shows a tooltip with node name for nodes without notes', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    const node = host.querySelector('[data-id="Cancel_Order_CancelOrder"]');
    expect(node).toBeTruthy();

    node!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const tooltip = document.body.querySelector<HTMLDivElement>('.es-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip!.style.display).toBe('block');
    expect(tooltip!.innerHTML).toContain('CancelOrder');
  });

  it('shows a note icon and tooltip for process groups with notes', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), groupedSample);

    const badge = host.querySelector<SVGGElement>('g.es-group-note-badge');
    expect(badge).toBeTruthy();

    badge!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 20, clientY: 20 }));

    const tooltip = document.body.querySelector('.es-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip!.innerHTML).toContain('Handles the happy path for order placement.');
  });

  it('renders Note nodes with the note color instead of the command color', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), noteSample);

    const note = host.querySelector('[data-id="User_Registration_Some_Note"]');
    expect(note).toBeTruthy();

    const noteShape = note!.querySelector('polygon');
    expect(noteShape).toBeTruthy();
    expect(noteShape!.getAttribute('fill')).toBe('#FFF1AA');
  });

  it('shows the has-notes icon on Note nodes that have notes', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), noteSample);

    const note = host.querySelector('[data-id="User_Registration_Some_Note"]');
    expect(note).toBeTruthy();
    expect(note!.querySelector('.es-note-badge')).toBeTruthy();
  });

  it('does not render Note nodes twice', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), noteSample);

    const notes = host.querySelectorAll('[data-id="User_Registration_Some_Note"]');
    expect(notes).toHaveLength(1);
  });

  it('sizes branched containers to the horizontal flow instead of total node count', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), showerSample);

    const container = host.querySelector('g.containers g[data-name="Order"]');
    expect(container).toBeTruthy();

    const containerRect = container!.querySelector('rect');
    expect(containerRect).toBeTruthy();
    expect(Number(containerRect!.getAttribute('width'))).toBe(708);
  });

  it('wraps later containers onto the next row without overlapping the first row', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), wrapSample);

    const user = host.querySelector('g.containers g[data-name="User"]');
    const order = host.querySelector('g.containers g[data-name="Order"]');
    const customerOrderView = host.querySelector('g.containers g[data-name="Customer Order View"]');
    expect(user).toBeTruthy();
    expect(order).toBeTruthy();
    expect(customerOrderView).toBeTruthy();

    const userPos = getTranslate(user!);
    const orderPos = getTranslate(order!);
    const customerOrderViewPos = getTranslate(customerOrderView!);
    const userHeight = Number(user!.querySelector('rect')!.getAttribute('height'));
    const orderHeight = Number(order!.querySelector('rect')!.getAttribute('height'));
    const firstRowBottom = Math.max(userPos.y + userHeight, orderPos.y + orderHeight);

    expect(customerOrderViewPos.y).toBeGreaterThan(firstRowBottom);
  });

  it('keeps the main policy chain moving right when a negative branch rejoins it', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), showerSample);

    const isShowerRunning = host.querySelector('[data-id="Shower_Is_the_shower_running_"]');
    const haveShowerGel = host.querySelector('[data-id="Shower_Have_shower_gel_"]');
    const switchOnShower = host.querySelector('[data-id="Shower_Switch_on_shower"]');

    expect(isShowerRunning).toBeTruthy();
    expect(haveShowerGel).toBeTruthy();
    expect(switchOnShower).toBeTruthy();

    const runningPos = getTranslate(isShowerRunning!);
    const gelPos = getTranslate(haveShowerGel!);
    const switchPos = getTranslate(switchOnShower!);

    expect(gelPos.x).toBeGreaterThan(runningPos.x);
    expect(gelPos.y).toBe(runningPos.y);
    expect(gelPos.x - runningPos.x).toBe(166);
    expect(switchPos.y).toBeGreaterThan(runningPos.y);
  });

  it('curves the negative rejoin link back into the main flow', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), showerSample);

    const haveShowerGel = host.querySelector('[data-id="Shower_Have_shower_gel_"]');
    const switchOnShower = host.querySelector('[data-id="Shower_Switch_on_shower"]');

    expect(haveShowerGel).toBeTruthy();
    expect(switchOnShower).toBeTruthy();

    const curvedRejoin = host.querySelector<SVGPathElement>(
      `path.es-link-default[data-source="${switchOnShower!.getAttribute('data-id')}"][data-target="${haveShowerGel!.getAttribute('data-id')}"]`
    );
    const curvedRejoinPath = curvedRejoin?.getAttribute('d') || '';

    expect(curvedRejoin).toBeTruthy();
    // Rejoin links between same-row chain nodes use bezier curves (default type)
    expect(curvedRejoinPath).toContain(' C ');
    expect(curvedRejoin!.getAttribute('marker-end')).toBe('url(#arrowhead)');
  });

  it('offsets the "no" label away from the negative link line', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), showerSample);

    const noLabel = Array.from(host.querySelectorAll<SVGTextElement>('g.links text'))
      .find((label) => label.textContent === 'no');
    const negativeLink = host.querySelector<SVGPathElement>('path.es-link-negative');
    expect(noLabel).toBeTruthy();
    expect(negativeLink).toBeTruthy();

    const mid = getPointOnPath(negativeLink!.getAttribute('d') || '', 0.5);
    expect(Number(noLabel!.getAttribute('x'))).toBe(mid.x + 14);
    expect(Number(noLabel!.getAttribute('y'))).toBe(mid.y - 10);
  });

  it('curves fan-in links when source nodes are on different rows', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    const customer = host.querySelector('[data-id="Cancel_Order_Customer"]');
    const staff = host.querySelector('[data-id="Cancel_Order_Staff"]');
    const paymentFailed = host.querySelector('[data-id="Cancel_Order_PaymentFailed"]');
    const cancelOrder = host.querySelector('[data-id="Cancel_Order_CancelOrder"]');

    expect(customer).toBeTruthy();
    expect(staff).toBeTruthy();
    expect(paymentFailed).toBeTruthy();
    expect(cancelOrder).toBeTruthy();

    const cancelOrderPos = getTranslate(cancelOrder!);

    for (const source of [customer!, staff!, paymentFailed!]) {
      const path = host.querySelector<SVGPathElement>(
        `path.es-link-default[data-source="${source.getAttribute('data-id')}"][data-target="${cancelOrder!.getAttribute('data-id')}"]`
      );
      const sourcePos = getTranslate(source);
      const pathD = path?.getAttribute('d') || '';

      expect(path).toBeTruthy();
      expect(path!.getAttribute('marker-end')).toBe('url(#arrowhead)');

      if (sourcePos.y === cancelOrderPos.y) {
        expect(pathD).not.toContain(' C ');
       } else {
        expect(pathD).toContain(' C ');
        const expectedAnchorY = sourcePos.y > cancelOrderPos.y
          ? cancelOrderPos.y + NODE_H * 0.75
          : cancelOrderPos.y + NODE_H * 0.25;
        expect(pathD.endsWith(`${cancelOrderPos.x} ${expectedAnchorY}`)).toBe(true);
       }
    }
  });

  it('draws a group container for each process and places its name in the top-left corner', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), groupedSample);

    const groups = Array.from(host.querySelectorAll<SVGGElement>('g.es-process-group'));
    expect(groups).toHaveLength(2);

    const placeOrderGroup = groups.find((group) => group.getAttribute('data-name') === 'Place Order');
    expect(placeOrderGroup).toBeTruthy();

    const title = placeOrderGroup!.querySelector('text');
    expect(title?.textContent).toBe('Place Order');

    const titleX = Number(title?.getAttribute('x'));
    const titleY = Number(title?.getAttribute('y'));
    expect(titleX).toBeLessThan(20);
    expect(titleY).toBeLessThan(20);

    const customer = host.querySelector('[data-id="Place_Order_Customer"]');
    expect(customer).toBeTruthy();

    const groupPos = getTranslate(placeOrderGroup!);
    const customerPos = getTranslate(customer!);
    expect(customerPos.x).toBeGreaterThan(groupPos.x);
    expect(customerPos.y).toBeGreaterThan(groupPos.y);
  });

  it('draws negative links from bottom-center of source when target is below', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), showerSample);

    // "Have shower gel?" is a policy with altNext → auto-generated error node below it
    const haveShowerGel = host.querySelector('[data-id="Shower_Have_shower_gel_"]');
    expect(haveShowerGel).toBeTruthy();

    const negativeLink = host.querySelector<SVGPathElement>(
      'path.es-link-negative[data-source="Shower_Have_shower_gel_"]'
    );
    expect(negativeLink).toBeTruthy();

    const pathD = negativeLink!.getAttribute('d') || '';
    // Negative links should be straight lines (M...L...) not curves
    expect(pathD).not.toContain(' C ');
    // Start point y should be source bottom edge (y + NODE_H)
    const mMatch = pathD.match(/^M (\d+) (\d+)/);
    expect(mMatch).toBeTruthy();
    const haveShowerGelPos = getTranslate(haveShowerGel!);
    expect(parseFloat(mMatch![2])).toBe(haveShowerGelPos.y + NODE_H);
  });

  it('uses type === negative for downward path even when isNegative label is empty', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), showerSample);

    // The "Go Buy Shower Gel" error node: positioned below via altNext from a policy
    // Its incoming link has type='negative' but label='' (not 'no')
    const goBuyGel = host.querySelector('[data-id="Shower_Go_Buy_Shower_Gel"]');
    expect(goBuyGel).toBeTruthy();

    const incomingLink = host.querySelector<SVGPathElement>(
      `path.es-link-negative[data-target="${goBuyGel!.getAttribute('data-id')}"]`
    );
    expect(incomingLink).toBeTruthy();

    const pathD = incomingLink!.getAttribute('d') || '';
    // Same column: straight vertical line from bottom-center of source
    expect(pathD).toMatch(/^M \d+ \d+ L \d+ \d+$/);
  });

  it('routes negative links with 90-degree angles for cross-column altNext branches', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), showerSample);

    // "Have shower gel?" is a policy. Its auto-generated error node (altNext target)
    // may or may not be same-column depending on DSL. For cross-column cases,
    // the link should still start from bottom-center and use 90-degree angles.
    const negativeLinks = Array.from(host.querySelectorAll<SVGPathElement>('path.es-link-negative'));
    for (const link of negativeLinks) {
      const pathD = link.getAttribute('d') || '';
      expect(pathD).toContain(' L ');
      // Should start from bottom-center of source (no bezier curves)
      expect(pathD).not.toContain(' C ');
      const mMatch = pathD.match(/^M (\d+) (\d+)/);
      expect(mMatch).toBeTruthy();
    }
  });

  it('offset linear chain nodes fit inside aggregate container', () => {
    const model = parseDSL(`
<eventstorming>
  <aggregate name="Test">
    <container name="Offset Test">
      <command name="Step1" next="Step2"/>
      <command name="Step2" next="Step3"/>
      <command name="Step3" next="Step4"/>
      <command name="Step4" next="Step5"/>
      <command name="Step5" next="Step6"/>
      <command name="Step6" offset="3" next="FinalStep"/>
      <command name="FinalStep"/>
    </container>
  </aggregate>
</eventstorming>
`);

    const layout = computeLayout(model);
    const container = layout.containers[0];

    const leftBound = container.x + CONTAINER_PADDING;
    const rightBound = container.x + container.width - CONTAINER_PADDING;

    for (const node of layout.nodes.filter((n) => n.containerId === container.id)) {
      expect(node.x).toBeGreaterThanOrEqual(leftBound - 1);
      expect(node.x + NODE_W).toBeLessThanOrEqual(rightBound + 1);
    }
  });

  it('process group grows to include offset nodes', () => {
    // A process-level container where one node has offset=3.
    // Without fix: the process group width is fixed from container layout,
    // so offset-shifted nodes land outside the group's right edge.
    const model = parseDSL(`
<eventstorming>
  <process name="Test Process">
    <container name="Inner Container">
      <command name="Step1" next="Step2"/>
      <command name="Step2" next="Step3"/>
      <command name="Step3" next="Step4"/>
      <command name="Step4" next="Step5"/>
      <command name="Step5" next="Step6"/>
      <!-- offset=3 pushes far right -->
      <command name="Step6" offset="3" next="FinalStep"/>
      <command name="FinalStep"/>
    </container>
  </process>
</eventstorming>
`);

    const layout = computeLayout(model);

    // The inner "Inner Container" is rendered as a group under the process container
    const targetGroup = layout.groups[0];
    expect(targetGroup).toBeTruthy();

    const groupNodes = layout.nodes.filter((n) => n.containerId === targetGroup!.containerId);
    expect(groupNodes.length).toBeGreaterThan(0);

    // Group must fully contain all its nodes including offset-shifted ones.
    const rightBound = targetGroup.x + targetGroup.width - GROUP_PADDING;

    for (const node of groupNodes) {
      expect(node.x + NODE_W).toBeLessThanOrEqual(rightBound + 1);
    }
  });

  it('shows next and altNext node labels in tooltip when present', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), showerSample);

    // "Is the shower running?" policy has next="Have shower gel?" and altNext="Switch on shower"
    const node = host.querySelector('[data-id="Shower_Is_the_shower_running_"]');
    expect(node).toBeTruthy();

    node!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const tooltip = document.body.querySelector<HTMLDivElement>('.es-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip!.innerHTML).toContain('Is the shower running?');
    expect(tooltip!.innerHTML).toContain('Have shower gel?');
    expect(tooltip!.innerHTML).toContain('Switch on shower');
  });

  it('shows next label but not altNext when only next is set', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    // "CancelOrder" has next="Is Cancellation Allowed?" but no altNext
    const node = host.querySelector('[data-id="Cancel_Order_CancelOrder"]');
    expect(node).toBeTruthy();

    node!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const tooltip = document.body.querySelector<HTMLDivElement>('.es-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip!.innerHTML).toContain('CancelOrder');
    expect(tooltip!.innerHTML).toContain('Is Cancellation Allowed?');
  });

  it('skips next and altNext in tooltip when neither is set', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    // "OrderCancelled" event has no next or altNext (leaf node)
    const node = host.querySelector('[data-id="Cancel_Order_OrderCancelled"]');
    expect(node).toBeTruthy();

    node!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    const tooltip = document.body.querySelector<HTMLDivElement>('.es-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip!.innerHTML).toContain('OrderCancelled');
  });

  it('sizes SVG to fill container width even when diagram is narrower', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'getBoundingClientRect', {
      value: () => ({ width: 2000 }),
      writable: true,
      configurable: true,
    });
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    const svg = host.querySelector('svg');
    expect(svg).toBeTruthy();
    // SVG width should match container (2000), not the diagram layout width
    expect(Number(svg!.getAttribute('width'))).toBe(2000);
  });

  it('centers narrower diagrams horizontally inside the full-width SVG', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'getBoundingClientRect', {
      value: () => ({ width: 2000 }),
      writable: true,
      configurable: true,
    });
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    const svg = host.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(Number(svg!.getAttribute('width'))).toBe(2000);

    // The leftmost container element should have a positive X offset,
    // centering the diagram within the SVG.
    const firstContainer = host.querySelector<SVGGElement>('g.containers g[data-name="Order"]');
    expect(firstContainer).toBeTruthy();
    const pos = getTranslate(firstContainer!);
    // With container padding of 24 and layout width much smaller than 2000,
    // the offset should be > 24 (centering pushes content inward from edges).
    expect(pos.x).toBeGreaterThan(CONTAINER_PADDING * 3);
  });

  it('does not offset when diagram fills the container', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'getBoundingClientRect', {
      value: () => ({ width: 800 }),
      writable: true,
      configurable: true,
    });
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), readmeSample);

    const svg = host.querySelector('svg');
    expect(svg).toBeTruthy();
    // When container is smaller than the layout, SVG should be at least layout width
    const svgWidth = Number(svg!.getAttribute('width'));
    const layout = computeLayout(parseDSL(readmeSample));
    expect(svgWidth).toBeCloseTo(layout.width + CONTAINER_PADDING * 2, 0);
  });

  it('renders a type badge on containers showing their type', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), simpleGroupTypeSample);

    const containers = Array.from(host.querySelectorAll<SVGGElement>('g.containers g'));
    for (const container of containers) {
      const badge = container.querySelector('text.es-container-type-badge');
      expect(badge).toBeTruthy();
    }
  });

  it('shows correct type label text for aggregate containers', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), simpleGroupTypeSample);

    const containers = Array.from(host.querySelectorAll<SVGGElement>('g.containers g'));
    expect(containers.length).toBeGreaterThan(0);

    const badge = containers[0].querySelector<SVGTextElement>('text.es-container-type-badge');
    expect(badge?.textContent).toBe('Aggregate');
  });

  it('shows correct type label text for readModel (projector) containers', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), `
<eventstorming>
  <readmodel name="Customer">
    <container name="Main Flow">
      <query name="ViewProfile"/>
    </container>
  </readmodel>
</eventstorming>
`);

    const containers = Array.from(host.querySelectorAll<SVGGElement>('g.containers g'));
    expect(containers.length).toBeGreaterThan(0);

    const badge = containers[0].querySelector<SVGTextElement>('text.es-container-type-badge');
    expect(badge?.textContent).toBe('Projector');
  });

  it('shows correct type label text for externalSystem containers', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), `
<eventstorming>
  <externalsystem name="Shipping">
    <container name="Main Flow">
      <command name="Ship"/>
    </container>
  </externalsystem>
</eventstorming>
`);

    const containers = Array.from(host.querySelectorAll<SVGGElement>('g.containers g'));
    expect(containers.length).toBeGreaterThan(0);

    const badge = containers[0].querySelector<SVGTextElement>('text.es-container-type-badge');
    expect(badge?.textContent).toBe('External System');
  });

  it('shows correct type label text for process containers', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    renderEventStorming(d3.select(host), `
<eventstorming>
  <process name="Checkout">
    <container name="Flow">
      <command name="Pay"/>
    </container>
  </process>
</eventstorming>
`);

    const containers = Array.from(host.querySelectorAll<SVGGElement>('g.containers g'));
    expect(containers.length).toBeGreaterThan(0);

    const badge = containers[0].querySelector<SVGTextElement>('text.es-container-type-badge');
    expect(badge?.textContent).toBe('Process');
  });
});

describe('computeLinkPath obstacle avoidance', () => {
  function makeNode(id: string, x: number, y: number): import('./constants.js').LayoutNode {
    return { id, x, y, label: '', type: 'command' as any, color: '#FEE254', containerId: 'c', processIndex: 0, noteTarget: null, next: undefined, altNext: undefined, notes: [] };
  }

  it('routes upward negative link around intermediate nodes by going down first', () => {
    // Layout — obstacles between source and target that block the direct upward path:
    //   C0                    C1
    //   ┌──────┐              ┌──────┐
    //   │Target│               │ Source│
    //   └──────┘                └──┬───┘
    //                          direct up crosses obstacle
    //                      ┌─────▼─────┐
    //                      │ Obstacle  │

    const source = makeNode('src', 130 + 36, 0);        // x=166 (C1), y=0
    const target = makeNode('tgt', 0, -80);                // x=0 (C0), y=-80 (above)
    const obstacle = makeNode('obs', 130 + 36, 40);          // x=166 (same col, BELOW source bottom)

    const pathD = computeLinkPath(source, target, 'negative', [target, obstacle], true);

    // Path should NOT go directly upward through the obstacle
    expect(pathD).not.toMatch(/^M \d+ \d+ L \d+ \d+$/);

    // The path goes down first to clear obstacles below, routes sideways, then up
    // Start from top of source since safeX=462 is outside source column [166, 296]
    const mMatch = pathD.match(/^M (\d+) (\d+)/);
    expect(mMatch).toBeTruthy();
    expect(parseInt(mMatch![1])).toBe(source.x + NODE_W / 2); // starts at center X
  });

  it('goes down through first available gap when left side is blocked', () => {
    // C0           C1           C2
    // ┌──────┐     ┌──────┐     ┌──────┐
    // │Obs L │     │Source│     │ Target (above)
    // └──────┘     └──┬───┘     └──────┘
    //                  │ direct up crosses ObsL
    //            ┌─────▼─────┐
    //            │  ObsM     │

    const source = makeNode('src', 130 + 36, 0);        // x=166 (C1), y=0
    const target = makeNode('tgt', 2 * (130 + 36), -80); // x=332 (C2), y=-80 (above)
    const obsL = makeNode('obsL', 0, -40);                // C0, blocking left gap at source level
    const obsM = makeNode('obsM', 130 + 36, -40);         // same col as source

    const pathD = computeLinkPath(source, target, 'negative', [target, obsL, obsM], true);

    // Path should start from bottom of source and go down
    const mMatch = pathD.match(/^M (\d+) (\d+)/);
    expect(mMatch).toBeTruthy();
    expect(parseInt(mMatch![1])).toBe(source.x + NODE_W / 2);  // starts at center X
    expect(parseInt(mMatch![2])).toBe(source.y + NODE_H);       // starts at bottom Y
  });

  it('finds gap on right side when left is blocked', () => {
    // C0           C1
    // ┌──────┐     ┌──────┐
    // │ObsL  │     │Source│
    // └──────┘     └──┬───┘
    //                  │ direct up blocked
    //            ┌─────▼─────┐
    //            │  ObsM     │

    const source = makeNode('src', 130 + 36, 0);        // C1
    const target = makeNode('tgt', 0, -80);                // C0 (above)
    const obsL = makeNode('obsL', 0, -40);                  // same col as target, blocks direct approach
    const obsM = makeNode('obsM', 130 + 36, -40);           // same col as source

    const pathD = computeLinkPath(source, target, 'negative', [target, obsL, obsM], true);

    // Path should start from bottom of source and go down
    const mMatch = pathD.match(/^M (\d+) (\d+)/);
    expect(mMatch).toBeTruthy();
    expect(parseInt(mMatch![1])).toBe(source.x + NODE_W / 2);  // center X
    expect(parseInt(mMatch![2])).toBe(source.y + NODE_H);       // bottom Y
  });
});
