
export class MissionTelemetry {
    constructor(missionController, autonomousMission = null) {
        if (!missionController) {
            throw new Error("MissionController is required.");
        }

        this.mission = missionController;
        this.autonomousMission = autonomousMission;

        this.snapshots = [];
        this.eventLog = [];
        this.lastRecordedEventCount = 0;
    }

    record(label = "UPDATE") {
        const missionSnapshot = this.mission.getSnapshot();

        const autonomousSnapshot = this.autonomousMission
            ? this.autonomousMission.getSnapshot()
            : null;

        const events = this.mission.getEventHistory() || [];
        const newEvents = events.slice(this.lastRecordedEventCount);

        this.lastRecordedEventCount = events.length;

        const entry = {
            sequence: this.snapshots.length + 1,
            label,
            mission: structuredClone(missionSnapshot),
            autonomous: autonomousSnapshot
                ? structuredClone(autonomousSnapshot)
                : null,
            events: structuredClone(newEvents)
        };

        this.snapshots.push(entry);

        for (const event of newEvents) {
            this.eventLog.push(structuredClone(event));
        }

        return entry;
    }

    getLatestSnapshot() {
        if (this.snapshots.length === 0) {
            return null;
        }

        return this.snapshots[this.snapshots.length - 1];
    }

    getReport() {
        const latest = this.getLatestSnapshot();

        return {
            totalSnapshots: this.snapshots.length,
            totalEvents: this.eventLog.length,
            missionStatus: latest?.mission?.status ?? "UNKNOWN",
            autonomousReplans:
                latest?.autonomous?.replanningCount ?? 0,
            hazardsHandled:
                latest?.autonomous?.hazardsHandled ?? 0,
            snapshots: structuredClone(this.snapshots),
            eventLog: structuredClone(this.eventLog)
        };
    }

    exportJSON() {
        return JSON.stringify(this.getReport(), null, 2);
    }

    clear() {
        this.snapshots = [];
        this.eventLog = [];
        this.lastRecordedEventCount = 0;
    }
}
