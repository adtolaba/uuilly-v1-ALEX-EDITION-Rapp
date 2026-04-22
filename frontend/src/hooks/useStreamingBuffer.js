/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage a buffer for streaming text chunks.
 * It releases characters at a controlled pace to provide a smooth typing effect.
 * 
 * @param {Object} options - Configuration options.
 * @param {number} options.baseInterval - Base interval in ms between characters.
 * @param {number} options.burstThreshold - Buffer size threshold to trigger catch-up speed.
 * @param {number} options.maxSpeedMultiplier - Maximum speed-up factor.
 * @returns {Object} State and methods for the streaming buffer.
 */
const useStreamingBuffer = ({
  baseInterval = 30,
  burstThreshold = 10,
  maxSpeedMultiplier = 5
} = {}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isFlushing, setIsFlushing] = useState(false);
  
  const bufferRef = useRef('');
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) {
      setIsFlushing(false);
      return;
    }

    setIsFlushing(true);

    // Get the next character
    const nextChar = bufferRef.current.charAt(0);
    setDisplayedText(prev => prev + nextChar);
    bufferRef.current = bufferRef.current.slice(1);

    // Calculate next interval based on buffer size (Dynamic Catch-up)
    const bufferLength = bufferRef.current.length;
    if (bufferLength === 0) {
      setIsFlushing(false);
      return;
    }

    let multiplier = 1;
    
    if (bufferLength > burstThreshold) {
      // More aggressive exponential-like scaling
      // If threshold is 5 and we have 25 chars, (20 / 10) = 2. 
      // Multiplier becomes 1 + 2 = 3x faster.
      const excess = bufferLength - burstThreshold;
      multiplier = Math.min(maxSpeedMultiplier, 1 + (excess / 10));
    }

    const nextInterval = Math.max(5, baseInterval / multiplier);
    timerRef.current = setTimeout(flush, nextInterval);
  }, [baseInterval, burstThreshold, maxSpeedMultiplier]);

  const addChunk = useCallback((chunk) => {
    bufferRef.current += chunk;
    if (!isFlushing && bufferRef.current.length > 0) {
      setIsFlushing(true);
      timerRef.current = setTimeout(flush, baseInterval);
    }
  }, [isFlushing, flush, baseInterval]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    bufferRef.current = '';
    setDisplayedText('');
    setIsFlushing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    displayedText,
    isFlushing,
    addChunk,
    reset
  };
};

export default useStreamingBuffer;
