1. When "next" property is not matched, it should NOT create implicit error node. implicitly create error node should only happen for "altNext" that is not matched.
2. if "next" property is specified but not matched, ignore.
3. if "next" property is specified as ""(empty string), it means the node doesn't have next node.