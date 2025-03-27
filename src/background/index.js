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

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'downloadVideo') {
    handleVideoDownload(message.videoUrl, sendResponse);
    // Keep the message channel open for the async response
    return true;
  }
  
  if (message.action === 'settingsUpdated') {
    // Update settings
    settings = message.settings;
    console.log('Settings updated:', settings);
  }
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
    
    // Download the video
    const downloadId = await downloadVideo(videoUrl, filename, settings.saveAs);
    
    // Increment download counter
    incrementDownloadCount();
    
    // Send success response
    sendResponse({ success: true, downloadId });
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