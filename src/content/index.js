(function() {
  "use strict";
  
  /**
   * X Download - Video detection and download
   */
  
  console.log("X Download content script loaded");
  
  // Configuration
  const BUTTON_CLASS = 'x-download-button';
  const PROCESSED_ATTR = 'data-xdownload-processed';
  
  // Track processed videos to avoid duplicate buttons
  const processedVideos = new WeakSet();
  
  // Initialize on page load
  initializeExtension();
  
  /**
   * Initialize the extension
   */
  function initializeExtension() {
    console.log("Initializing X Download extension");
    
    // Initial scan for videos
    scanForVideos();
    
    // Set up MutationObserver to detect new videos
    setupVideoObserver();
  }
  
  /**
   * Set up MutationObserver to watch for newly added videos
   */
  function setupVideoObserver() {
    // Create an observer instance
    const observer = new MutationObserver((mutations) => {
      // Check if any new videos were added
      const shouldScan = mutations.some(mutation => {
        return mutation.addedNodes.length > 0;
      });
      
      if (shouldScan) {
        // Debounce the scan function to avoid excessive processing
        debounce(scanForVideos, 500)();
      }
    });
    
    // Start observing the document
    observer.observe(document.body, {
      childList: true, 
      subtree: true
    });
  }
  
  /**
   * Scan the page for videos and add download buttons
   */
  function scanForVideos() {
    // Find all video elements on X/Twitter
    const videoContainers = findVideoContainers();
    
    // Process each video container
    videoContainers.forEach(container => {
      // Skip already processed containers
      if (container.hasAttribute(PROCESSED_ATTR) || processedVideos.has(container)) {
        return;
      }
      
      // Mark as processed
      container.setAttribute(PROCESSED_ATTR, 'true');
      processedVideos.add(container);
      
      // Add download button
      addDownloadButton(container);
    });
  }
  
  /**
   * Find video containers on the page
   * @returns {HTMLElement[]} Array of video container elements
   */
  function findVideoContainers() {
    // Find videos in tweets/posts
    const videoElements = document.querySelectorAll('video');
    const containers = [];
    
    videoElements.forEach(video => {
      // Find the tweet/post container that holds this video
      const tweetContainer = findTweetContainer(video);
      
      if (tweetContainer) {
        containers.push(tweetContainer);
      }
    });
    
    return containers;
  }
  
  /**
   * Find the tweet container for a video element
   * @param {HTMLElement} videoElement - The video element
   * @returns {HTMLElement|null} The tweet container or null if not found
   */
  function findTweetContainer(videoElement) {
    // Find the article element (tweet) containing this video
    return videoElement.closest('article');
  }
  
  /**
   * Add download button to a video container
   * @param {HTMLElement} container - The container element
   */
  function addDownloadButton(container) {
    // Create download button
    const button = createDownloadButton();
    
    // Find a good place to insert the button
    const actionsBar = findActionsBar(container);
    
    if (actionsBar) {
      // Insert button in the actions bar
      actionsBar.appendChild(button);
    } else {
      // If actions bar not found, insert button directly in container
      container.appendChild(button);
    }
  }
  
  /**
   * Find the actions bar in a tweet
   * @param {HTMLElement} container - The tweet container
   * @returns {HTMLElement|null} The actions bar or null if not found
   */
  function findActionsBar(container) {
    // Look for the action buttons row in the tweet
    return container.querySelector('[role="group"]');
  }
  
  /**
   * Create download button element
   * @returns {HTMLElement} The created button
   */
  function createDownloadButton() {
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = BUTTON_CLASS;
    buttonContainer.style.display = 'inline-flex';
    buttonContainer.style.alignItems = 'center';
    buttonContainer.style.marginLeft = '8px';
    buttonContainer.style.cursor = 'pointer';
    
    // Create button icon
    const icon = document.createElement('div');
    icon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 17V3"></path>
        <path d="M7 12l5 5 5-5"></path>
        <path d="M20 21H4"></path>
      </svg>
    `;
    icon.style.color = '#536471';
    
    // Add hover effect
    buttonContainer.addEventListener('mouseover', () => {
      icon.style.color = '#1d9bf0';
    });
    
    buttonContainer.addEventListener('mouseout', () => {
      icon.style.color = '#536471';
    });
    
    // Append icon to button
    buttonContainer.appendChild(icon);
    
    // Add click handler
    buttonContainer.addEventListener('click', handleDownloadClick);
    
    return buttonContainer;
  }
  
  /**
   * Handle download button click
   * @param {Event} e - Click event
   */
  function handleDownloadClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the tweet container
    const button = e.currentTarget;
    const container = button.closest('article');
    
    if (!container) {
      console.error('Could not find tweet container');
      return;
    }
    
    // Find video element
    const video = container.querySelector('video');
    
    if (!video) {
      console.error('Could not find video element');
      return;
    }
    
    // Show loading state
    showLoadingState(button);
    
    // Get video source
    const videoSrc = video.src || getVideoSource(video);
    
    if (!videoSrc) {
      showErrorState(button, 'Could not find video source');
      return;
    }
    
    // Send message to background script to initiate download
    chrome.runtime.sendMessage({
      action: 'downloadVideo',
      videoUrl: videoSrc
    }, (response) => {
      if (response && response.success) {
        showSuccessState(button);
      } else {
        showErrorState(button);
      }
    });
  }
  
  /**
   * Get video source from video element
   * @param {HTMLElement} video - The video element
   * @returns {string|null} The video source URL or null if not found
   */
  function getVideoSource(video) {
    // Try to find the source from source elements
    const source = video.querySelector('source');
    if (source && source.src) {
      return source.src;
    }
    
    // Try to extract from data attributes
    if (video.dataset.src) {
      return video.dataset.src;
    }
    
    // If both fail, return null
    return null;
  }
  
  /**
   * Show loading state on button
   * @param {HTMLElement} button - The button element
   */
  function showLoadingState(button) {
    // Save original innerHTML
    button.dataset.originalHtml = button.innerHTML;
    
    // Show spinner
    button.innerHTML = `
      <div style="width: 18px; height: 18px; border: 2px solid #1d9bf0; border-radius: 50%; border-top-color: transparent; animation: x-download-spin 1s linear infinite;"></div>
      <style>
        @keyframes x-download-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
  }
  
  /**
   * Show success state on button
   * @param {HTMLElement} button - The button element
   */
  function showSuccessState(button) {
    button.innerHTML = `
      <div style="color: #00ba7c;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"></path>
        </svg>
      </div>
    `;
    
    // Reset after delay
    setTimeout(() => {
      resetButtonState(button);
    }, 2000);
  }
  
  /**
   * Show error state on button
   * @param {HTMLElement} button - The button element
   */
  function showErrorState(button) {
    button.innerHTML = `
      <div style="color: #f4212e;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
    `;
    
    // Reset after delay
    setTimeout(() => {
      resetButtonState(button);
    }, 2000);
  }
  
  /**
   * Reset button to original state
   * @param {HTMLElement} button - The button element
   */
  function resetButtonState(button) {
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
  
  /**
   * Debounce function to limit frequency of execution
   * @param {Function} func - The function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
})(); 