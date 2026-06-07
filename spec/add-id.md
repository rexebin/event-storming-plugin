Currently, the id of nodes are auto generated in code from their name. 
1. add optional id property to the DSL
2. when id is not provided, generate it from the name as before
3. when id is provided, use it instead of generating from the name
4. update next and altNext to:
    1. maintain current behavior i.e. it will look for the node with the same name
    2. if not found, it will look for the node with the same id

This allows user to create nodes with the same name. 