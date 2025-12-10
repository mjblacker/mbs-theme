import Alpine from 'alpinejs'

export default (tag) => ({
  alertTag: tag,
  showAlert: false,
  prefix: 'mbs_alert_',
  tagData: Alpine.$persist(0).as('mbs_alert_' + tag),

  init() {
    this.alertTag = this.prefix + this.alertTag;
    if (!this.tagData || this.tagData.tag !== this.alertTag || Date.now() > this.tagData.expires) {
      this.showAlert = true;
    }

    this.cleanupOldAlerts()
  },

  dismiss() {
    this.showAlert = false;
    const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
    this.tagData = { tag: this.alertTag, expires: expiry };
  },

  cleanupOldAlerts() {
    // console.log('Running cleanup for old alerts...');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item && item.expires && Date.now() > item.expires) {
            console.log(`Removing expired alert: ${key}`);
            localStorage.removeItem(key);
            i--; // Adjust index since we removed an item
          }
        } catch (e) {
          // If data is corrupt, remove it
          console.error('Error parsing old alert data, removing key:', key, e);
          localStorage.removeItem(key);
          i--;
        }
      }
    }
  }
})
