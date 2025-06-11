import { LineNode, KeyValueProperty } from './lineNode';

export { KeyValueProperty };

/**
 * @deprecated Use LineNode instead. This interface is kept for backward compatibility
 * during the refactoring process and will be removed or repurposed later.
 */
export interface DocumentNode extends LineNode {}