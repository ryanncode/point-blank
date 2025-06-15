export function withTiming<T>(func: () => T, _message: string): T {
    const start = process.hrtime.bigint();
    const result = func();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert nanoseconds to milliseconds
    return result;
}

export async function withTimingAsync<T>(func: () => Promise<T>, _message: string): Promise<T> {
    const start = process.hrtime.bigint();
    const result = await func();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert nanoseconds to milliseconds
    return result;
}