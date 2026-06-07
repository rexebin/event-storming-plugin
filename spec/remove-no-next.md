1. remove noNext from DSL properties
2. when next="", treat it as no next
3. when next is not set, automatically set the node's next to next eligible node in the array of nodes within the same parent
4. if there is no eligible next node, set next to null
5. update tests to reflect the changes in next handling
6. ensure that the logic for determining the next node is consistent across all relevant components and functions
7. review and refactor any code that relies on the previous noNext property to ensure it works correctly with the new next handling logic
8. update documentation to reflect the changes in how next is handled