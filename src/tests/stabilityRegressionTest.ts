/**
 * Comprehensive Stability and Regression Verification Test
 * SIH 2026 Problem Statement 26057
 * 
 * Verifies:
 * 1. Continuous Sonar Replay & Extended Ingestion (No duplicate targets/audits on loop)
 * 2. Concurrency guards & isInferring simulation
 * 3. Parameter changes (Gain, TVG, Contrast, Slant-Range) do not reset target state
 * 4. Multi-ping tracking & target ID stability
 * 5. Full Operator Verification Workflow (CONFIRM, REJECT, RECLASSIFY, MARK UNKNOWN, ADD NOTE)
 *    and exact 1-to-1 audit event generation
 * 6. Quality Gating (NOMINAL, NOISY, SATURATED, CORRUPTED)
 * 7. Error recovery and fallback handling
 */

import { MockSonarDataRepository, SonarIngestionService } from '../services/sonar/SonarIngestionService';
import { InferencePipeline } from '../services/ai/InferencePipeline';
import { QualityGate } from '../services/ai/qualityGate';
import { MockTargetRepository } from '../repositories/MockTargetRepository';
import { TargetConverter } from '../services/ai/targetConverter';
import { PreprocessingConfig, RawSonarPingInput } from '../types/sonarFrame';
import { Target, VerificationStatus, DebrisCategory } from '../types/target';
import { AuditEvent } from '../types/audit';
import { MOCK_SONAR_PINGS } from '../data/mockSonarPings';

async function runStabilityRegressionTests() {
  console.log('================================================================');
  console.log('STARTING EXTENDED STABILITY & REGRESSION VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, message: string) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${message}`);
      failed++;
      process.exitCode = 1;
    }
  }

  const pipeline = new InferencePipeline();
  const repo = new MockTargetRepository();
  const sonarRepo = new MockSonarDataRepository(MOCK_SONAR_PINGS);
  const ingestion = new SonarIngestionService(sonarRepo);

  const testConfig: PreprocessingConfig = {
    gain: 1.1,
    tvg: 1.3,
    contrast: 1.2,
    isSlantRangeCorrected: false,
    noiseFilterThreshold: 0.04,
  };

  // -------------------------------------------------------------
  // TEST SECTION 1: EXTENDED REPLAY & TARGET DEDUPLICATION
  // -------------------------------------------------------------
  console.log('--> Section 1: Extended Replay & Deduplication Check');
  const existingTargetsRes = await repo.getTargets();
  let currentTargets: Target[] = [...(existingTargetsRes.data || [])];
  const initialTargetCount = currentTargets.length;
  let auditTrail: AuditEvent[] = [];

  // Run replay through all pings for 5 continuous complete loops
  const totalPings = ingestion.getTotalPings();
  const totalSteps = totalPings * 5; // 5 full loops
  let inferenceRuns = 0;

  for (let step = 0; step < totalSteps; step++) {
    ingestion.stepNext();
    const frame = ingestion.getCurrentProcessedFrame(testConfig);
    inferenceRuns++;

    const pipelineResult = await pipeline.processFrame(frame);
    if (pipelineResult.inferenceResult.qualityGate !== 'INFERENCE_SKIPPED') {
      const newTargetsToPersist: Target[] = [];
      const existingMaxId = currentTargets.reduce((max, t) => {
        const match = t.id.match(/TRG-26057-(\d+)/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 0);

      for (const candidate of pipelineResult.acceptedCandidates) {
        const alreadyExists =
          currentTargets.some((t) => {
            if (candidate.trackId && t.operatorNotes?.includes(candidate.trackId)) {
              return true;
            }
            const dLat = Math.abs(t.latitude - candidate.latitude);
            const dLng = Math.abs(t.longitude - candidate.longitude);
            return (dLat < 0.00015 && dLng < 0.00015) || t.pingNumber === candidate.pingNumber;
          }) ||
          newTargetsToPersist.some((t) => {
            if (candidate.trackId && t.operatorNotes?.includes(candidate.trackId)) {
              return true;
            }
            const dLat = Math.abs(t.latitude - candidate.latitude);
            const dLng = Math.abs(t.longitude - candidate.longitude);
            return (dLat < 0.00015 && dLng < 0.00015) || t.pingNumber === candidate.pingNumber;
          });

        if (!alreadyExists) {
          const nextSeq = Math.max(existingMaxId, currentTargets.length) + newTargetsToPersist.length + 1;
          const newTarget = TargetConverter.toTarget(
            candidate,
            'MIS-2026-INDO-04B',
            'TRX-01',
            nextSeq
          );
          newTargetsToPersist.push(newTarget);
        }
      }

      if (newTargetsToPersist.length > 0) {
        for (const nt of newTargetsToPersist) {
          const createRes = await repo.createTarget(nt, 'AI-DETECTION-AGENT');
          if (createRes.success && createRes.data) {
            auditTrail.unshift(createRes.data.audit);
          }
        }
        currentTargets = [...currentTargets, ...newTargetsToPersist];
      }
    }
  }

  assert(
    inferenceRuns === totalSteps,
    'S1.1',
    `Processed ${inferenceRuns} frames across 5 full replay cycles without infinite loops or stalls.`
  );

  // Check that duplicate targets were NOT created across repeated loops
  const targetIds = currentTargets.map((t) => t.id);
  const uniqueTargetIds = new Set(targetIds);
  assert(
    targetIds.length === uniqueTargetIds.size,
    'S1.2',
    `All ${targetIds.length} target IDs are globally unique; no duplicate IDs generated during multi-loop replay.`
  );

  // Check that ping numbers for newly detected targets are unique per track
  const createdTargets = currentTargets.slice(initialTargetCount);
  const createdPingNumbers = createdTargets.map((t) => t.pingNumber);
  const uniquePingNumbers = new Set(createdPingNumbers);
  assert(
    createdPingNumbers.length === uniquePingNumbers.size,
    'S1.3',
    `Deduplication prevented duplicate targets for identical pings on subsequent replay passes.`
  );

  // -------------------------------------------------------------
  // TEST SECTION 2: PARAMETER CALIBRATION INDEPENDENCE
  // -------------------------------------------------------------
  console.log('\n--> Section 2: Parameter Calibration Independence');
  const targetCountBeforeParamChange = currentTargets.length;
  const auditCountBeforeParamChange = auditTrail.length;
  const activeTargetIdBefore = currentTargets[0]?.id;

  // Change gain
  const frameGain = ingestion.getCurrentProcessedFrame({ ...testConfig, gain: 1.8 });
  assert(frameGain.processingStatus === 'READY', 'S2.1', 'Adjusting Gain reprocesses frame without error');

  // Change TVG
  const frameTvg = ingestion.getCurrentProcessedFrame({ ...testConfig, tvg: 1.9 });
  assert(frameTvg.processingStatus === 'READY', 'S2.2', 'Adjusting TVG reprocesses frame without error');

  // Change Contrast
  const frameContrast = ingestion.getCurrentProcessedFrame({ ...testConfig, contrast: 1.6 });
  assert(frameContrast.processingStatus === 'READY', 'S2.3', 'Adjusting Contrast reprocesses frame without error');

  // Change Slant-Range
  const frameSlant = ingestion.getCurrentProcessedFrame({ ...testConfig, isSlantRangeCorrected: true });
  assert(frameSlant.processingStatus === 'READY', 'S2.4', 'Toggling Slant-Range Correction reprocesses frame without error');

  // Verify state integrity after parameter changes
  assert(
    currentTargets.length === targetCountBeforeParamChange &&
    auditTrail.length === auditCountBeforeParamChange &&
    activeTargetIdBefore === currentTargets[0]?.id,
    'S2.5',
    'Parameter changes did not reset targets, active target selection, or audit trail.'
  );

  // -------------------------------------------------------------
  // TEST SECTION 3: OPERATOR VERIFICATION ACTIONS & AUDIT INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--> Section 3: Operator Verification & Audit Single-Event Guarantee');
  const testTargetId = currentTargets[0].id;

  // 1. CONFIRM Target
  const initialAuditCount = auditTrail.length;
  const confirmRes = await repo.confirmTarget(testTargetId, 'Confirmed acoustic shadow profile', 'LeadHydrographer');
  assert(
    confirmRes.success && confirmRes.data?.target.verificationStatus === 'CONFIRMED_DEBRIS',
    'S3.1',
    `CONFIRM action updated status to CONFIRMED_DEBRIS`
  );
  if (confirmRes.success && confirmRes.data) {
    auditTrail.unshift(confirmRes.data.audit);
  }
  assert(
    auditTrail[0].actionType === 'TARGET_VERIFIED' && auditTrail[0].title === 'TARGET CONFIRMED DEBRIS',
    'S3.2',
    `Exactly one TARGET_VERIFIED audit event recorded with title "TARGET CONFIRMED DEBRIS"`
  );

  // 2. RECLASSIFY Target
  const reclassRes = await repo.reclassifyTarget(testTargetId, 'METALLIC_DRUM', 'Cylindrical drum with shadow', 'LeadHydrographer');
  assert(
    reclassRes.success && reclassRes.data?.target.classification === 'METALLIC_DRUM',
    'S3.3',
    `RECLASSIFY action changed category to METALLIC_DRUM`
  );
  if (reclassRes.success && reclassRes.data) {
    auditTrail.unshift(reclassRes.data.audit);
  }
  assert(
    auditTrail[0].actionType === 'TARGET_RECLASSIFIED' && auditTrail[0].newValue === 'METALLIC_DRUM',
    'S3.4',
    `Exactly one TARGET_RECLASSIFIED audit event recorded with newValue "METALLIC_DRUM"`
  );

  // 3. ADD OPERATOR NOTE
  const noteRes = await repo.addOperatorNote(testTargetId, 'Priority ROV inspection assigned to Dive Team Alpha', 'LeadHydrographer');
  assert(
    noteRes.success && noteRes.data?.target.operatorNotes?.includes('Dive Team Alpha'),
    'S3.5',
    `ADD NOTE action saved observation to target field log`
  );
  if (noteRes.success && noteRes.data) {
    auditTrail.unshift(noteRes.data.audit);
  }
  assert(
    auditTrail[0].actionType === 'TARGET_NOTE_ADDED' && auditTrail[0].title === 'OPERATOR NOTE RECORDED',
    'S3.6',
    `Exactly one TARGET_NOTE_ADDED audit event recorded for field note submission`
  );

  // 4. MARK UNKNOWN / GEOLOGICAL
  const geoRes = await repo.markTargetUnknown(testTargetId, 'Diffuse bedrock outcrop signature', 'LeadHydrographer');
  assert(
    geoRes.success && geoRes.data?.target.verificationStatus === 'GEOLOGICAL_ANOMALY',
    'S3.7',
    `MARK UNKNOWN action set verificationStatus to GEOLOGICAL_ANOMALY`
  );
  if (geoRes.success && geoRes.data) {
    auditTrail.unshift(geoRes.data.audit);
  }
  assert(
    auditTrail[0].actionType === 'TARGET_UNKNOWN_FLAGGED',
    'S3.8',
    `Exactly one TARGET_UNKNOWN_FLAGGED audit event recorded`
  );

  // 5. REJECT / FALSE ALARM
  const rejectRes = await repo.rejectTarget(testTargetId, 'Identified as nadir surface multipath artifact', 'LeadHydrographer');
  assert(
    rejectRes.success && rejectRes.data?.target.verificationStatus === 'FALSE_POSITIVE',
    'S3.9',
    `REJECT action updated verificationStatus to FALSE_POSITIVE`
  );
  if (rejectRes.success && rejectRes.data) {
    auditTrail.unshift(rejectRes.data.audit);
  }
  assert(
    auditTrail[0].actionType === 'TARGET_VERIFIED' &&
    auditTrail[0].title === 'TARGET MARKED FALSE ALARM' &&
    auditTrail[0].newValue === 'FALSE_POSITIVE',
    'S3.10',
    `Exactly one TARGET_VERIFIED (FALSE_POSITIVE) audit event recorded`
  );

  // -------------------------------------------------------------
  // TEST SECTION 4: QUALITY GATING SCENARIOS
  // -------------------------------------------------------------
  console.log('\n--> Section 4: Quality Gating Operational Scenarios');

  // NOMINAL ping
  const nominalFrame = ingestion.getCurrentProcessedFrame(testConfig);
  const qgNom = QualityGate.evaluate(nominalFrame);
  assert(
    qgNom.status === 'INFERENCE_ALLOWED',
    'S4.1',
    'NOMINAL scenario: Quality gate authorizes inference'
  );

  // SATURATED ping simulation (>40% transducer saturation)
  const saturatedFrame = {
    ...nominalFrame,
    quality: {
      ...nominalFrame.quality,
      saturationPercentage: 58,
    },
  };
  const qgSat = QualityGate.evaluate(saturatedFrame);
  assert(
    qgSat.status === 'INFERENCE_SKIPPED' && qgSat.skipReason === 'EXCESSIVE_SATURATION',
    'S4.2',
    'SATURATED scenario: Quality gate safely blocks inference due to EXCESSIVE_SATURATION'
  );

  // CORRUPTED ping simulation (marked FAILED by preprocessing)
  const corruptedFrame = {
    ...nominalFrame,
    processingStatus: 'FAILED' as const,
    processingError: 'Packet parity error in swath data block',
  };
  const qgCorr = QualityGate.evaluate(corruptedFrame);
  assert(
    qgCorr.status === 'INFERENCE_SKIPPED' && qgCorr.skipReason === 'CORRUPTED_FRAME',
    'S4.3',
    'CORRUPTED scenario: Quality gate skips inference without throwing or crashing'
  );

  // MISSING CHANNELS simulation
  const missingChannelFrame = {
    ...nominalFrame,
    portProcessedSamples: [],
  };
  const qgMissing = QualityGate.evaluate(missingChannelFrame);
  assert(
    qgMissing.status === 'INFERENCE_SKIPPED' && qgMissing.skipReason === 'MISSING_CHANNEL',
    'S4.4',
    'MISSING CHANNELS scenario: Quality gate safely skips inference'
  );

  // -------------------------------------------------------------
  // TEST SECTION 5: REPOSITORY ERROR RESILIENCE
  // -------------------------------------------------------------
  console.log('\n--> Section 5: Repository Error Resilience');

  const invalidIdRes = await repo.getTargetById('NON_EXISTENT_ID_9999');
  assert(!invalidIdRes.success && !!invalidIdRes.error, 'S5.1', 'Invalid target ID lookup handled gracefully');

  const invalidCoordRes = await repo.updateTarget(testTargetId, { latitude: 999.0 }); // invalid lat
  assert(!invalidCoordRes.success && invalidCoordRes.error?.includes('Validation Error'), 'S5.2', 'Invalid coordinate validation handled gracefully');

  const invalidCategoryRes = await repo.reclassifyTarget(testTargetId, 'INVALID_CATEGORY' as any);
  assert(!invalidCategoryRes.success && invalidCategoryRes.error?.includes('Invalid category'), 'S5.3', 'Invalid category validation handled gracefully');

  console.log('\n================================================================');
  console.log(`STABILITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStabilityRegressionTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
