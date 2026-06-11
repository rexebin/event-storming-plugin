export const sampleDSL = `<eventstorming>
  <aggregate name="Order">
    <container name="Cancel Order">
      <actor name="Customer" next="CancelOrder"/>
      <actor name="Staff" next="CancelOrder"/>
      <event name="PaymentFailed" next="CancelOrder"/>
      <command name="CancelOrder" next="Is Cancellation Allowed?"/>
      <policy name="Is Cancellation Allowed?" next="OrderCancelled" altNext="CancellationDenied"/>
      <event name="OrderCancelled"/>
      <note x="1" y="-2">Order cancellation is only allowed within 1 hour</note>
    </container>
  </aggregate>
  <projector name="OrderDetail">
    <container name="Order Detail Projection">
      <event name="OrderPlaced" next="Order Detail View"/>
      <event name="OrderCancelled" next="Order Detail View"/>
      <event name="OrderUpdated" next="Order Detail View"/>
      <event name="OrderShipped" next="Order Detail View"/>
      <projector name="Order Detail View" notes="Shows item, status and timeline">
        <note x="-2" y="-1">Projected from aggregate events</note>
      </projector>
    </container>
  </projector>
</eventstorming>`
