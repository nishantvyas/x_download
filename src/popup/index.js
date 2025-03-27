/**
 * X Download - Popup Script
 * 
 * Handles the extension popup UI and settings.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Get UI elements
  const enableToggle = document.getElementById('enable-toggle');
  const saveAsToggle = document.getElementById('save-as-toggle');
  const downloadCount = document.getElementById('download-count');
  
  // Load saved settings
  loadSettings();
  
  // Add event listeners for toggles
  enableToggle.addEventListener('change', function() {
    saveSettings({ enabled: this.checked });
  });
  
  saveAsToggle.addEventListener('change', function() {
    saveSettings({ saveAs: this.checked });
  });
  
  /**
   * Load settings from storage
   */
  function loadSettings() {
    chrome.storage.local.get({
      // Default settings
      enabled: true,
      saveAs: false,
      downloadCount: 0
    }, function(items) {
      // Update UI with saved settings
      enableToggle.checked = items.enabled;
      saveAsToggle.checked = items.saveAs;
      downloadCount.textContent = items.downloadCount;
    });
  }
  
  /**
   * Save settings to storage
   * @param {Object} settings - Settings to save
   */
  function saveSettings(settings) {
    chrome.storage.local.get({
      enabled: true,
      saveAs: false,
      downloadCount: 0
    }, function(items) {
      // Merge new settings with existing
      const updatedSettings = { ...items, ...settings };
      
      // Save to storage
      chrome.storage.local.set(updatedSettings, function() {
        // Notify background script of settings change if needed
        if ('enabled' in settings || 'saveAs' in settings) {
          chrome.runtime.sendMessage({
            action: 'settingsUpdated',
            settings: updatedSettings
          });
        }
      });
    });
  }
}); 