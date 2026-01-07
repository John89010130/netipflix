import { useEffect, useCallback, useRef } from 'react';

interface FocusableElement {
  element: HTMLElement;
  rect: DOMRect;
}

export const useTVNavigation = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const getFocusableElements = useCallback((): FocusableElement[] => {
    const container = containerRef.current || document;
    const selector = 'button, [role="button"], a[href], [tabindex]:not([tabindex="-1"]), input, select, textarea, [data-focusable="true"]';
    const elements = container.querySelectorAll<HTMLElement>(selector);
    
    return Array.from(elements)
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               el.offsetParent !== null &&
               !el.hasAttribute('disabled');
      })
      .map(element => ({
        element,
        rect: element.getBoundingClientRect(),
      }));
  }, []);

  const findNextElement = useCallback((
    current: FocusableElement,
    direction: 'up' | 'down' | 'left' | 'right',
    elements: FocusableElement[]
  ): FocusableElement | null => {
    const { rect } = current;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let candidates = elements.filter(el => el.element !== current.element);

    // Filter by direction
    switch (direction) {
      case 'up':
        candidates = candidates.filter(el => el.rect.bottom <= rect.top + 10);
        break;
      case 'down':
        candidates = candidates.filter(el => el.rect.top >= rect.bottom - 10);
        break;
      case 'left':
        candidates = candidates.filter(el => el.rect.right <= rect.left + 10);
        break;
      case 'right':
        candidates = candidates.filter(el => el.rect.left >= rect.right - 10);
        break;
    }

    if (candidates.length === 0) return null;

    // Find closest element
    return candidates.reduce((closest, el) => {
      const elCenterX = el.rect.left + el.rect.width / 2;
      const elCenterY = el.rect.top + el.rect.height / 2;
      
      const closestCenterX = closest.rect.left + closest.rect.width / 2;
      const closestCenterY = closest.rect.top + closest.rect.height / 2;

      let elDistance: number;
      let closestDistance: number;

      if (direction === 'up' || direction === 'down') {
        // Prioritize vertical distance, then horizontal alignment
        elDistance = Math.abs(elCenterY - centerY) + Math.abs(elCenterX - centerX) * 0.5;
        closestDistance = Math.abs(closestCenterY - centerY) + Math.abs(closestCenterX - centerX) * 0.5;
      } else {
        // Prioritize horizontal distance, then vertical alignment
        elDistance = Math.abs(elCenterX - centerX) + Math.abs(elCenterY - centerY) * 0.5;
        closestDistance = Math.abs(closestCenterX - centerX) + Math.abs(closestCenterY - centerY) * 0.5;
      }

      return elDistance < closestDistance ? el : closest;
    });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key;
    
    // Map arrow keys and common TV remote keys
    const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
    };

    const direction = directionMap[key];

    if (direction) {
      e.preventDefault();
      
      const elements = getFocusableElements();
      const activeElement = document.activeElement as HTMLElement;
      
      const currentFocusable = elements.find(el => el.element === activeElement);
      
      if (!currentFocusable) {
        // Focus first element if nothing is focused
        if (elements.length > 0) {
          elements[0].element.focus();
        }
        return;
      }

      const nextElement = findNextElement(currentFocusable, direction, elements);
      if (nextElement) {
        nextElement.element.focus();
        nextElement.element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }

    // Enter key to click/activate
    if (key === 'Enter' || key === ' ') {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement !== document.body) {
        // Don't prevent default for inputs
        if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          activeElement.click();
        }
      }
    }

    // Back button (Escape or Backspace on some remotes)
    if (key === 'Escape' || key === 'Backspace') {
      // Only handle if not in an input
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        // Check for close buttons or modals
        const closeButton = document.querySelector('[data-close], [aria-label*="close"], [aria-label*="fechar"]') as HTMLElement;
        if (closeButton) {
          e.preventDefault();
          closeButton.click();
        }
      }
    }
  }, [getFocusableElements, findNextElement]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { containerRef };
};

// Global TV mode styles
export const tvFocusStyles = `
  /* TV Focus Ring Styles */
  *:focus {
    outline: none !important;
  }
  
  *:focus-visible {
    outline: 3px solid hsl(var(--primary)) !important;
    outline-offset: 2px !important;
    border-radius: 8px;
    box-shadow: 0 0 0 6px hsl(var(--primary) / 0.3) !important;
  }
  
  button:focus-visible,
  a:focus-visible,
  [role="button"]:focus-visible,
  [data-focusable="true"]:focus-visible {
    transform: scale(1.05);
    transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
    z-index: 10;
    position: relative;
  }
`;
