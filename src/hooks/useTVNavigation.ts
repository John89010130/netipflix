import { useEffect, useRef, useCallback } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';

interface FocusableElement {
  element: HTMLElement;
  rect: DOMRect;
}

const FOCUSABLE_SELECTOR = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [data-focusable="true"], [data-tv-focusable]';

// Tolerance for grouping elements in the same "row" (vertical alignment)
const ROW_TOLERANCE = 60;

const getFocusableElements = (): FocusableElement[] => {
  const elements = document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  
  return Array.from(elements)
    .filter(el => {
      const style = window.getComputedStyle(el);
      // Skip elements that are hidden or disabled
      if (style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null || el.hasAttribute('disabled')) {
        return false;
      }
      // Skip elements inside data-skip-tv-nav containers UNLESS they have data-tv-focusable
      if (el.closest('[data-skip-tv-nav]') && !el.hasAttribute('data-tv-focusable')) {
        return false;
      }
      return true;
    })
    .map(element => ({
      element,
      rect: element.getBoundingClientRect()
    }));
};

// Group elements by their vertical position (row)
const groupElementsByRow = (elements: FocusableElement[]): Map<number, FocusableElement[]> => {
  const rows = new Map<number, FocusableElement[]>();
  
  elements.forEach(el => {
    const centerY = el.rect.top + el.rect.height / 2;
    
    // Find existing row within tolerance
    let foundRow = false;
    for (const [rowY, rowElements] of rows) {
      if (Math.abs(centerY - rowY) < ROW_TOLERANCE) {
        rowElements.push(el);
        foundRow = true;
        break;
      }
    }
    
    if (!foundRow) {
      rows.set(centerY, [el]);
    }
  });
  
  // Sort elements within each row by X position
  rows.forEach((rowElements) => {
    rowElements.sort((a, b) => a.rect.left - b.rect.left);
  });
  
  return rows;
};

const findNextElement = (
  current: HTMLElement,
  direction: Direction,
  elements: FocusableElement[]
): HTMLElement | null => {
  const currentRect = current.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;
  
  const rows = groupElementsByRow(elements);
  const sortedRowKeys = Array.from(rows.keys()).sort((a, b) => a - b);
  
  // Find current row
  let currentRowIndex = -1;
  let currentElementIndexInRow = -1;
  
  for (let i = 0; i < sortedRowKeys.length; i++) {
    const rowElements = rows.get(sortedRowKeys[i])!;
    const elementIndex = rowElements.findIndex(el => el.element === current);
    if (elementIndex !== -1) {
      currentRowIndex = i;
      currentElementIndexInRow = elementIndex;
      break;
    }
  }
  
  // If current element not found in rows, find closest element
  if (currentRowIndex === -1) {
    let closest: HTMLElement | null = null;
    let closestDistance = Infinity;
    
    elements.forEach(({ element, rect }) => {
      if (element === current) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.sqrt(Math.pow(centerX - currentCenterX, 2) + Math.pow(centerY - currentCenterY, 2));
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = element;
      }
    });
    
    return closest;
  }
  
  const currentRow = rows.get(sortedRowKeys[currentRowIndex])!;
  
  switch (direction) {
    case 'left': {
      // Move to previous element in same row
      if (currentElementIndexInRow > 0) {
        return currentRow[currentElementIndexInRow - 1].element;
      }
      return null;
    }
    
    case 'right': {
      // Move to next element in same row
      if (currentElementIndexInRow < currentRow.length - 1) {
        return currentRow[currentElementIndexInRow + 1].element;
      }
      return null;
    }
    
    case 'up': {
      // Move to previous row, try to maintain horizontal position
      if (currentRowIndex > 0) {
        const prevRow = rows.get(sortedRowKeys[currentRowIndex - 1])!;
        // Find element with closest X position
        let closest = prevRow[0];
        let closestDistance = Math.abs(closest.rect.left + closest.rect.width / 2 - currentCenterX);
        
        prevRow.forEach(el => {
          const elCenterX = el.rect.left + el.rect.width / 2;
          const distance = Math.abs(elCenterX - currentCenterX);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = el;
          }
        });
        
        return closest.element;
      }
      return null;
    }
    
    case 'down': {
      // Move to next row, try to maintain horizontal position
      if (currentRowIndex < sortedRowKeys.length - 1) {
        const nextRow = rows.get(sortedRowKeys[currentRowIndex + 1])!;
        // Find element with closest X position
        let closest = nextRow[0];
        let closestDistance = Math.abs(closest.rect.left + closest.rect.width / 2 - currentCenterX);
        
        nextRow.forEach(el => {
          const elCenterX = el.rect.left + el.rect.width / 2;
          const distance = Math.abs(elCenterX - currentCenterX);
          if (distance < closestDistance) {
            closestDistance = distance;
            closest = el;
          }
        });
        
        return closest.element;
      }
      return null;
    }
  }
  
  return null;
};

export const useTVNavigation = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const activeElement = document.activeElement as HTMLElement;
    
    // Handle navigation keys
    const keyDirectionMap: Record<string, Direction> = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
    };

    const direction = keyDirectionMap[e.key];
    
    if (direction) {
      // Don't interfere with input fields
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        if (direction === 'left' || direction === 'right') {
          return; // Allow normal cursor movement in inputs
        }
      }
      
      e.preventDefault();
      const elements = getFocusableElements();
      
      if (elements.length === 0) return;
      
      // If no element is focused, focus the first one
      if (!activeElement || !elements.find(e => e.element === activeElement)) {
        elements[0].element.focus();
        return;
      }
      
      const nextElement = findNextElement(activeElement, direction, elements);
      if (nextElement) {
        nextElement.focus();
        // Scroll into view if needed
        nextElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
    
    // Handle Enter/Space for activation
    if (e.key === 'Enter' || e.key === ' ') {
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
        return; // Don't interfere with form inputs
      }
      
      if (activeElement && activeElement !== document.body) {
        // Check if element already handles these keys natively
        if (activeElement.tagName === 'BUTTON' || activeElement.tagName === 'A') {
          return; // Let native behavior handle it
        }
        
        // For custom focusable elements, trigger click
        if (activeElement.getAttribute('role') === 'button' || activeElement.hasAttribute('data-focusable') || activeElement.hasAttribute('data-tv-focusable')) {
          e.preventDefault();
          activeElement.click();
        }
      }
    }
    
    // Handle Back/Escape to close modals or go back
    if (e.key === 'Escape' || e.key === 'Backspace') {
      // Find and click close button in open modal/dialog
      const closeButton = document.querySelector('[data-radix-dialog-close], [aria-label="Close"], .modal-close');
      if (closeButton instanceof HTMLElement) {
        e.preventDefault();
        closeButton.click();
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { containerRef };
};

// Global TV mode styles - subtle focus
export const tvFocusStyles = `
  /* TV Focus Ring Styles - Subtle */
  *:focus {
    outline: none !important;
  }
  
  *:focus-visible {
    outline: 2px solid hsl(var(--foreground) / 0.6) !important;
    outline-offset: 3px !important;
    border-radius: 8px;
    box-shadow: 0 0 20px hsl(var(--foreground) / 0.2) !important;
  }
  
  button:focus-visible,
  a:focus-visible,
  [role="button"]:focus-visible,
  [data-focusable="true"]:focus-visible,
  [data-tv-focusable]:focus-visible {
    transform: scale(1.03);
    transition: transform 0.2s ease-out, box-shadow 0.2s ease-out, outline 0.2s ease-out;
    z-index: 10;
    position: relative;
  }
`;
