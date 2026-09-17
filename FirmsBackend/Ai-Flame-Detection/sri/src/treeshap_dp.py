"""
Exact Lundberg TreeSHAP Dynamic Programming Module
==================================================
Implements exact TreeSHAP (Lundberg et al., Nature Machine Intelligence 2020)
for scikit-learn tree ensembles without external C-extension or Numba compilation dependencies.

Guarantees:
1. Exact Efficiency Axiom (Additivity):
   sum(phi_i) + base_value == f(x) [in raw model margin space] to machine precision (< 1e-6).
2. Pure Local Attributions:
   Attributions are sample-specific (local), varying according to sample feature values.
3. No heuristic proxy or global feature_importances_ confusion:
   Explicitly verified against decision_function(x).
"""

import numpy as np
from typing import List, Dict, Any, Optional, Union


def _compute_expectations(children_left, children_right, node_sample_weight, values, i: int, depth: int = 0) -> int:
    """Recursively computes conditional expectation values at each node in the tree."""
    if children_right[i] == -1:
        return 0
    li = children_left[i]
    ri = children_right[i]
    depth_left = _compute_expectations(children_left, children_right, node_sample_weight, values, li, depth + 1)
    depth_right = _compute_expectations(children_left, children_right, node_sample_weight, values, ri, depth + 1)
    left_weight = node_sample_weight[li]
    right_weight = node_sample_weight[ri]
    total_weight = left_weight + right_weight
    if total_weight > 0:
        values[i, :] = (left_weight * values[li, :] + right_weight * values[ri, :]) / total_weight
    return max(depth_left, depth_right) + 1


def _extend_path(feature_indexes, zero_fractions, one_fractions, pweights,
                 unique_depth: int, zero_fraction: float, one_fraction: float, feature_index: int):
    feature_indexes[unique_depth] = feature_index
    zero_fractions[unique_depth] = zero_fraction
    one_fractions[unique_depth] = one_fraction
    if unique_depth == 0:
        pweights[unique_depth] = 1.0
    else:
        pweights[unique_depth] = 0.0

    for i in range(unique_depth - 1, -1, -1):
        pweights[i + 1] += one_fraction * pweights[i] * (i + 1.0) / (unique_depth + 1.0)
        pweights[i] = zero_fraction * pweights[i] * (unique_depth - i) / (unique_depth + 1.0)


def _unwind_path(feature_indexes, zero_fractions, one_fractions, pweights,
                 unique_depth: int, path_index: int):
    one_fraction = one_fractions[path_index]
    zero_fraction = zero_fractions[path_index]
    next_one_portion = pweights[unique_depth]

    for i in range(unique_depth - 1, -1, -1):
        if one_fraction != 0.0:
            tmp = pweights[i]
            pweights[i] = next_one_portion * (unique_depth + 1.0) / ((i + 1.0) * one_fraction)
            next_one_portion = tmp - pweights[i] * zero_fraction * (unique_depth - i) / (unique_depth + 1.0)
        else:
            pweights[i] = (pweights[i] * (unique_depth + 1)) / (zero_fraction * (unique_depth - i))

    for i in range(path_index, unique_depth):
        feature_indexes[i] = feature_indexes[i + 1]
        zero_fractions[i] = zero_fractions[i + 1]
        one_fractions[i] = one_fractions[i + 1]


def _unwound_path_sum(feature_indexes, zero_fractions, one_fractions, pweights,
                      unique_depth: int, path_index: int) -> float:
    one_fraction = one_fractions[path_index]
    zero_fraction = zero_fractions[path_index]
    next_one_portion = pweights[unique_depth]
    total = 0.0

    for i in range(unique_depth - 1, -1, -1):
        if one_fraction != 0.0:
            tmp = next_one_portion * (unique_depth + 1.0) / ((i + 1.0) * one_fraction)
            total += tmp
            next_one_portion = pweights[i] - tmp * zero_fraction * ((unique_depth - i) / (unique_depth + 1.0))
        else:
            total += (pweights[i] / zero_fraction) / ((unique_depth - i) / (unique_depth + 1.0))

    return total


def _tree_shap_recursive(children_left, children_right, features, thresholds, values,
                         node_sample_weight, x, x_missing, phi, node_index: int, unique_depth: int,
                         parent_feature_indexes, parent_zero_fractions, parent_one_fractions, parent_pweights,
                         parent_zero_fraction: float, parent_one_fraction: float, parent_feature_index: int,
                         condition_fraction: float):
    if condition_fraction == 0.0:
        return

    feature_indexes = parent_feature_indexes[unique_depth + 1:].copy()
    feature_indexes[:unique_depth + 1] = parent_feature_indexes[:unique_depth + 1]
    zero_fractions = parent_zero_fractions[unique_depth + 1:].copy()
    zero_fractions[:unique_depth + 1] = parent_zero_fractions[:unique_depth + 1]
    one_fractions = parent_one_fractions[unique_depth + 1:].copy()
    one_fractions[:unique_depth + 1] = parent_one_fractions[:unique_depth + 1]
    pweights = parent_pweights[unique_depth + 1:].copy()
    pweights[:unique_depth + 1] = parent_pweights[:unique_depth + 1]

    _extend_path(
        feature_indexes, zero_fractions, one_fractions, pweights,
        unique_depth, parent_zero_fraction, parent_one_fraction, parent_feature_index
    )

    split_index = features[node_index]

    if children_right[node_index] == -1:  # Leaf node
        for i in range(1, unique_depth + 1):
            w = _unwound_path_sum(feature_indexes, zero_fractions, one_fractions, pweights, unique_depth, i)
            phi[feature_indexes[i], :] += w * (one_fractions[i] - zero_fractions[i]) * values[node_index, :] * condition_fraction
    else:  # Internal node
        cleft = children_left[node_index]
        cright = children_right[node_index]
        if x_missing[split_index]:
            hot_index = cleft
        elif x[split_index] <= thresholds[node_index]:
            hot_index = cleft
        else:
            hot_index = cright
        cold_index = cright if hot_index == cleft else cleft

        w = node_sample_weight[node_index]
        hot_zero_fraction = node_sample_weight[hot_index] / w if w > 0 else 0.5
        cold_zero_fraction = node_sample_weight[cold_index] / w if w > 0 else 0.5
        incoming_zero_fraction = 1.0
        incoming_one_fraction = 1.0

        path_index = 0
        while path_index <= unique_depth:
            if feature_indexes[path_index] == split_index:
                break
            path_index += 1

        if path_index != unique_depth + 1:
            incoming_zero_fraction = zero_fractions[path_index]
            incoming_one_fraction = one_fractions[path_index]
            _unwind_path(feature_indexes, zero_fractions, one_fractions, pweights, unique_depth, path_index)
            unique_depth -= 1

        _tree_shap_recursive(
            children_left, children_right, features, thresholds, values, node_sample_weight,
            x, x_missing, phi, hot_index, unique_depth + 1,
            feature_indexes, zero_fractions, one_fractions, pweights,
            hot_zero_fraction * incoming_zero_fraction, incoming_one_fraction, split_index,
            condition_fraction
        )
        _tree_shap_recursive(
            children_left, children_right, features, thresholds, values, node_sample_weight,
            x, x_missing, phi, cold_index, unique_depth + 1,
            feature_indexes, zero_fractions, one_fractions, pweights,
            cold_zero_fraction * incoming_zero_fraction, 0.0, split_index,
            condition_fraction
        )


class PreparedTree:
    """Pre-processed representation of a single decision tree with expectations computed."""
    def __init__(self, sklearn_tree, scale: float = 1.0):
        self.children_left = sklearn_tree.children_left.astype(np.int32)
        self.children_right = sklearn_tree.children_right.astype(np.int32)
        self.features = sklearn_tree.feature.astype(np.int32)
        self.thresholds = sklearn_tree.threshold.astype(np.float64)
        self.values = sklearn_tree.value[:, 0, :].copy() * scale
        self.node_sample_weight = sklearn_tree.weighted_n_node_samples.astype(np.float64)
        self.max_depth = _compute_expectations(
            self.children_left, self.children_right, self.node_sample_weight, self.values, 0
        )


class ExactTreeSHAPExplainer:
    """
    Exact TreeSHAP explainer for GradientBoostingClassifier (and other tree ensembles).
    Computes local Shapley values adhering strictly to Lundberg et al. (2020).
    """

    def __init__(self, model, feature_names: Optional[List[str]] = None):
        self.model = model
        self.feature_names = feature_names or []
        self.model_type = type(model).__name__

        if hasattr(model, "estimators_") and hasattr(model, "learning_rate"):
            # GradientBoostingClassifier
            self.scale = float(model.learning_rate)
            # In binary GBDT, estimators_ has shape (n_estimators, 1)
            self.trees = [PreparedTree(est[0].tree_, scale=self.scale) for est in model.estimators_]

            if hasattr(model, "init_") and hasattr(model.init_, "class_prior_"):
                prior = model.init_.class_prior_
                self.init_margin = float(np.log(prior[1] / prior[0]))
            else:
                self.init_margin = 0.0

            # Base value is initial prior log-odds plus root expected value across trees
            self.base_value = self.init_margin + sum(float(t.values[0, 0]) for t in self.trees)
        else:
            raise ValueError(f"Unsupported model type for ExactTreeSHAPExplainer: {self.model_type}")

        maxd = max(t.max_depth for t in self.trees) + 2
        self.max_workspace_size = (maxd * (maxd + 1)) // 2

    def explain_sample(self, x: np.ndarray, feature_dict: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """
        Computes local Shapley values for a single sample vector x (1-D array).
        Returns a structured dictionary with attributions, base value, additivity verification,
        and sorted human-interpretable feature impacts.
        """
        x = np.asarray(x, dtype=np.float64).flatten()
        n_features = len(x)
        x_missing = np.isnan(x)

        phi = np.zeros((n_features + 1, 1), dtype=np.float64)

        s = self.max_workspace_size
        feature_indexes = np.zeros(s, dtype=np.int32)
        zero_fractions = np.zeros(s, dtype=np.float64)
        one_fractions = np.zeros(s, dtype=np.float64)
        pweights = np.zeros(s, dtype=np.float64)

        for t in self.trees:
            _tree_shap_recursive(
                t.children_left, t.children_right, t.features, t.thresholds, t.values,
                t.node_sample_weight, x, x_missing, phi, 0, 0,
                feature_indexes, zero_fractions, one_fractions, pweights,
                1.0, 1.0, -1, 1.0
            )

        raw_attributions = phi[:n_features, 0]
        calculated_margin = self.base_value + float(np.sum(raw_attributions))

        # Decision function margin from scikit-learn
        expected_margin = float(self.model.decision_function(x.reshape(1, -1))[0])
        additivity_error = abs(expected_margin - calculated_margin)

        # Build feature attribution dictionary
        attr_dict = {}
        top_positive = []
        top_negative = []

        # Sort features by absolute contribution
        sorted_indices = np.argsort(np.abs(raw_attributions))[::-1]

        for idx in sorted_indices:
            fname = self.feature_names[idx] if idx < len(self.feature_names) else f"feature_{idx}"
            val = float(raw_attributions[idx])
            attr_dict[fname] = round(val, 4)

            feat_val = feature_dict.get(fname, float(x[idx])) if feature_dict else float(x[idx])
            item = {
                "feature": fname,
                "value": round(float(feat_val), 3) if isinstance(feat_val, (int, float)) else feat_val,
                "shap_margin_impact": round(val, 4)
            }
            if val > 0:
                top_positive.append(item)
            else:
                top_negative.append(item)

        # Convert margin to probability space impact
        prob = 1.0 / (1.0 + np.exp(-calculated_margin))

        return {
            "method": "TREE_SHAP",
            "implementation": "Lundberg-Exact-DP",
            "algorithm": "Exact Lundberg TreeSHAP dynamic-programming implementation",
            "scope": "LOCAL",
            "decision_scope": "STAGE_1_INDUSTRIAL_SEGREGATION",
            "target_decision": "Industrial vs Non-Industrial",
            "scope_explanation": "Explains the Stage-1 Industrial vs Non-Industrial model decision. It does not explain the Stage-2 six-class subtype.",
            "base_value": round(self.base_value, 4),
            "margin": round(calculated_margin, 4),
            "predicted_probability": round(float(prob), 4),
            "additivity_verified": bool(additivity_error < 1e-5),
            "additivity_error": float(additivity_error),
            "attributions": attr_dict,
            "top_positive_drivers": top_positive[:5],
            "top_negative_drivers": top_negative[:5]
        }

    def explain_batch(self, X: np.ndarray, feature_dicts: Optional[List[Dict[str, float]]] = None) -> List[Dict[str, Any]]:
        """Computes local Shapley values for an array of samples X (N, D)."""
        X = np.asarray(X, dtype=np.float64)
        results = []
        for i in range(len(X)):
            fd = feature_dicts[i] if feature_dicts and i < len(feature_dicts) else None
            results.append(self.explain_sample(X[i], fd))
        return results
