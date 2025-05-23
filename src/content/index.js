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
    const videoElements = document.querySelectorAll('video');
    
    videoElements.forEach(video => {
      let container = null;
      let actionsBar = null;
      let isMediaPage = false;
      let isModal = false;

      const modalElement = video.closest('div[aria-modal="true"]');
      if (modalElement) {
        isMediaPage = true;
        isModal = true;
        container = modalElement.querySelector('article[data-testid="tweet"]');
        if (!container) container = modalElement; 
      } else if (window.location.pathname.includes('/video/')) {
        isMediaPage = true;
        container = document.querySelector('main[role="main"] article[data-testid="tweet"]');
      }

      if (!container) {
        container = video.closest('article[data-testid="tweet"]');
      }
      
      if (!container) {
        let parent = video.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
            if (parent.tagName === 'ARTICLE' && parent.getAttribute('data-testid') === 'tweet') {
                container = parent;
                break;
            }
            parent = parent.parentElement;
        }
        if (!container) {
            console.warn('X Download: Video found outside a standard tweet article structure.', video);
            container = video.closest('div[data-testid*="cellInnerDiv"]') || video.parentElement;
        }
      }
      
      if (container && (container.hasAttribute(PROCESSED_ATTR) || processedVideos.has(container))) {
        return;
      }

      if (container) {
        container.setAttribute(PROCESSED_ATTR, 'true');
        processedVideos.add(container);
        actionsBar = findActionsBar(container, isMediaPage, isModal);
        addDownloadButton(container, actionsBar, isMediaPage);
      }
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
   * @param {HTMLElement} container - The container element (tweet or media page article)
   * @param {HTMLElement|null} targetToolbar - The pre-identified actions bar (optional)
   * @param {boolean} isMediaPage - Flag if it's the media page view
   */
  function addDownloadButton(container, targetToolbar = null, isMediaPage = false) {
    const button = createDownloadButton();
    
    if (targetToolbar) {
        if (!targetToolbar.querySelector('.' + BUTTON_CLASS)) {
            const shareButton = targetToolbar.querySelector('[data-testid="share"], [data-testid="retweet"]');
            if(shareButton && shareButton.parentElement === targetToolbar) {
                 targetToolbar.insertBefore(button, shareButton.nextSibling);
            } else {
                 targetToolbar.appendChild(button);
            }
        }
    } else {
        const fallbackActions = container.querySelector('div[role="group"]');
        if (fallbackActions && !fallbackActions.querySelector('.' + BUTTON_CLASS)) {
            fallbackActions.appendChild(button);
        } else if (!container.querySelector('.' + BUTTON_CLASS)) { 
            container.appendChild(button);
        }
        console.warn(`X Download: Could not find a specific actions bar for media page: ${isMediaPage}. Container:`, container);
    }
  }
  
  /**
   * Find the actions bar in a tweet or media page
   * @param {HTMLElement} container - The tweet container or media page article
   * @param {boolean} isMediaPage - Flag if it's the media page view (modal or dedicated video page)
   * @param {boolean} isModal - Flag if it's specifically a modal view
   * @returns {HTMLElement|null} The actions bar or null if not found
   */
  function findActionsBar(container, isMediaPage, isModal) {
    let bar = null;
    if (isMediaPage) {
        if (isModal) {
            // Selector for media page (modal view)
            bar = document.querySelector('div[aria-modal="true"] div[role="group"][class*="r-1oszu61"], div[aria-modal="true"] div[role="group"][class*="r-1kbdv8c"]');
            if (bar) return bar; 
             // Fallback for different media modal structures
            bar = document.querySelector('div[aria-modal="true"] article[data-testid="tweet"] div[role="group"]');
        } else {
            // Dedicated video page (not a modal) - toolbar is usually within the main article found
            // This specific selector was provided for a media page that wasn't a modal
            bar = container.querySelector('div.css-175oi2r.r-1kbdv8c.r-18u37iz.r-1oszu61'); 
            if(bar) return bar;
            // More general selector for toolbars within the main content of a dedicated video page
             bar = container.querySelector('div[role="group"][class*="r-1kbdv8c"], div[role="group"][class*="r-1wtj0ep"]');
        }
    } else {
        // Standard tweet view on timeline
        const potentialBars = container.querySelectorAll(':scope > div > div[role="group"], :scope > div > div > div[role="group"]');
        for (const pBar of potentialBars) {
            if (pBar.querySelector('button[data-testid="reply"], button[data-testid="retweet"], button[data-testid="like"]')) {
                bar = pBar;
                break;
            }
        }
        if (!bar) bar = container.querySelector('div[role="group"][id^="id__"]'); 
        if (bar && bar.querySelectorAll('button[data-testid]').length > 0) return bar;
        if (!bar) bar = container.querySelector('div[role="group"][class*="r-1kbdv8c"], div[role="group"][class*="r-18u37iz"][class*="r-1wtj0ep"]');
    }
    
    if (bar && bar.querySelectorAll('button[data-testid]').length > 0) {
        return bar;
    }

    // Last resort: find any group with more than one button if specific selectors fail
    // If it's a media page (modal or dedicated), search the whole document for a relevant toolbar
    const searchContext = (isMediaPage && !isModal) ? document : container;
    const groups = searchContext.querySelectorAll('div[role="group"]');
    for(let group of groups) {
        if (group.querySelectorAll('button[data-testid]').length > 0 && group.offsetParent !== null) return group; // Check if visible
    }
    return null;
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
    
    const button = e.currentTarget;
    let container = button.closest('article[data-testid="tweet"]');
    const isModalView = !!button.closest('div[aria-modal="true"]');
    const isVideoPage = window.location.pathname.includes('/video/');

    if (!container || isModalView || isVideoPage) {
        if (isModalView) {
            container = document.querySelector('div[aria-modal="true"] article[data-testid="tweet"]');
        }
        if (!container && isVideoPage) { 
            container = document.querySelector('main[role="main"] article[data-testid="tweet"]');
        }
        if(!container && button.closest('div[role="group"]')){
            const toolbar = button.closest('div[role="group"]');
            if (toolbar) container = document.querySelector('article[data-testid="tweet"]'); 
        }
    }
    
    if (!container) {
      container = document.querySelector('article[data-testid="tweet"]');
    }

    if (!container) {
      showNotification('Could not find video container or tweet article', 'error');
      showErrorState(button);
      return;
    }
    
    const videoUrl = extractVideoUrl(container);
    if (!videoUrl) {
      showErrorState(button);
      showNotification('Could not find video URL from the tweet', 'error');
      return;
    }
              
    showLoadingState(button);
    downloadVideo(videoUrl, button);
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

  // Add message listener for download completion/failure
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DOWNLOAD_COMPLETE') {
      // Find active download button and show success
      const button = findActiveDownloadButton(); 
      if (button) showSuccessState(button);
      showNotification('Video downloaded successfully!', 'success');
    } else if (message.type === 'DOWNLOAD_FAILED') {
      // Find active download button and show error
      const button = findActiveDownloadButton();
      if (button) showErrorState(button);
      const errorMsg = message.data?.error || 'Unknown download error';
      showNotification(`Download failed: ${errorMsg}`, 'error');
    }
  });

  // Helper to find the button currently showing the loading state
  function findActiveDownloadButton() {
    const buttons = document.querySelectorAll('.' + BUTTON_CLASS);
    for (const button of buttons) {
      const icon = button.querySelector('div svg.spin'); // Look for the spinner
      if (icon) {
        return button;
      }
    }
    return null;
  }

  function extractVideoUrl(container) {
    // First try to get the tweet URL
    const tweetUrl = window.location.href;
    if (tweetUrl && (tweetUrl.includes('/status/') || tweetUrl.includes('/tweet/'))) {
      return tweetUrl;
    }
    
    // If we're not on a tweet page, try to find the tweet link
    const tweetLink = container.querySelector('a[href*="/status/"]');
    if (tweetLink) {
      const href = tweetLink.getAttribute('href');
      return href.startsWith('http') ? href : `https://twitter.com${href}`;
    }
    
      return null;
    }
    
  function downloadVideo(videoUrl, button) {
    console.log('Attempting to download video from URL:', videoUrl);
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_VIDEO',
      url: videoUrl
    }, (response) => {
      if (response && response.status === 'started') {
        showNotification('Download started...', 'info');
      } else {
        // Initial error (e.g., native host connection failed, download already in progress)
        showErrorState(button); 
        showNotification('Download failed: ' + (response?.message || 'Unknown error'), 'error');
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
   * Show a notification message
   * @param {string} message - The message to show
   * @param {string} type - The type of notification ('success', 'error', 'info')
   */
  function showNotification(message, type = 'info') {
    // Create notification container if it doesn't exist
    let container = document.getElementById('x-download-notifications');
    if (!container) {
      container = document.createElement('div');
      container.id = 'x-download-notifications';
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      `;
      document.body.appendChild(container);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      padding: 12px 24px;
      margin: 8px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
    `;

    // Set background color based on type
    switch (type) {
      case 'success':
        notification.style.backgroundColor = '#4caf50';
        break;
      case 'error':
        notification.style.backgroundColor = '#f44336';
        break;
      case 'info':
      default:
        notification.style.backgroundColor = '#2196f3';
        break;
    }

    notification.textContent = message;
    container.appendChild(notification);

    // Trigger animation
      setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 10);

    // Remove notification after delay
              setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        container.removeChild(notification);
        if (container.children.length === 0) {
          document.body.removeChild(container);
        }
      }, 300);
    }, 3000);
  }
  
  /**
   * Show loading state on button
   * @param {HTMLElement} button - The button element
   */
  function showLoadingState(button) {
    const icon = button.querySelector('div');
    if (icon) {
      icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
      `;
      
      // Add spin animation
      const style = document.createElement('style');
      style.textContent = `
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  /**
   * Reset button to original state
   * @param {HTMLElement} button - The button element
   */
  function resetButtonState(button) {
    const icon = button.querySelector('div');
    if (icon) {
      icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 17V3"></path>
          <path d="M7 12l5 5 5-5"></path>
          <path d="M20 21H4"></path>
        </svg>
      `;
    }
  }
  
  /**
   * Show success state on button
   * @param {HTMLElement} button - The button element
   */
  function showSuccessState(button) {
    const icon = button.querySelector('div');
    if (icon) {
      icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"></path>
        </svg>
      `;
      icon.style.color = '#4caf50';
      
      // Reset button after 2 seconds
      setTimeout(() => {
        resetButtonState(button);
        icon.style.color = '';
      }, 2000);
    }
  }
  
  /**
   * Show error state on button
   * @param {HTMLElement} button - The button element
   */
  function showErrorState(button) {
    const icon = button.querySelector('div');
    if (icon) {
      icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `;
      icon.style.color = '#f44336';
      
      // Reset button after 2 seconds
        setTimeout(() => {
        resetButtonState(button);
        icon.style.color = '';
      }, 2000);
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