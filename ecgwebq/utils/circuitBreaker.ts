/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures and provides fallback behavior
 */

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
      ...options
    };

    this.state = {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED'
    };
  }

  /**
   * Executes a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const currentState = this.state.state;
    
    if (currentState === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state.state = 'HALF_OPEN';
      } else {
        if (fallback) {
          console.warn('Circuit breaker OPEN, using fallback');
          return fallback();
        }
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback && this.state.state === 'OPEN') {
        console.warn('Circuit breaker OPEN after failure, using fallback');
        return fallback();
      }
      
      throw error;
    }
  }

  private onSuccess(): void {
    this.state.failures = 0;
    this.state.state = 'CLOSED';
  }

  private onFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failures >= this.options.failureThreshold) {
      this.state.state = 'OPEN';
      console.warn(`Circuit breaker OPEN after ${this.state.failures} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    return this.state.state === 'OPEN' && 
           Date.now() - this.state.lastFailureTime >= this.options.resetTimeout;
  }

  /**
   * Gets current circuit breaker state
   */
  getState(): string {
    return this.state.state;
  }

  /**
   * Gets failure count
   */
  getFailureCount(): number {
    return this.state.failures;
  }

  /**
   * Manually resets the circuit breaker
   */
  reset(): void {
    this.state = {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED'
    };
  }
}

// Global circuit breaker instances
export const s3CircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  monitoringPeriod: 10000
});
