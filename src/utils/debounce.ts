/**
 * Debounces a function, delaying its execution until after a specified `delay`
 * milliseconds have passed since the last time it was invoked.
 *
 * @param func The function to debounce.
 * @param delay The number of milliseconds to delay.
 * @returns A debounced version of the function.
 */
export function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
    let timeout: NodeJS.Timeout;

    return ((...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    }) as T;
}