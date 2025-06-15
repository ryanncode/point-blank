export function withTiming<T>(func: () => T, message: string): T {
    const start = process.hrtime.bigint();
    const result = func();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert nanoseconds to milliseconds
    console.log(`${message} completed in ${duration.toFixed(2)}ms`);
    return result;
}

export async function withTimingAsync<T>(func: () => Promise<T>, message: string): Promise<T> {
    const start = process.hrtime.bigint();
    const result = await func();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert nanoseconds to milliseconds
    console.log(`${message} completed in ${duration.toFixed(2)}ms`);
    return result;
}