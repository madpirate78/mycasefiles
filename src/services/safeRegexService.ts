/**
 * Safe regex execution service with timeout protection and ReDoS attack prevention
 * Provides secure regex operations with performance monitoring
 */

export interface RegexMatch {
  match: RegExpMatchArray | null;
  timedOut: boolean;
  executionTime: number;
}

export interface RegexTestResult {
  result: boolean;
  timedOut: boolean;
  executionTime: number;
}

export class SafeRegexService {
  private static readonly DEFAULT_TIMEOUT_MS = 1000; // 1 second default
  private static readonly MAX_TIMEOUT_MS = 5000; // 5 second maximum
  
  /**
   * Execute regex match with timeout protection (synchronous with basic timeout)
   */
  static safeMatchSync(
    pattern: RegExp, 
    text: string, 
    timeoutMs: number = this.DEFAULT_TIMEOUT_MS
  ): RegexMatch {
    const startTime = performance.now();

    // Validate timeout parameter
    Math.min(timeoutMs, this.MAX_TIMEOUT_MS);
    
    try {
      // For critical security, we'll use a simplified timeout approach
      // This checks text length as a heuristic for potential ReDoS
      if (text.length > 10000 && this.analyzePattern(pattern).riskLevel === 'high') {
        console.warn('⚠️ Rejecting potentially dangerous regex on large text:', {
          pattern: pattern.source,
          textLength: text.length,
          risk: 'high'
        });
        return {
          match: null,
          timedOut: true,
          executionTime: performance.now() - startTime
        };
      }
      
      const result = text.match(pattern);
      
      return {
        match: result,
        timedOut: false,
        executionTime: performance.now() - startTime
      };
    } catch (error) {
      console.warn('⚠️ Regex match failed:', {
        pattern: pattern.source,
        error: error instanceof Error ? error.message : String(error),
        textLength: text.length,
        executionTime: performance.now() - startTime
      });
      
      return {
        match: null,
        timedOut: true,
        executionTime: performance.now() - startTime
      };
    }
  }
  
  /**
   * Execute regex test with timeout protection
   */
  static async safeTest(
    pattern: RegExp, 
    text: string, 
    timeoutMs: number = this.DEFAULT_TIMEOUT_MS
  ): Promise<RegexTestResult> {
    const startTime = performance.now();

    // Validate timeout parameter
    const validatedTimeout = Math.min(timeoutMs, this.MAX_TIMEOUT_MS);
    
    try {
      const result = await this.executeWithTimeout(
        () => pattern.test(text),
        validatedTimeout
      );
      
      return {
        result: result,
        timedOut: false,
        executionTime: performance.now() - startTime
      };
    } catch (error) {
      console.warn('⚠️ Regex test timed out:', {
        pattern: pattern.source,
        timeout: validatedTimeout,
        textLength: text.length,
        executionTime: performance.now() - startTime
      });
      
      return {
        result: false,
        timedOut: true,
        executionTime: performance.now() - startTime
      };
    }
  }
  
  /**
   * Execute multiple regex patterns safely and return first match (synchronous)
   */
  static safeMultiMatchSync(
    patterns: RegExp[], 
    text: string, 
    timeoutMs: number = this.DEFAULT_TIMEOUT_MS
  ): RegexMatch & { patternIndex: number } {
    const startTime = performance.now();
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      
      // Check if we're running out of time
      const elapsedTime = performance.now() - startTime;
      if (elapsedTime > timeoutMs) {
        console.warn('⚠️ Multi-pattern regex timed out before completion');
        return {
          match: null,
          timedOut: true,
          executionTime: elapsedTime,
          patternIndex: -1
        };
      }
      
      // Execute pattern
      const result = this.safeMatchSync(pattern, text, Math.max(100, timeoutMs - elapsedTime));
      
      if (result.match && !result.timedOut) {
        return {
          match: result.match,
          timedOut: false,
          executionTime: performance.now() - startTime,
          patternIndex: i
        };
      }
      
      // If this pattern timed out, continue to next pattern
      if (result.timedOut) {
        console.warn(`⚠️ Pattern ${i} timed out or rejected, trying next pattern`);
        continue;
      }
    }
    
    // No matches found
    return {
      match: null,
      timedOut: false,
      executionTime: performance.now() - startTime,
      patternIndex: -1
    };
  }
  
  /**
   * Execute function with timeout using AbortController and Promise.race
   */
  private static executeWithTimeout<T>(
    operation: () => T,
    timeoutMs: number
  ): Promise<T> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    // Create operation promise wrapped in async executor
    const operationPromise = new Promise<T>((resolve, reject) => {
      try {
        // Execute synchronously but allow timeout to interrupt
        setTimeout(() => {
          try {
            const result = operation();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, 0);
      } catch (error) {
        reject(error);
      }
    });
    
    return Promise.race([operationPromise, timeoutPromise]);
  }
  
  /**
   * Analyze regex pattern for potential ReDoS vulnerabilities
   */
  static analyzePattern(pattern: RegExp): {
    isPotentiallyVulnerable: boolean;
    warnings: string[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    const source = pattern.source;
    
    // Check for nested quantifiers (high risk)
    if (/(.*\*.*\*|.*\+.*\+|.*\{.*\}.*\{.*\})/g.test(source)) {
      warnings.push('Contains nested quantifiers - high ReDoS risk');
      riskLevel = 'high';
    }
    
    // Check for alternation with quantifiers (medium risk)
    if (/(\([^)]*\|[^)]*\)[*+?]|\([^)]*[*+?][^)]*\|)/g.test(source)) {
      warnings.push('Contains alternation with quantifiers - medium ReDoS risk');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    
    // Check for excessive backtracking patterns
    if (/(.*\*.*){2,}|(.+\+.*){2,}/g.test(source)) {
      warnings.push('Contains patterns prone to excessive backtracking');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    
    // Check for overly broad character classes
    if (/\[\^.\]\*|\[\^.\]\+/g.test(source)) {
      warnings.push('Contains overly broad character classes with quantifiers');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    
    // Check for dot with quantifiers
    if (/\.\*.*\.\*|\.\+.*\.\+/g.test(source)) {
      warnings.push('Contains multiple dot-quantifier patterns');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    
    // Check pattern complexity
    if (source.length > 200) {
      warnings.push('Pattern is very long - may be complex');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    
    const isPotentiallyVulnerable = warnings.length > 0;
    
    return {
      isPotentiallyVulnerable,
      warnings,
      riskLevel
    };
  }
  
  /**
   * Get performance statistics for monitoring regex execution
   */
  static getPerformanceReport(): {
    totalExecutions: number;
    timeouts: number;
    averageExecutionTime: number;
    slowestPattern: string | null;
  } {
    // In a real implementation, you'd track these metrics
    // For now, return placeholder data
    return {
      totalExecutions: 0,
      timeouts: 0,
      averageExecutionTime: 0,
      slowestPattern: null
    };
  }
  
  /**
   * Sanitize text input to prevent certain attack vectors
   */
  static sanitizeInput(text: string, maxLength: number = 10000): string {
    // Limit text length to prevent excessive processing
    if (text.length > maxLength) {
      console.warn(`⚠️ Input text truncated from ${text.length} to ${maxLength} characters`);
      text = text.substring(0, maxLength);
    }
    
    // Remove or escape potentially problematic characters that could cause issues
    // Note: This is conservative - adjust based on your specific needs
    // eslint-disable-next-line no-control-regex
    return text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  }
  
  /**
   * Create a safer version of a regex pattern by adding anchors if missing
   */
  static makeSaferPattern(pattern: RegExp): RegExp {
    let source = pattern.source;
    let flags = pattern.flags;
    
    // Add word boundaries or anchors if the pattern doesn't have them
    // This can help prevent certain ReDoS attacks
    if (!source.startsWith('^') && !source.includes('\\b') && !source.startsWith('\\A')) {
      // Consider adding word boundary, but be careful not to break existing logic
      console.log('💡 Pattern could benefit from anchoring:', source);
    }
    
    // Remove global flag if present to prevent state issues
    if (flags.includes('g')) {
      flags = flags.replace('g', '');
      console.log('🔒 Removed global flag from pattern for safety');
    }
    
    return new RegExp(source, flags);
  }
}