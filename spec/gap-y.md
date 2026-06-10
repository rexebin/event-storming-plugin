Currently, we have two constant NODE_GAP_Y and ALT_BRANCH_GAP to control the vertical gap between nodes.

Two values controlling the vertical gap makes the code to be more complex. 

We propose to remove ALT_BRANCH_GAP and use NODE_GAP_Y as the single source of truth for vertical gaps. We can adjust the value of NODE_GAP_Y to accommodate both regular node spacing, and alt branch spacing.

It is ok all nodes are spaced by the same vertical gap