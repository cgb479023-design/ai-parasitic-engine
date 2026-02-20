// Error Recovery Service for DFL System
// Handles automatic error recovery and fallback mechanisms

import { globalLogger } from './globalLogger';

interface RecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  fallbackStrategy: string;
  timeout: number;
}

type RecoveryFunction<T> = () => Promise<T>;

export interface FallbackStrategy {
  name: string;
  execute: <T>(error: Error) => Promise<T>;
}

export class ErrorRecoveryService {
  private defaultConfig: RecoveryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    fallbackStrategy: 'default',
    timeout: 30000,
  };

  private fallbackStrategies: Map<string, FallbackStrategy> = new Map();

  constructor() {
    // Register default fallback strategies
    this.registerFallbackStrategy({
      name: 'default',
      execute: async <T>(error: Error): Promise<T> => {
        globalLogger.warn('ErrorRecovery', `Using default fallback for error: ${error.message}`);
        return {} as T;
      },
    });

    this.registerFallbackStrategy({
      name: 'retryOnly',
      execute: async <T>(error: Error): Promise<T> => {
        throw new Error(`Retry failed and no fallback available: ${error.message}`);
      },
    });
  }

  /**
   * Register a custom fallback strategy
   */
  registerFallbackStrategy(strategy: FallbackStrategy): void {
    this.fallbackStrategies.set(strategy.name, strategy);
    globalLogger.info('ErrorRecovery', `Registered fallback strategy: ${strategy.name}`);
  }

  /**
   * Execute a function with retry and fallback mechanisms
   */
  async executeWithRecovery<T>(
    module: string,
    operation: string,
    fn: RecoveryFunction<T>,
    config?: Partial<RecoveryConfig>
  ): Promise<T> {
    const recoveryConfig = { ...this.defaultConfig, ...config };
    let lastError: Error | null = null;

    // Add timeout wrapper
    const executeWithTimeout = async (): Promise<T> => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${recoveryConfig.timeout}ms`));
        }, recoveryConfig.timeout);
      });

      return Promise.race([fn(), timeoutPromise]);
    };

    // Execute with retry logic
    for (let attempt = 0; attempt <= recoveryConfig.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await executeWithTimeout();
        const duration = Date.now() - startTime;
        
        globalLogger.trackPerformance(module, operation, duration, {
          attempt,
          status: 'success',
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const duration = Date.now() - startTime;
        
        if (attempt < recoveryConfig.maxRetries) {
          // Calculate backoff delay
          const delay = recoveryConfig.retryDelay * Math.pow(recoveryConfig.backoffMultiplier, attempt);
          
          globalLogger.warn(module, `Operation failed, retrying in ${delay}ms...`, {
            attempt,
            maxRetries: recoveryConfig.maxRetries,
            error: lastError.message,
            duration,
          });
          
          // Wait for backoff delay
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          globalLogger.error(module, `Operation failed after ${recoveryConfig.maxRetries + 1} attempts`, {
            error: lastError.message,
            maxRetries: recoveryConfig.maxRetries,
            duration,
          });
        }
      }
    }

    // If all retries failed, use fallback strategy
    const fallbackStrategy = this.fallbackStrategies.get(recoveryConfig.fallbackStrategy) || this.fallbackStrategies.get('default')!;
    
    try {
      globalLogger.info(module, `Using fallback strategy: ${fallbackStrategy.name}`, {
        operation,
        error: lastError?.message,
      });
      
      return await fallbackStrategy.execute<T>(lastError!);
    } catch (fallbackError) {
      globalLogger.error(module, `Fallback strategy failed`, {
        operation,
        originalError: lastError?.message,
        fallbackError: (fallbackError as Error).message,
        fallbackStrategy: fallbackStrategy.name,
      });
      
      // Re-throw if fallback also fails
      throw lastError || new Error('Unknown error occurred');
    }
  }

  /**
   * Circuit breaker implementation
   */
  createCircuitBreaker<T>(
    module: string,
    operation: string,
    fn: RecoveryFunction<T>,
    options: {
      failureThreshold: number;
      resetTimeout: number;
      recoveryConfig?: Partial<RecoveryConfig>;
    }
  ): RecoveryFunction<T> {
    let failureCount = 0;
    let circuitState: 'closed' | 'open' | 'half-open' = 'closed';
    let lastFailureTime = 0;
    let resetTimer: NodeJS.Timeout | null = null;

    const resetCircuit = () => {
      failureCount = 0;
      circuitState = 'closed';
      globalLogger.info(module, `Circuit breaker reset to closed state`, { operation });
    };

    return async () => {
      const now = Date.now();

      // Check if circuit should be reset
      if (circuitState === 'open' && now - lastFailureTime > options.resetTimeout) {
        circuitState = 'half-open';
        globalLogger.info(module, `Circuit breaker transitioning to half-open state`, { operation });
      }

      if (circuitState === 'open') {
        globalLogger.warn(module, `Circuit breaker open, rejecting request`, { operation });
        throw new Error('Circuit breaker is open');
      }

      try {
        const result = await this.executeWithRecovery(module, operation, fn, options.recoveryConfig);
        
        // Success, reset failure count if in half-open state
        if (circuitState === 'half-open') {
          resetCircuit();
        }
        
        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = now;
        
        if (circuitState === 'half-open') {
          // Half-open state failed, go back to open
          circuitState = 'open';
          globalLogger.error(module, `Circuit breaker returning to open state from half-open`, { 
            operation, 
            error: (error as Error).message 
          });
        } else if (failureCount >= options.failureThreshold) {
          // Closed state failed too many times, go to open
          circuitState = 'open';
          globalLogger.error(module, `Circuit breaker tripped to open state`, { 
            operation, 
            failureCount, 
            threshold: options.failureThreshold 
          });
          
          // Set timer to reset circuit
          if (resetTimer) clearTimeout(resetTimer);
          resetTimer = setTimeout(resetCircuit, options.resetTimeout);
        }
        
        throw error;
      }
    };
  }
}

// Export singleton instance
export const errorRecoveryService = new ErrorRecoveryService();
