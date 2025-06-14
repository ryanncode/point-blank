import { BlockNode } from '../document/blockNode';

/**
 * Finds the parent `BlockNode` that is a typed node, if one exists.
 */
export function findTypedNodeParent(node: BlockNode): BlockNode | undefined {
    if (node.isTypedNode) {
        return node;
    }
    let parent = node.parent;
    while (parent) {
        if (parent.isTypedNode) {
            return parent;
        }
        parent = parent.parent;
    }
    return undefined;
}