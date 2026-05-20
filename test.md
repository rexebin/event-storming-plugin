# Test
 
 ```json
 [
   {
     "type": "Aggregate",
     "name": "Order",
     "children": [
       {
         "name": "Place Order",
         "nodes": [
           { "type": "Command", "name": "PlaceOrder" },
           { "type": "Event", "name": "OrderPlaced" }
         ]
       }
     ]
   }
 ]
 ```