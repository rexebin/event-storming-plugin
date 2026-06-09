export const sampleDSL = `<eventstorming>
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
</eventstorming>`
