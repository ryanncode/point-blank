/**
 * A debounced function that also includes a `cancel` method.
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void;
    cancel(): void;
}

/**
 * Creates a debounced function that delays invoking `func` until after `delay` milliseconds
 * have passed since the last time the debounced function was invoked. The debounced function
 * comes with a `cancel` method to cancel delayed `func` invocations.
 *
 * This is particularly useful for performance-sensitive operations like handling user input,
 * resizing, or scrolling, as it prevents the function from being called excessively.
 *
 * @param func The function to debounce.
 * @param delay The number of milliseconds to delay.
 * @returns A new, debounced function.
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): DebouncedFunction<T> {
    let timeout: NodeJS.Timeout | undefined;

    const debounced = (...args: Parameters<T>) => {
        // If there's a pending execution, clear it.
        if (timeout) {
            clearTimeout(timeout);
        }
        // Set a new timer to execute the function after the delay.
        timeout = setTimeout(() => {
            func(...args);
        }, delay);
    };

    /**
     * Cancels the pending debounced function invocation.
     */
    debounced.cancel = () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
    };

    return debounced;
}