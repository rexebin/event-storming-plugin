export enum NodeType {
  Aggregate = "Aggregate",
  Actor = "Actor",
  Command = "Command",
  Event = "Event",
  Query = "Query",
  Policy = "Policy",
  Error = "Error",
  ExternalSystem = "ExternalSystem",
  View = "View",
}

export enum ContainerType {
    Aggregate = "Aggregate",
    ExternalSystem = "ExternalSystem",
    ReadModel = "ReadModel",
    Process = "Process",
}

export interface Container {
    type: ContainerType;
    name: string;
    notes?: string[]; // Optional notes or comments about the container, which can provide additional context or information. 
    children: Group[];
}

export interface Group {
    name: string; // The name of the process, e.g., the name of the command, event, policy, etc.
    nodes: Node[]; // The nodes that belong to this process, which can include commands, events, policies, etc.
    notes?: string[]; // Optional notes or comments about the process, which can provide additional context or information. 
}

export interface Node {
    type: NodeType;
    name: string; // The name of the node, e.g., the name of the command, event, policy, etc.
    next?: string; // Represents the path taken when the node is executed or when the condition is met (for policies).
    negativeNext?: string; // For policies, this represents the path taken when the policy condition is not met.
    notes?: string[]; // Optional notes or comments about the node, which can provide additional context or information.    
}


var example = [{
    type: "Aggregate",
    name: "Order",
    children: [
        {
            name: "Place Order",
            nodes: [
                {
                    type: "Command",
                    name: "PlaceOrder",
                    next: "InventoryService",
                },
                {
                    type: "ExternalSystem",
                    name: "InventoryService",
                    next: "DoWeHaveStock",
                },
                {
                    type: "Policy",
                    name: "DoWeHaveStock",
                    next: "Is Order Detail Valid?",
                    negativeNext: "OutOfStock",
                },
                {
                    type: "Policy",
                    name: "Is Order Detail Valid?",
                    next: "PaymentGateway",
                    negativeNext: "InvalidOrderDetail",
                },
                {
                    type: "Error",
                    name: "InvalidOrderDetail",
                    next: "PlaceOrder",
                    notes: ["Order details are invalid, please review your order and try again."],
                },
                {
                    type: "ExternalSystem",
                    name: "PaymentGateway",
                    next: "Is Payment Successful?"
                },
                {
                    type: "Policy",
                    name: "Is Payment Successful?",
                    next: "OrderPlaced",
                    negativeNext: "PaymentFailed",
                },
                {
                    type: "Error",
                    name: "PaymentFailed",
                    next: "PlaceOrder",
                    notes: ["Payment failed, please try again or use a different payment method."],
                },
                {
                    type: "Event",
                    name: "OrderPlaced",
                    next: "SendConfirmationEmail",
                }]
        },
        {
            name: "Cancel Order",
            nodes: [
                {
                    type: "Actor",
                    name: "Customer",
                    next: "CancelOrder"
                },
                {
                    type: "Event",
                    name: "PaymentFailed",
                    next: "CancelOrder"
                },
                {
                    type: "Actor",
                    name: "Staff",
                    next: "CancelOrder"
                },
                {
                    type: "Command",
                    name: "CancelOrder",
                    next: "Is Cancellation Allowed?",
                },
                {
                    type: "Policy",
                    name: "Is Cancellation Allowed?",
                    next: "OrderCancelled",
                    negativeNext: "CancellationDenied",
                },
                {
                    type: "Event",
                    name: "OrderCancelled"
                }]
        }
    ]
},
{
    type: "ReadModel",
    name: "OrderDetail",
    children: [
        {
            name: "Order Detail Projection",
            nodes: [
                {
                    type: "Event",
                    name: "OrderPlaced",
                    next: "Order Detail View"
                },
                {
                    type: "Event",
                    name: "OrderCancelled",
                    next: "Order Detail View"
                },
                {
                    type: "Event",
                    name: "OrderUpdated",
                    next: "Order Detail View"
                },
                {
                    type: "Event",
                    name: "OrderShipped",
                    next: "Order Detail View"
                },
                {
                    type: "View",
                    name: "Order Detail View",
                    notes: ["This view is used to display the details of an order, including its status, items, and other relevant information."]
                }
            ]
        }
    ]
},
{
    type: "Process",
    name: "Customer Order View",
    children: [
        {
            name: "View Order Details",
            nodes: [
                {
                    type: "Actor",
                    name: "Customer",
                    next: "GetOrderDetails"
                },
                {
                    type: "Query",
                    name: "GetOrderDetails",
                    next: "Order Detail Projection"
                },
                {
                    type: "View",
                    name: "Order Detail Projection"
                }
            ]
        }
    ]
}
];

/**
 * Rendering
 * 1. each root container is rendered as a separate diagram
 * 2. each process within a container is rendered as a separate subgraph
 * 3. nodes are rendered according to their type, next and negativeNext properties are used to create edges between nodes to represent the flow of the process
 * 4. notes are included as annotations or comments in the diagram to provide additional context, render them as notes near the parent node
 * 5. for policies, the positive path (next) is rendered to the right of the policy node, while the negative path (negativeNext) is rendered below the policy node to visually distinguish between the two paths.
 * 6. if no negativeNext node is not provided in the array, create a default negative path that leads to an "Error" node with a message indicating that the policy condition was not met. This ensures that all policies have a defined flow for both outcomes, enhancing the clarity and completeness of the diagram.
 * 7. if negativeNext node is provided, render the provided node, if it has a next, draw the edge to the next node
 * 8. use correct colors to indicate differentiate between node types (e.g., commands, events, policies, etc.) to enhance the visual clarity of the diagram.
 * 9. ensure that the flow of the diagram is logical and easy to follow, with clear connections between nodes that represent the sequence of actions and decisions in the process.
 */