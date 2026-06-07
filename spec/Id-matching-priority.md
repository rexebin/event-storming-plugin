Currently, when custom Id is assigned to a node, it can still be matched by its name. 

Task: 
1. when a node has an custom id(id attribute) assigned, it should only be matched by its id, but not by its name.
1. add a prefix to custom id to avoid potential conflict with auto generated id. For example, if a user assigns an custom id "UserRegistrationFailedException" to a node, the actual id of the node should be "custom-UserRegistrationFailedException". This can ensure that the custom id will not conflict with any auto generated id which is usually in the format of "NodeType-NodeName-Index".
1. when a node's next or altNext attribute is referring to a custom id, it should use the format of "custom-UserRegistrationFailedException" instead of just "UserRegistrationFailedException". This can ensure that the node can be correctly matched by its custom id.
1. priority: when matching a node, try to match the custom id first(with implicit "custom-" prefix), if not found, then try to match the name. This can ensure that if there are nodes with same name but different custom id, they can be correctly matched by their custom id.
