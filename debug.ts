import {parseDSL} from './src/dsl.js';

const xml = `<eventstorming><aggregate name="Order Lifecycle">
  <container name="Place Order">
    <actor name="Customer" next="PlaceOrder" />
    <command name="PlaceOrder" />
    <event name="OrderPlaced" />
    <container name="Cancel Order Container">
      <actor name="Customer" />
      <command name="CancelOrder" />
      <event name="OrderCancelled" />
    </container>
  </container>
  <container name="Cancel Order 1 Container">
    <actor name="Customer 1" />
    <command name="CancelOrder 1" />
    <event name="OrderCancelled 1" />
  </container>
</aggregate></eventstorming>`;

const result = parseDSL(xml);
console.log('Containers:');
for (const c of result.containers) {
  console.log(`  ${c.label} id=${c.id} parentId=${c.parentId}`);
  for (const sc of c.subContainers) {
    console.log(`    subContainer: ${sc.label} id=${sc.id} parentId=${sc.parentId}`);
  }
}
console.log('Nodes count:', result.nodes.length);
for (const n of result.nodes) {
  console.log(`  ${n.label} id=${n.id} containerId=${n.containerId}`);
}
