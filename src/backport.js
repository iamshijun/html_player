
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import 'whatwg-fetch';
import smoothscroll from 'smoothscroll-polyfill';

// Apply polyfills
smoothscroll.polyfill();

// Enhanced Promise polyfill for Safari 11
(function() {
  // Check for Promise support
  if (typeof Promise === 'undefined' || 
      typeof Promise.prototype.finally === 'undefined' ||
      typeof Promise.allSettled === 'undefined') {
    require('promise-polyfill');
    
    // Add global error handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
      console.error('Unhandled promise rejection:', event.reason);
    });
    
    // Add global error handler for promise rejections
    window.addEventListener('rejectionhandled', function(event) {
      console.warn('Handled promise rejection:', event.reason);
    });
  }
})();

// Object.values polyfill
if (!Object.values) {
  Object.values = function(obj) {
    return Object.keys(obj).map(function(key) {
      return obj[key];
    });
  };
}

// Array.includes polyfill
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(searchElement, fromIndex) {
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }
      var o = Object(this);
      var len = o.length >>> 0;
      if (len === 0) {
        return false;
      }
      var n = fromIndex | 0;
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
      while (k < len) {
        if (o[k] === searchElement) {
          return true;
        }
        k++;
      }
      return false;
    }
  });
}