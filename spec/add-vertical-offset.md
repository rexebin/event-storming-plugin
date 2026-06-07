1. offset property in the DSL currently move the node to the right by the specified amount, with its children.
1. update the offset behavior: 
    1. when offset is positive integer, move the node to the right by that amount with its children
    2. when offset is negative integer, move the node down by the absolute value of that amount, with its children
1. when moving the node down, ensure all of its child and grandchild nodes are also moved down by the same amount to maintain the structure of the graph
1. only top row nodes can move right and they cannot move down.
1. rows below the top row can only move down and cannot move right.
We want to change this behavior so that it moves the node down instead of to the right.