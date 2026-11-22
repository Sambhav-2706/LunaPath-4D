/**
 * LunaPath-4D
 * MissionLogger.js
 *
 * Member 4 - Mission Event Logger
 * Records, formats, and renders real-time telemetry events.
 */

export class MissionLogger {
  constructor(containerElement = null) {
    this.container = containerElement;
    this.entries = [];
  }

  setContainer(element) {
    this.container = element;
    this.render();
  }

  getMissionTime() {
    return new Date().toLocaleTimeString("en-GB", { hour12: false });
  }

  /**
   * Add a log entry.
   * @param {string} message
   * @param {"info"|"success"|"warning"|"hazard"} type
   */
  log(message, type = "info") {
    const entry = {
      timestamp: this.getMissionTime(),
      iso: new Date().toISOString(),
      message,
      type
    };

    this.entries.unshift(entry); // newest first in array

    if (this.container) {
      const row = document.createElement("div");
      row.className = `log-entry log-${type}`;

      const timeSpan = document.createElement("span");
      timeSpan.className = "log-time";
      timeSpan.textContent = entry.timestamp;

      const textSpan = document.createElement("span");
      let typeClass = "";
      if (type === "success") typeClass = "success-text";
      else if (type === "warning") typeClass = "warning-text";
      else if (type === "hazard") typeClass = "hazard-text";
      textSpan.className = `log-message ${typeClass}`;
      textSpan.textContent = message;

      row.append(timeSpan, textSpan);
      this.container.prepend(row);
    }

    return entry;
  }

  clear() {
    this.entries = [];
    if (this.container) {
      this.container.innerHTML = "";
    }
  }

  getEntries() {
    return [...this.entries];
  }

  exportJSON() {
    return JSON.stringify(this.entries, null, 2);
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";
    for (const entry of this.entries) {
      const row = document.createElement("div");
      row.className = `log-entry log-${entry.type}`;

      const timeSpan = document.createElement("span");
      timeSpan.className = "log-time";
      timeSpan.textContent = entry.timestamp;

      const textSpan = document.createElement("span");
      let typeClass = "";
      if (entry.type === "success") typeClass = "success-text";
      else if (entry.type === "warning") typeClass = "warning-text";
      else if (entry.type === "hazard") typeClass = "hazard-text";
      textSpan.className = `log-message ${typeClass}`;
      textSpan.textContent = entry.message;

      row.append(timeSpan, textSpan);
      this.container.append(row);
    }
  }
}
