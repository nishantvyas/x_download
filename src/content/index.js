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

    // Add click listener for share menu (to capture when it opens)
    document.addEventListener('click', checkForShareMenu, true);
  }

  /**
   * Check for share menu with download option
   * @param {Event} e - Click event
   */
  function checkForShareMenu(e) {
    // Give the menu time to open
    setTimeout(() => {
      // Look for download links in share menus
      const downloadLinks = document.querySelectorAll('a[download][href*="twimg.com"][href*=".mp4"]');
      downloadLinks.forEach(link => {
        // Check if this link is already processed
        if (!link.getAttribute(PROCESSED_ATTR)) {
          // Mark as processed
          link.setAttribute(PROCESSED_ATTR, 'true');
          
          // Add a click event to track downloads via native button
          link.addEventListener('click', function(e) {
            // Increment download counter in our extension
            chrome.runtime.sendMessage({
              action: 'incrementDownloadCount'
            });
          });
        }
      });
    }, 500);
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
        
        // Show loading state
        showLoadingState(button);
        
    // Try to find a native download link first
    findNativeDownloadLink(container)
      .then(nativeVideoUrl => {
        if (nativeVideoUrl) {
          // Use the native download link
          downloadVideo(button, nativeVideoUrl);
                return;
              }
              
        // If no native link, try to find the video element and extract source
        const video = container.querySelector('video');
        
        if (!video) {
          console.error('Could not find video element');
          throw new Error('No video element found');
        }
        
        // Get video URLs from all possible sources
        const videoSources = getAllVideoSources(video, container);
        
        if (videoSources.length === 0) {
          throw new Error('Could not find any video sources');
        }
        
        // Use the highest quality source (usually the last one)
        const bestSource = videoSources[videoSources.length - 1];
        console.log('Using video source:', bestSource);
        
        // Download the video
        return downloadVideo(button, bestSource);
      })
      .catch(error => {
        console.error('Error in download process:', error);
        showErrorState(button);
      });
  }

  /**
   * Find a native download link in the share menu if available
   * @param {HTMLElement} container - The tweet container
   * @returns {Promise<string|null>} Promise that resolves with the video URL from the download link or null
   */
  function findNativeDownloadLink(container) {
    return new Promise((resolve) => {
      // Try to find share button
      const shareButton = container.querySelector('[aria-label="Share post"]') || 
                         container.querySelector('[data-testid="shareButton"]');
      
      if (!shareButton) {
        // No share button found, resolve with null
        resolve(null);
        return;
      }
      
      // Save current URL for potential refresh
      const currentUrl = window.location.href;
      
      // Get share menu currently open (if any)
      const existingMenu = document.querySelector('[role="menu"]');
      
      // Click share button to open the menu
      shareButton.click();
      
      // Wait for menu to appear
      setTimeout(() => {
        // Look for download links in the document (share menu)
        const downloadLinks = document.querySelectorAll('a[download][href*="twimg.com"][href*=".mp4"]');
        
        // Store the download URL if found
        let downloadUrl = null;
        if (downloadLinks.length > 0) {
          downloadUrl = downloadLinks[0].href;
        }
        
        // Try multiple methods to close the menu
        closeShareMenu();
        
        // Resolve with the download URL
        resolve(downloadUrl);
      }, 300); // Give more time for the menu to open
    });
  }

  /**
   * Close the share menu using multiple methods
   */
  function closeShareMenu() {
    try {
      // Method 1: Click outside the menu
      document.body.click();
      
      // Method 2: Press Escape key
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true
      }));
      
      // Method 3: Find and click the close button if it exists
      const closeButton = document.querySelector('[aria-label="Close"]');
      if (closeButton) {
        closeButton.click();
      }
      
      // Method 4: Remove menu from DOM directly
      const menu = document.querySelector('[role="menu"]');
      if (menu) {
        const menuParent = menu.parentNode;
        if (menuParent && menuParent.parentNode) {
          menuParent.parentNode.removeChild(menuParent);
        }
      }
      
      // Schedule a check to see if the menu is still open
      setTimeout(() => {
        const menuStillOpen = document.querySelector('[role="menu"]');
        if (menuStillOpen) {
          console.log("Menu still open, taking more drastic action");
          // If menu still exists after all those attempts, we'll refresh the page after download
          const refreshAfterDownload = true;
          
          // Store this in local storage for use after download
          chrome.storage.local.set({ refreshAfterDownload });
        }
      }, 500);
    } catch (e) {
      console.error("Error closing share menu:", e);
    }
  }

  /**
   * Get all possible video sources from the video element and its container
   * @param {HTMLElement} video - The video element
   * @param {HTMLElement} container - The tweet container
   * @returns {string[]} Array of video source URLs
   */
  function getAllVideoSources(video, container) {
    const sources = [];
    
    // 1. Check direct src attribute
    if (video.src && video.src.includes('blob:') === false) {
      sources.push(video.src);
    }
    
    // 2. Check source elements
    const sourceElements = video.querySelectorAll('source');
    sourceElements.forEach(source => {
      if (source.src && !sources.includes(source.src)) {
        sources.push(source.src);
      }
    });
    
    // 3. Check data attributes
    for (const key in video.dataset) {
      if (key.toLowerCase().includes('src') && video.dataset[key] && !sources.includes(video.dataset[key])) {
        sources.push(video.dataset[key]);
      }
    }
    
    // 4. Look for m3u8 playlists (HLS)
    const scriptElements = document.querySelectorAll('script');
    scriptElements.forEach(script => {
      if (script.textContent) {
        const m3u8Matches = script.textContent.match(/(https:\/\/[^"'\s]+\.m3u8[^"'\s]*)/g);
        if (m3u8Matches) {
          m3u8Matches.forEach(match => {
            if (!sources.includes(match)) {
              sources.push(match);
            }
          });
        }
      }
    });
    
    // 5. Extract URLs from player data
    const playerData = extractPlayerData(container);
    if (playerData && playerData.length > 0) {
      playerData.forEach(url => {
        if (!sources.includes(url)) {
          sources.push(url);
        }
      });
    }
    
    // Filter out blob URLs and empty strings
    return sources.filter(src => src && !src.startsWith('blob:'));
  }

  /**
   * Extract player data and video URLs from tweet content
   * @param {HTMLElement} container - The tweet container
   * @returns {string[]} Array of video URLs
   */
  function extractPlayerData(container) {
    const sources = [];
    
    try {
      // Look for a video ID
      const tweetText = container.textContent;
      
      // Look for script tags with video data
      const scripts = document.querySelectorAll('script[type="application/json"]');
      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          
          // Recursively search for video URLs in the data object
          function findVideoUrls(obj) {
            if (!obj) return;
            
            if (typeof obj === 'string' && 
                (obj.includes('video.twimg.com') || obj.includes('.mp4')) && 
                !sources.includes(obj)) {
              sources.push(obj);
            } else if (typeof obj === 'object') {
              for (const key in obj) {
                // Look for video_info or variants which often contain video URLs
                if (key === 'video_info' || key === 'variants' || key === 'media_url_https' || 
                    key === 'video_url' || key === 'source' || key === 'contentUrl') {
                  findVideoUrls(obj[key]);
                } else if (Array.isArray(obj)) {
                  obj.forEach(item => findVideoUrls(item));
                } else if (typeof obj[key] === 'object' || Array.isArray(obj[key])) {
                  findVideoUrls(obj[key]);
                } else if (typeof obj[key] === 'string' && 
                          (obj[key].includes('video.twimg.com') || obj[key].includes('.mp4')) && 
                          !sources.includes(obj[key])) {
                  sources.push(obj[key]);
                }
              }
            }
          }
          
          findVideoUrls(data);
        } catch (e) {
          // Ignore JSON parse errors
        }
      });
        } catch (e) {
      console.error('Error extracting player data:', e);
    }
    
    return sources;
  }

  /**
   * Download a video using the background script
   * @param {HTMLElement} button - The button element
   * @param {string} videoUrl - URL of the video
   * @returns {Promise} Promise that resolves when download is complete
   */
  function downloadVideo(button, videoUrl) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'downloadVideo',
        videoUrl: videoUrl
      }, (response) => {
        if (response && response.success) {
          showSuccessState(button);
          
          // Check if we need to refresh the page (if share menu is stuck open)
          chrome.storage.local.get({ refreshAfterDownload: false }, (data) => {
            if (data.refreshAfterDownload) {
              // Reset the flag
              chrome.storage.local.set({ refreshAfterDownload: false });
              
              // Wait a moment for the download to start, then refresh
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }
          });
          
          resolve();
        } else {
          showErrorState(button);
          reject(new Error(response?.error || 'Download failed'));
        }
      });
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