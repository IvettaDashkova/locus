import type { Suite } from "./types";
import { foundationSmoke } from "./suites/foundation.smoke";
import { captureSmoke } from "./suites/capture.smoke";

/**
 * The eval registry. Each feature phase appends its suite(s) here:
 *   Capture -> schema_valid · field_coverage · conditional_ok · geo_format_ok
 *   Ask     -> recall@k · faithfulness · geo_match · refusal_correct
 *   Act     -> task_success · tool_choice · step_efficiency · no_hallucinated_tools
 *   Tracks  -> metric-vs-hand-calculated
 */
export const suites: Suite[] = [foundationSmoke, captureSmoke];
