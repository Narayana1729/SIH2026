#!/usr/bin/env python3
"""
Production ML Runtime Inference Worker.
Loads the trained hierarchical thermal classifier and feature extractor once at startup,
and serves low-latency inferences via line-delimited JSON over stdio.
"""

import sys
import os
import json
import logging

logging.basicConfig(level=logging.ERROR, stream=sys.stderr)

try:
    import numpy as np
    import joblib

    # Configure path to hierarchical classifier and feature extractor
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sri_dir = os.path.abspath(os.path.join(base_dir, '../../FirmsBackend/Ai-Flame-Detection/sri'))
    if sri_dir not in sys.path:
        sys.path.insert(0, sri_dir)

    from src.hierarchical_classifier import HierarchicalThermalClassifier, CLASS_MAP
    from src.feature_extractor import FeatureExtractor, FEATURE_NAMES
    from src.treeshap_dp import ExactTreeSHAPExplainer

    # Ensure unpickler can locate HierarchicalThermalClassifier under __main__ if pickled that way
    setattr(sys.modules['__main__'], 'HierarchicalThermalClassifier', HierarchicalThermalClassifier)

    # Locate trained model artifact
    candidate_paths = [
        os.path.abspath(os.path.join(base_dir, '../../ml/data/trained_hierarchical_model.joblib')),
        os.path.abspath(os.path.join(sri_dir, 'data/processed/trained_hierarchical_model.joblib')),
        os.path.abspath(os.path.join(base_dir, '../../data/processed/trained_hierarchical_model.joblib'))
    ]

    model_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            model_path = p
            break

    if not model_path:
        raise FileNotFoundError(f"Trained model artifact not found in candidates: {candidate_paths}")

    # Temporarily redirect stdout to stderr during engine initialization so BallTree prints don't corrupt stdout
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        model = joblib.load(model_path)
        extractor = FeatureExtractor()
        explainer = ExactTreeSHAPExplainer(model.stage1_model, FEATURE_NAMES)
    finally:
        sys.stdout = real_stdout

    # Emit ready handshake on stderr
    sys.stderr.write(f"ML_WORKER_READY: Model loaded from {model_path}\n")
    sys.stderr.flush()

except Exception as init_err:
    sys.stderr.write(f"ML_WORKER_INIT_ERROR: {init_err}\n")
    sys.stderr.flush()
    sys.exit(1)


def _extract_single_features(obs):
    lat = float(obs.get("latitude") or obs.get("lat") or 0.0)
    lon = float(obs.get("longitude") or obs.get("lon") or 0.0)
    bright_ti4 = float(obs.get("bright_ti4") or obs.get("brightness_temp_k") or obs.get("brightness") or 340.0)
    bright_ti5 = float(obs.get("bright_ti5") or obs.get("bright_lwir_k") or (bright_ti4 - 20.0))
    frp_mw = float(obs.get("frp_mw") or obs.get("frp") or 15.0)
    daynight = str(obs.get("daynight") or "N").upper()
    rec_90 = float(obs.get("recurrence_90d") or 0.0)
    mean_frp = float(obs.get("historical_mean_frp") or 15.0)
    std_frp = float(obs.get("historical_std_frp") or 4.0)
    sample_n = int(obs.get("sample_count_n") or 10)

    feat = extractor.extract_features(
        lat=lat,
        lon=lon,
        bright_ti4_k=bright_ti4,
        bright_ti5_k=bright_ti5,
        frp_mw=frp_mw,
        daynight=daynight,
        hist_recurrence_90d=rec_90,
        hist_mean_frp=mean_frp,
        hist_std_frp=std_frp,
        hist_sample_n=sample_n
    )
    return feat, {
        "lat": lat, "lon": lon, "bright_ti4": bright_ti4,
        "bright_ti5": bright_ti5, "frp_mw": frp_mw, "daynight": daynight
    }


def process_batch_request(req_id, detections):
    try:
        if not detections:
            return {"id": req_id, "status": "ok", "count": 0, "predictions": []}

        # 1. Extract 26-D features for each detection
        feats = []
        parsed_obs = []
        for d in detections:
            f, o = _extract_single_features(d)
            feats.append(f)
            parsed_obs.append(o)

        X = np.vstack([f["feature_array"] for f in feats])

        # 2. Vectorized Stage 1: Industrial Probability (N,)
        p_ind = model.stage1_model.predict_proba(X)[:, 1]

        # 3. Vectorized Stage 2 predictions
        predictions = []
        ind_indices = np.where(p_ind >= 0.5)[0]
        non_ind_indices = np.where(p_ind < 0.5)[0]

        stage2a_preds = {}
        stage2a_probs = {}
        if len(ind_indices) > 0:
            X_ind = X[ind_indices]
            raw_p2a = model.stage2a_model.predict(X_ind)
            raw_prob2a = model.stage2a_model.predict_proba(X_ind)
            for idx_in_subset, global_idx in enumerate(ind_indices):
                stage2a_preds[global_idx] = int(raw_p2a[idx_in_subset])
                stage2a_probs[global_idx] = float(np.max(raw_prob2a[idx_in_subset]) * p_ind[global_idx])

        stage2b_preds = {}
        stage2b_probs = {}
        if len(non_ind_indices) > 0:
            X_non_ind = X[non_ind_indices]
            raw_p2b = model.stage2b_model.predict(X_non_ind)
            raw_prob2b = model.stage2b_model.predict_proba(X_non_ind)
            for idx_in_subset, global_idx in enumerate(non_ind_indices):
                stage2b_preds[global_idx] = int(raw_p2b[idx_in_subset])
                stage2b_probs[global_idx] = float(np.max(raw_prob2b[idx_in_subset]) * (1.0 - p_ind[global_idx]))

        # 4. Assemble prediction objects with local TreeSHAP explanations
        local_explanations = []
        for i in range(len(detections)):
            try:
                local_explanations.append(explainer.explain_sample(feats[i]["feature_array"], feats[i]["feature_dict"]))
            except Exception as e:
                local_explanations.append({
                    "method": "ERROR",
                    "error": str(e),
                    "attributions": {}
                })

        for i in range(len(detections)):
            fd = feats[i]["feature_dict"]
            prob_i = float(p_ind[i])
            xai_i = local_explanations[i]

            if i in stage2a_preds:
                class_id = stage2a_preds[i]
                conf = float(stage2a_probs[i])
            else:
                class_id = stage2b_preds[i]
                conf = float(stage2b_probs[i])

            # Operational guardrail telemetry (NEVER modifies ML class or probability)
            guardrails = []
            if fd.get('dist_to_mine_km', 999.0) < 30.0 and fd.get('recurrence_90d', 0.0) > 0.40:
                guardrails.append({
                    "rule_id": "COAL_BASIN_PROXIMITY",
                    "advisory": "Within 30km of active mining basin with high recurrence (>0.40)",
                    "suggested_operational_subtype": "MINING_COAL_SEAM_FIRE"
                })
            if fd.get('bare_fraction', 0.0) > 0.08 and fd.get('frp_mw', 0.0) < 10.0 and fd.get('recurrence_90d', 0.0) < 0.1:
                guardrails.append({
                    "rule_id": "BARE_GROUND_THERMAL_CLUSTER",
                    "advisory": "Low-FRP anomaly (<10MW) on barren ground with low recurrence",
                    "suggested_operational_subtype": "OTHER_THERMAL_ANOMALY"
                })

            class_name = CLASS_MAP.get(class_id, "OTHER_FIRE")
            conf_band = "HIGH" if conf >= 0.85 else ("MODERATE" if conf >= 0.65 else "LOW")

            predictions.append({
                "index": i,
                "class_id": class_id,
                "class_name": class_name,
                "confidence_score": round(conf * 100.0, 1),
                "raw_model_confidence": round(conf, 4),
                "confidence_band": conf_band,
                "industrial_probability": round(prob_i, 4),
                "guardrail_flags": guardrails,
                "feature_contributions": xai_i.get("attributions", {}),
                "xai": xai_i,
                "features": fd,
                "metadata": feats[i].get("metadata", {})
            })

        return {
            "id": req_id,
            "status": "ok",
            "model_version": "v1.0.0-hierarchical-gb-et",
            "batch_size": len(predictions),
            "predictions": predictions
        }
    except Exception as e:
        return {
            "id": req_id,
            "status": "error",
            "error": str(e)
        }


def process_request(line):
    try:
        req = json.loads(line.strip())
        req_id = req.get("id")

        # Support batch action
        if req.get("action") == "batch" or (isinstance(req.get("detections"), list)):
            detections = req.get("detections", [])
            return process_batch_request(req_id, detections)

        obs = req.get("detection") or req
        feat, parsed = _extract_single_features(obs)

        # Execute hierarchical model prediction and evidence extraction
        pred = model.predict_proba_and_evidence(
            feat["feature_array"],
            feat["feature_dict"],
            FEATURE_NAMES
        )

        resp = {
            "id": req_id,
            "status": "ok",
            "model_version": "v1.0.0-hierarchical-gb-et",
            "prediction": {
                "class_id": pred.get("predicted_class_id"),
                "class_name": pred.get("predicted_class_name"),
                "confidence_score": pred.get("confidence_score"),
                "raw_model_confidence": pred.get("raw_model_confidence"),
                "stage1_probability": pred.get("stage1_probability"),
                "stage2_probabilities": pred.get("stage2_probabilities"),
                "confidence_band": pred.get("confidence_band"),
                "guardrail_flags": pred.get("guardrail_flags", []),
                "feature_contributions": pred.get("feature_contributions", {}),
                "explainability_evidence": pred.get("explainability_evidence", {}),
                "xai": pred.get("xai", {})
            },
            "features": feat["feature_dict"],
            "metadata": feat.get("metadata", {})
        }
        return resp
    except Exception as e:
        return {
            "id": req.get("id") if 'req' in locals() and isinstance(req, dict) else None,
            "status": "error",
            "error": str(e)
        }


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        if line == "PING":
            sys.stdout.write(json.dumps({"status": "PONG"}) + "\n")
            sys.stdout.flush()
            continue

        resp = process_request(line)
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
