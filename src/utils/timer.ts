/**
 * A simple utility class for measuring execution time using console.time and console.timeEnd.
 */
export class Timer {
    private label: string;
    public static enabled: boolean = false; // Global flag to enable/disable timer output

    constructor(label: string) {
        this.label = label;
    }

    /**
     * Starts the timer.
     */
    public start(): void {
        if (Timer.enabled) {
            console.time(this.label);
        }
    }

    /**
     * Stops the timer and logs the elapsed time.
     */
    public stop(): void {
        if (Timer.enabled) {
            console.timeEnd(this.label);
        }
    }
}