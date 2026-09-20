/**
 * Multi-Ping Consistency & Acoustic Track Association
 * SIH 2026 Problem Statement 26057
 * 
 * Associates consecutive sonar ping returns corresponding to the same physical
 * seabed anomaly into a single unified track (e.g. TRK-26057-009), preventing
 * multi-ping fragmentation of targets.
 */

import { CandidateDetection, MultiPingTrack } from '../../types/aiInference';

export interface AssociationResult {
  isNewTrack: boolean;
  track: MultiPingTrack;
  candidate: CandidateDetection;
}

export class MultiPingTracker {
  private activeTracks: Map<string, MultiPingTrack> = new Map();
  private trackCounter: number = 1;
  private readonly maxPingGap: number = 4; // Max pings between returns before closing track
  private readonly maxRangeDeltaMeters: number = 3.5; // Swath cross-track tolerance
  private readonly maxGeographicDistanceMeters: number = 6.0; // Along-track tolerance

  /**
   * Evaluates candidate detection against active tracks
   */
  public associate(candidate: CandidateDetection): AssociationResult {
    let matchedTrack: MultiPingTrack | null = null;
    let minDistance = Infinity;

    // Search for closest active track matching channel & spatial bounds
    for (const track of this.activeTracks.values()) {
      // Must be on the same acoustic channel (PORT or STARBOARD)
      if (track.channel !== candidate.channel) continue;

      // Ping gap must be within tolerance
      const pingGap = candidate.pingNumber - track.lastPing;
      if (pingGap < 0 || pingGap > this.maxPingGap) continue;

      // Cross-track ground range distance
      const rangeDiff = Math.abs(track.meanGroundRangeMeters - candidate.estimatedGroundRange);
      if (rangeDiff > this.maxRangeDeltaMeters) continue;

      // Geographic Euclidean distance approximation
      const geoDist = this.approximateDistanceMeters(
        track.latitude,
        track.longitude,
        candidate.latitude,
        candidate.longitude
      );

      if (geoDist > this.maxGeographicDistanceMeters) continue;

      if (geoDist < minDistance) {
        minDistance = geoDist;
        matchedTrack = track;
      }
    }

    if (matchedTrack) {
      // Update existing track
      matchedTrack.lastPing = candidate.pingNumber;
      matchedTrack.pingCount += 1;
      matchedTrack.meanGroundRangeMeters = (matchedTrack.meanGroundRangeMeters + candidate.estimatedGroundRange) / 2;
      matchedTrack.meanSlantRangeMeters = (matchedTrack.meanSlantRangeMeters + candidate.slantRange) / 2;
      matchedTrack.maxConfidence = Math.max(matchedTrack.maxConfidence, candidate.confidence);
      matchedTrack.maxEstimatedHeightMeters = Math.max(matchedTrack.maxEstimatedHeightMeters, candidate.estimatedHeight);
      matchedTrack.maxEstimatedWidthMeters = Math.max(matchedTrack.maxEstimatedWidthMeters, candidate.estimatedWidth);
      matchedTrack.totalAlongTrackLengthMeters = Math.max(
        candidate.estimatedLength,
        matchedTrack.pingCount * 0.45 // Estimated along-track ping spacing at ~3.4 kts
      );
      matchedTrack.lastSeenTimestamp = new Date().toISOString();

      candidate.trackId = matchedTrack.trackId;

      return {
        isNewTrack: false,
        track: matchedTrack,
        candidate,
      };
    }

    // Create new track
    const trackId = `TRK-26057-${String(this.trackCounter++).padStart(3, '0')}`;
    const newTrack: MultiPingTrack = {
      trackId,
      firstPing: candidate.pingNumber,
      lastPing: candidate.pingNumber,
      pingCount: 1,
      classification: candidate.classification,
      channel: candidate.channel,
      meanGroundRangeMeters: candidate.estimatedGroundRange,
      meanSlantRangeMeters: candidate.slantRange,
      totalAlongTrackLengthMeters: candidate.estimatedLength,
      maxEstimatedWidthMeters: candidate.estimatedWidth,
      maxEstimatedHeightMeters: candidate.estimatedHeight,
      maxConfidence: candidate.confidence,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      lastSeenTimestamp: new Date().toISOString(),
    };

    this.activeTracks.set(trackId, newTrack);
    candidate.trackId = trackId;

    // Prune very old tracks to maintain bounded memory
    this.pruneOldTracks(candidate.pingNumber);

    return {
      isNewTrack: true,
      track: newTrack,
      candidate,
    };
  }

  /**
   * Resets all active tracks
   */
  public reset(): void {
    this.activeTracks.clear();
    this.trackCounter = 1;
  }

  /**
   * Returns current active tracks
   */
  public getActiveTracks(): MultiPingTrack[] {
    return Array.from(this.activeTracks.values());
  }

  private pruneOldTracks(currentPing: number): void {
    if (this.activeTracks.size > 100) {
      for (const [id, track] of this.activeTracks.entries()) {
        if (currentPing - track.lastPing > 40) {
          this.activeTracks.delete(id);
        }
      }
    }
  }

  private approximateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = (lat2 - lat1) * 111139;
    const dLon = (lon2 - lon1) * 111139 * Math.cos((lat1 * Math.PI) / 180);
    return Math.sqrt(dLat * dLat + dLon * dLon);
  }
}
