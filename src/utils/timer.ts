/**
 * A simple utility class for measuring execution time using console.time and console.timeEnd.
 */
export class Timer {
    private label: string;

    constructor(label: string) {
        this.label = label;
    }

    /**
     * Starts the timer.
     */
    public start(): void {
        console.time(this.label);
    }

    /**
     * Stops the timer and logs the elapsed time.
     */
    public stop(): void {
        console.timeEnd(this.label);
    }
}