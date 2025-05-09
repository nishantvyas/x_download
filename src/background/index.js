/**
 * X Download - Background Script
 * 
 * Handles video download when triggered from the content script.
 */

console.log('X Download background script initialized');

// Default settings
let settings = {
  enabled: true,
  saveAs: false,
  downloadCount: 0
};

// Load settings on startup
chrome.storage.local.get(settings, function(items) {
  settings = items;
  console.log('Settings loaded:', settings);
});

// Native messaging host connection
let nativePort = null;
let currentDownloadTabId = null; // Store the tab ID of the requesting tab

function connectToNativeHost() {
  try {
    nativePort = chrome.runtime.connectNative('com.x_download.downloader');
    
    nativePort.onMessage.addListener((response) => {
      console.log('Received from native host:', response);
      if (!currentDownloadTabId) {
        console.warn('Received native host message but no tab ID is stored.');
        return;
      }

      const targetTabId = currentDownloadTabId;
      currentDownloadTabId = null; // Reset for next download

      const messageType = response.success ? 'DOWNLOAD_COMPLETE' : 'DOWNLOAD_FAILED';
      
      chrome.tabs.sendMessage(targetTabId, {
        type: messageType,
        data: response
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log(`Could not send ${messageType} to tab ${targetTabId}: ${chrome.runtime.lastError.message}`);
        }
      });
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('Disconnected from native host');
      if (chrome.runtime.lastError) {
        console.error('Native host disconnect error:', chrome.runtime.lastError.message);
      }
      // If we disconnect unexpectedly during a download, notify the tab
      if (currentDownloadTabId) {
        const targetTabId = currentDownloadTabId;
        currentDownloadTabId = null;
        chrome.tabs.sendMessage(targetTabId, {
          type: 'DOWNLOAD_FAILED',
          data: { success: false, error: 'Native host disconnected unexpectedly.' }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log(`Could not send disconnect failure to tab ${targetTabId}: ${chrome.runtime.lastError.message}`);
          }
        });
      }
      nativePort = null;
    });
  } catch (error) {
    console.error('Failed to connect to native host:', error);
    // Notify the requesting tab if connection fails immediately
    if (currentDownloadTabId) {
        const targetTabId = currentDownloadTabId;
        currentDownloadTabId = null;
        chrome.tabs.sendMessage(targetTabId, {
            type: 'DOWNLOAD_FAILED',
            data: { success: false, error: 'Failed to connect to native host.' }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log(`Could not send connection failure to tab ${targetTabId}: ${chrome.runtime.lastError.message}`);
          }
        });
    }
    nativePort = null;
  }
}

// Connect to native host when extension starts
connectToNativeHost();

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request, 'from tab:', sender.tab?.id);
  
  if (request.type === 'DOWNLOAD_VIDEO') {
    if (!sender.tab) {
        console.error('Download request received without sender tab information.');
        sendResponse({ status: 'error', message: 'Missing sender tab info.' });
        return false; // Indicate async response not needed
    }

    if (currentDownloadTabId) {
        // Handle case where a download is already in progress
        sendResponse({ status: 'error', message: 'Another download is already in progress.' });
        return false; 
    }

    currentDownloadTabId = sender.tab.id; // Store the requesting tab ID

    if (!nativePort) {
      console.log('Native port not connected, attempting to connect...');
      connectToNativeHost(); // This will try to send failure back if it fails
    }
    
    if (nativePort) {
      console.log(`Sending URL ${request.url} to native host for tab ${currentDownloadTabId}`);
      nativePort.postMessage({ url: request.url });
      sendResponse({ status: 'started' }); 
    } else {
      // connectToNativeHost likely already sent a failure message, but reset tabId
      currentDownloadTabId = null; 
      sendResponse({ status: 'error', message: 'Native host connection failed.' });
    }
    // Keep the message channel open for the async response from native host
    return true; 
  }
  
  if (request.action === 'settingsUpdated') {
    // Update settings
    settings = request.settings;
    console.log('Settings updated:', settings);
  }

  if (request.action === 'incrementDownloadCount') {
    // Increment download counter when using native download button
    incrementDownloadCount();
  }

  // Return false for synchronous messages or if sendResponse wasn't called
  return false;
});

/**
 * Handle video download
 * @param {string} videoUrl - URL of the video to download
 * @param {function} sendResponse - Function to send response back to content script
 */
async function handleVideoDownload(videoUrl, sendResponse) {
  console.log('Processing video download:', videoUrl);
  
  try {
    // Check if downloads are enabled
    if (!settings.enabled) {
      throw new Error('Downloads are disabled in settings');
    }
    
    // Extract filename from URL
    const filename = generateFilename(videoUrl);
    
    // Try to download the video with retries
    try {
      // First attempt with original URL
      const downloadId = await downloadVideo(videoUrl, filename, settings.saveAs);
      incrementDownloadCount();
      sendResponse({ success: true, downloadId });
    } catch (error) {
      console.log('First download attempt failed, trying with modified URL...');
      
      // If original URL failed, try with modified URL
      // Sometimes Twitter's video URLs need adjustments
      const modifiedUrl = modifyVideoUrl(videoUrl);
      
      if (modifiedUrl !== videoUrl) {
        try {
          const downloadId = await downloadVideo(modifiedUrl, filename, settings.saveAs);
          incrementDownloadCount();
          sendResponse({ success: true, downloadId });
        } catch (secondError) {
          // If both attempts fail, try fetching the video content directly
          console.log('Modified URL failed too, trying direct fetch...');
          try {
            const downloadId = await fetchAndDownloadVideo(videoUrl, filename, settings.saveAs);
            incrementDownloadCount();
            sendResponse({ success: true, downloadId });
          } catch (fetchError) {
            throw new Error(`All download methods failed: ${fetchError.message}`);
          }
        }
      } else {
        // If URL couldn't be modified, try direct fetch as last resort
        const downloadId = await fetchAndDownloadVideo(videoUrl, filename, settings.saveAs);
        incrementDownloadCount();
        sendResponse({ success: true, downloadId });
      }
    }
  } catch (error) {
    console.error('Error downloading video:', error);
    
    // Send error response
    sendResponse({ 
      success: false, 
      error: error.message || 'Unknown error' 
    });
  }
}

/**
 * Modify video URL to try alternative formats
 * @param {string} url - Original video URL
 * @returns {string} Modified URL
 */
function modifyVideoUrl(url) {
  let modifiedUrl = url;
  
  try {
    // Parse the URL
    const urlObj = new URL(url);
    
    // Check if it's a twimg.com URL
    if (urlObj.hostname.includes('twimg.com')) {
      // Try without the query parameters
      if (urlObj.search) {
        urlObj.search = '';
        modifiedUrl = urlObj.toString();
      }
      
      // Check for specific URL patterns and modify accordingly
      if (url.includes('ext_tw_video')) {
        // Remove the tag parameter if present
        if (url.includes('?tag=')) {
          modifiedUrl = url.split('?tag=')[0];
        }
      }
    }
  } catch (e) {
    console.error('Error modifying URL:', e);
    // Return original URL if parsing fails
    return url;
  }
  
  return modifiedUrl;
}

/**
 * Fetch video content directly and save as a download
 * @param {string} url - Video URL
 * @param {string} filename - Name for the downloaded file
 * @param {boolean} saveAs - Whether to show the save dialog
 * @returns {Promise} Promise that resolves when download is complete
 */
async function fetchAndDownloadVideo(url, filename, saveAs) {
  try {
    // Fetch the video content
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-cache',
      headers: {
        'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }
    
    // Get the video blob
    const blob = await response.blob();
    
    // Create a blob URL
    const blobUrl = URL.createObjectURL(blob);
    
    // Download using the blob URL
    const downloadId = await downloadVideo(blobUrl, filename, saveAs);
    
    // Clean up the blob URL after download starts
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60000); // Clean up after 1 minute
    
    return downloadId;
  } catch (error) {
    console.error('Error in fetchAndDownloadVideo:', error);
    throw error;
  }
}

/**
 * Generate a filename for the downloaded video
 * @param {string} url - Video URL
 * @returns {string} Generated filename
 */
function generateFilename(url) {
  // Extract video ID from URL if possible
  let videoId = '';
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    videoId = pathParts[pathParts.length - 1] || '';
    
    // If the video ID contains a file extension, use that as the filename
    if (videoId.includes('.mp4') || videoId.includes('.mov')) {
      return videoId;
    }
  } catch (e) {
    // If URL parsing fails, use a fallback
    videoId = Math.random().toString(36).substring(2, 10);
  }
  
  // Generate timestamp
  const date = new Date();
  const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  
  // Construct filename
  return `x_video_${timestamp}_${videoId}.mp4`;
}

/**
 * Download a video file
 * @param {string} url - Video URL
 * @param {string} filename - Name for the downloaded file
 * @param {boolean} saveAs - Whether to show the save dialog
 * @returns {Promise} Promise that resolves when download is complete
 */
function downloadVideo(url, filename, saveAs) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: saveAs
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (downloadId === undefined) {
        reject(new Error('Download failed'));
      } else {
        resolve(downloadId);
      }
    });
  });
}

/**
 * Increment the download counter in storage
 */
function incrementDownloadCount() {
  chrome.storage.local.get({ downloadCount: 0 }, function(items) {
    const newCount = items.downloadCount + 1;
    chrome.storage.local.set({ downloadCount: newCount });
    
    // Update local settings
    settings.downloadCount = newCount;
  });
}