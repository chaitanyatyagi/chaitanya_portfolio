// ---------------------------------------------------------------------------
// Compact authoring for DSA problem packs (docs §13.2).
//
//   dsa({ id, title, difficulty, topics, patterns, summary, description, hints,
//         explanation, signature, solution, starter?, prelude?, driver?, tests })
//
// DSA problems grade on the Python engine (shared/grader/runtime.js
// TRACK_ENGINE), so tests are function calls exactly like python packs and
// expected values are frozen into dsa/golden.json by `npm run problems:freeze`.
//
// Linked-list and tree problems can't take JSON directly, so they declare
//   prelude: 'list' | 'tree'   → ListNode / TreeNode + build/serialise helpers
//   driver:  Python source of run(...), which converts the JSON args, calls the
//            learner's function and serialises the result.
// The prelude and driver are prepended/appended to both starter and solution,
// and entry becomes `run`. `signature` is the learner's function; `runSignature`
// documents run().
// ---------------------------------------------------------------------------
export { md } from '../sql/define.js';
export { code, ex, hid } from '../python/define.js';
import { tagsFor } from './tags.js';

export const PRELUDES = {
  list: `# Provided — don't change.
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def build_list(values):
    dummy = tail = ListNode()
    for v in values:
        tail.next = ListNode(v)
        tail = tail.next
    return dummy.next

def list_values(head, limit=10000):
    out = []
    while head is not None and len(out) < limit:
        out.append(head.val)
        head = head.next
    return out
`,
  tree: `# Provided — don't change.
from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def build_tree(values):
    """Level-order list (None = missing child) → root."""
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue, i = deque([root]), 1
    while queue and i < len(values):
        node = queue.popleft()
        for side in ("left", "right"):
            if i < len(values) and values[i] is not None:
                child = TreeNode(values[i])
                setattr(node, side, child)
                queue.append(child)
            i += 1
    return root

def tree_values(root):
    """root → level-order list, trailing Nones trimmed."""
    out, queue = [], deque([root])
    while queue:
        node = queue.popleft()
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out
`,
};

export function dsa(p) {
  const prelude = p.prelude ? `${PRELUDES[p.prelude]}\n\n` : '';
  const driver = p.driver ? `\n\n# The tests call run(); don't change it.\n${p.driver.trim()}\n` : '';
  const stub = p.starter || `def ${p.signature}:\n    # Write your solution here\n    pass\n`;
  // Company tags live in ./tags.js (each with its public source).
  const tags = p.companies ? { companies: p.companies, sources: p.sources || [] } : tagsFor(p.id);
  return {
    track: 'dsa',
    roles: ['Data Engineer', 'Data Scientist'],
    domains: ['Algorithms'],
    interview: tags.companies.length > 0,
    ...p,
    ...tags,
    entry: p.driver ? 'run' : p.entry || p.signature.split('(')[0],
    signature: p.driver ? p.runSignature : p.signature,
    starter: `${prelude}${stub.trim()}\n${driver}`,
    solution: `${prelude}${p.solution.trim()}\n${driver}`,
    golden: true,
  };
}
