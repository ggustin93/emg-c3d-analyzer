import numpy as np

from emg.emg_analysis import analyze_contractions


def synth_signal(with_contraction=True, length=5000, noise=0.001):
    rng = np.random.default_rng(42)
    x = rng.normal(0, noise, size=length)
    if with_contraction:
        x[1000:3500] += 0.1  # 2.5 s burst at 1000 Hz
    return x


def test_flags_none_thresholds_returns_false():
    sig = synth_signal()
    res = analyze_contractions(
        signal=sig,
        sampling_rate=1000,
        threshold_factor=0.2,
        min_duration_ms=100,
        smoothing_window=50,
        mvc_amplitude_threshold=None,
        contraction_duration_threshold_ms=None,
    )
    for c in res.get("contractions", []):
        assert c["meets_mvc"] is False
        assert c["meets_duration"] is False
        assert c["is_good"] is False


def test_flags_duration_only():
    sig = synth_signal()
    res = analyze_contractions(
        signal=sig,
        sampling_rate=1000,
        threshold_factor=0.2,
        min_duration_ms=100,
        smoothing_window=50,
        mvc_amplitude_threshold=None,
        contraction_duration_threshold_ms=2000,
    )
    assert res["duration_compliant_count"] >= 1
    assert res["mvc_compliant_count"] == 0
    assert (
        res["good_contraction_count"] >= 1
    )  # is_good == meets_duration when only duration provided


def test_flags_both_thresholds():
    sig = synth_signal()
    res = analyze_contractions(
        signal=sig,
        sampling_rate=1000,
        threshold_factor=0.2,
        min_duration_ms=100,
        smoothing_window=50,
        mvc_amplitude_threshold=0.05,  # below burst amplitude
        contraction_duration_threshold_ms=2000,
    )
    assert res["duration_compliant_count"] >= 1
    assert res["mvc_compliant_count"] >= 1
    assert res["good_contraction_count"] >= 1
