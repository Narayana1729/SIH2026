#!/usr/bin/env python3
"""
Scientific Test Suite: ML Probability Provenance & TreeSHAP Scope Verification
Ensures:
1. Pure model predict_proba() derivation (no hardcoded 0.95/0.92 constants).
2. Regression test on former override inputs (mining proximity & bare ground).
3. Sum of stage-2 probabilities strictly equals 1.0 within float precision.
4. TreeSHAP scope explicitly specifies Stage-1 Industrial Segregation.
"""

import os
import sys
import numpy as np
import pytest

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sri_dir = os.path.join(base_dir, "FirmsBackend/Ai-Flame-Detection/sri")
if sri_dir not in sys.path:
    sys.path.insert(0, sri_dir)

from src.hierarchical_classifier import HierarchicalThermalClassifier, CLASS_MAP
from src.feature_extractor import FeatureExtractor, FEATURE_NAMES
from src.treeshap_dp import ExactTreeSHAPExplainer
import joblib


@pytest.fixture(scope="module")
def loaded_model():
    model_path = os.path.join(base_dir, "data/processed/trained_hierarchical_model.joblib")
    if not os.path.exists(model_path):
        model_path = os.path.join(base_dir, "ml/data/trained_hierarchical_model.joblib")
    assert os.path.exists(model_path), f"Model artifact missing at {model_path}"
    return joblib.load(model_path)


@pytest.fixture(scope="module")
def feature_extractor():
    return FeatureExtractor()


def test_probability_provenance_and_ranges(loaded_model, feature_extractor):
    """Verify confidence comes strictly from predict_proba and is bounded in [0, 1]."""
    # Sample event
    feat = feature_extractor.extract_features(
        lat=22.38, lon=69.87, bright_ti4_k=365.0, bright_ti5_k=304.0, frp_mw=18.5,
        daynight='N', hist_recurrence_90d=0.92, hist_mean_frp=17.0, hist_std_frp=3.5
    )
    res = loaded_model.predict_proba_and_evidence(feat["feature_array"], feat["feature_dict"], FEATURE_NAMES)

    p_ind = res["stage1_probability"]
    raw_conf = res["raw_model_confidence"]
    conf_score = res["confidence_score"]
    stage2_probs = res["stage2_probabilities"]

    # 1. Bounds verification
    assert 0.0 <= p_ind <= 1.0, f"Stage 1 probability {p_ind} outside [0, 1]"
    assert 0.0 <= raw_conf <= 1.0, f"Raw confidence {raw_conf} outside [0, 1]"
    assert 0.0 <= conf_score <= 100.0, f"Confidence score {conf_score} outside [0, 100]"

    # 2. Mathematical relation: confidence_score == round(raw_model_confidence * 100, 1)
    assert abs(conf_score - round(raw_conf * 100.0, 1)) < 1e-5

    # 3. Stage 2 probabilities sum strictly to 1.0
    sum_stage2 = sum(stage2_probs.values())
    assert abs(sum_stage2 - 1.0) < 1e-4, f"Stage 2 probabilities do not sum to 1: {sum_stage2}"

    # 4. Confidence equals max(stage2_probs) * P(stage1_branch)
    max_stage2_p = max(stage2_probs.values())
    expected_conf = max_stage2_p * (p_ind if p_ind >= 0.5 else (1.0 - p_ind))
    assert abs(raw_conf - expected_conf) < 1e-5, f"Raw confidence {raw_conf} != expected {expected_conf}"


def test_former_override_inputs_use_pure_ml(loaded_model, feature_extractor):
    """
    CRITICAL REGRESSION TEST:
    Explicitly test inputs that triggered the old hardcoded overrides:
    1. dist_to_mine_km < 30.0 and recurrence_90d > 0.40 (previously hardcoded to Class 4 with 0.95)
    2. bare_fraction > 0.08, frp_mw < 10.0, recurrence_90d < 0.1 (previously hardcoded to Class 5 with 0.92)
    Verify that:
    - No hardcoded 0.95 or 0.92 is returned.
    - Confidence is strictly model-derived.
    - Operational guardrail flags are captured separately.
    """
    # Case 1: Coal Basin Proximity
    feat_coal = feature_extractor.extract_features(
        lat=23.74, lon=86.41, bright_ti4_k=333.0, bright_ti5_k=316.0, frp_mw=18.0,
        daynight='N', hist_recurrence_90d=0.85, hist_mean_frp=16.0, hist_std_frp=3.0
    )
    # Ensure distance to mine and recurrence match former override trigger
    feat_coal["feature_dict"]["dist_to_mine_km"] = 12.0
    feat_coal["feature_dict"]["recurrence_90d"] = 0.75

    res_coal = loaded_model.predict_proba_and_evidence(
        feat_coal["feature_array"], feat_coal["feature_dict"], FEATURE_NAMES
    )

    # Must NOT be hardcoded 0.95 (95.0%)
    raw_c = res_coal["raw_model_confidence"]
    assert raw_c != 0.95, "FAIL: Confidence is still the hardcoded 0.95 literal!"
    assert res_coal["confidence_score"] != 95.0, "FAIL: Confidence score is still the hardcoded 95.0% literal!"

    # Guardrail advisory must be present independently
    assert any(g["rule_id"] == "COAL_BASIN_PROXIMITY" for g in res_coal["guardrail_flags"]), \
        "Operational guardrail flag missing for coal basin proximity"

    # Case 2: Barren Land Anomaly
    feat_bare = feature_extractor.extract_features(
        lat=27.02, lon=71.50, bright_ti4_k=315.0, bright_ti5_k=310.0, frp_mw=5.0,
        daynight='D', hist_recurrence_90d=0.02, hist_mean_frp=4.0, hist_std_frp=2.0
    )
    feat_bare["feature_dict"]["bare_fraction"] = 0.25
    feat_bare["feature_dict"]["frp_mw"] = 6.0
    feat_bare["feature_dict"]["recurrence_90d"] = 0.03

    res_bare = loaded_model.predict_proba_and_evidence(
        feat_bare["feature_array"], feat_bare["feature_dict"], FEATURE_NAMES
    )

    # Must NOT be hardcoded 0.92 (92.0%)
    raw_b = res_bare["raw_model_confidence"]
    assert raw_b != 0.92, "FAIL: Confidence is still the hardcoded 0.92 literal!"
    assert res_bare["confidence_score"] != 92.0, "FAIL: Confidence score is still the hardcoded 92.0% literal!"

    # Guardrail advisory must be present independently
    assert any(g["rule_id"] == "BARE_GROUND_THERMAL_CLUSTER" for g in res_bare["guardrail_flags"]), \
        "Operational guardrail flag missing for bare ground anomaly"


def test_treeshap_explicit_scope_metadata(loaded_model, feature_extractor):
    """Verify TreeSHAP explicitly identifies decision_scope as Stage-1 Industrial Segregation."""
    feat = feature_extractor.extract_features(
        lat=22.38, lon=69.87, bright_ti4_k=365.0, bright_ti5_k=304.0, frp_mw=18.5
    )
    explainer = ExactTreeSHAPExplainer(loaded_model.stage1_model, FEATURE_NAMES)
    shap_out = explainer.explain_sample(feat["feature_array"], feat["feature_dict"])

    assert shap_out["decision_scope"] == "STAGE_1_INDUSTRIAL_SEGREGATION"
    assert shap_out["target_decision"] == "Industrial vs Non-Industrial"
    assert "Stage-1" in shap_out["scope_explanation"]
    assert "Stage-2" in shap_out["scope_explanation"]
    assert shap_out["additivity_verified"] is True
    assert shap_out["additivity_error"] < 1e-5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
