Custom-ID nodes are excluded from aliases but still use normalizeId as fallback

When a node has [id="my-id"], it's stored as custom-my-id and never inserted into the aliases map (line 757 of collectXMLChildren). But ensureNode (line 472) does a name-based fallback lookup: if customId didn't match exactly, it falls back to canonicalizeReference(label).

Impact: A custom-ID node can still be accidentally matched by its label through the name fallback. For example, <command name="CheckOut" id="co"/> has id custom-co, but an unqualified next="CheckOut" will still resolve to it because ensureNode's fallback skips the custom-ID bypass that collectXMLChildren established for aliases. This is a subtle inconsistency between two code paths in the same file.

Severity: Minor if this is intentional (flexible matching), but likely unexpected â custom IDs were added precisely to prevent name collisions, yet the fallback re-enables them.
