"""
Plotting Module for EMG Analysis
================================

This module provides functions to generate visualizations from the data
processed by GHOSTLYC3DProcessor.
"""

import matplotlib.pyplot as plt
import numpy as np
from typing import Optional

# These might be needed if the processor class is passed directly
# from c3d_processor import GHOSTLYC3DProcessor 

# To avoid circular dependency, we'll pass data directly instead of the full object.
# Visualization settings can be defined here or passed as arguments.
EMG_COLOR = '#1abc9c'
CONTRACTION_COLOR = '#3498db'
ACTIVITY_COLORS = {
    'jumping': '#1abc9c',
    'shooting': '#e67e22'
}

def plot_emg_with_contractions(
    channel_name: str,
    signal_data: np.ndarray,
    time_axis: np.ndarray,
    contractions: list,
    analytics: Optional[dict] = None,
    save_path: Optional[str] = None,
    show_plot: bool = False
) -> Optional[str]:
    """Plots EMG data with highlighted contractions."""
    plt.figure(figsize=(12, 6))
    plt.plot(time_axis, signal_data, color=EMG_COLOR, linewidth=1, alpha=0.8)

    for contraction in contractions:
        start_s = contraction['start_time_ms'] / 1000
        end_s = contraction['end_time_ms'] / 1000
        plt.axvspan(start_s, end_s, color=CONTRACTION_COLOR, alpha=0.3)

    plt.title(f'EMG Signal: {channel_name}', fontsize=14)
    plt.xlabel('Time (seconds)', fontsize=12)
    plt.ylabel('Amplitude', fontsize=12)
    plt.grid(True, linestyle='--', alpha=0.7)

    if analytics:
        info_text = (
            f"Contractions: {analytics.get('contraction_count', 0)}\n"
            f"Avg Duration: {analytics.get('avg_duration_ms', 0):.2f} ms\n"
            f"Max Amplitude: {analytics.get('max_amplitude', 0):.2f}"
        )
        plt.figtext(0.02, 0.02, info_text, fontsize=10, bbox=dict(facecolor='white', alpha=0.8))

    if save_path:
        plt.savefig(save_path, dpi=600, bbox_inches='tight')
        
    if show_plot:
        plt.show()
    else:
        plt.close()

    return save_path

def plot_ghostly_report(
    game_metadata: dict,
    analytics_data: dict,
    emg_data: dict,
    save_path: Optional[str] = None,
    show_plot: bool = False
) -> Optional[str]:
    """Generates a GHOSTLY-style report with EMG data visualization."""
    fig = plt.figure(figsize=(12, 8))
    title_y = 0.93
    title_font = {'fontsize': 32, 'fontweight': 'bold', 'fontfamily': 'Arial'}

    fig.text(0.05, title_y, "GHOSTLY", color=EMG_COLOR, **title_font)
    fig.text(0.27, title_y, "GAME", color='#34495e', **title_font)
    fig.text(0.39, title_y, "REPORT", color='#2c3e50', **title_font)
    fig.add_artist(plt.Line2D([0.05, 0.95], [title_y - 0.03, title_y - 0.03], color='#bdc3c7', linewidth=1.5, alpha=0.8))

    date_str = game_metadata.get('time', 'N/A')
    level_str = f"Level: {game_metadata.get('level', 'N/A')}"
    plt.figtext(0.75, 0.93, f"Date: {date_str}", fontsize=14)
    plt.figtext(0.75, 0.89, level_str, fontsize=14)
    
    activities_to_plot = [k for k in analytics_data.keys() if 'activated' in k or 'raw' in k]
    if not activities_to_plot:
        activities_to_plot = list(analytics_data.keys())[:2]

    for i, activity in enumerate(activities_to_plot[:2]):
        channel_data = emg_data.get(activity, {})
        if not channel_data:
            continue

        signal_data = np.array(channel_data.get('data', []))
        time_axis = np.array(channel_data.get('time_axis', []))
        if signal_data.size == 0:
            continue
            
        ax = plt.subplot(2, 1, i + 1)
        color = ACTIVITY_COLORS.get(activity, f'C{i}')
        ax.plot(time_axis, signal_data, color=color, linewidth=1, alpha=0.8)

        activity_stats = analytics_data.get(activity, {})
        contraction_count = activity_stats.get('contraction_count', 'N/A')
        avg_duration = activity_stats.get('avg_duration_ms', 'N/A')
        if isinstance(avg_duration, (int, float)):
            avg_duration = f"{avg_duration:.2f} ms"

        ax.text(0.02, 0.85, activity, transform=ax.transAxes, fontsize=16, fontweight='bold', color=color)
        ax.text(0.25, 0.85, f"{contraction_count} contractions", transform=ax.transAxes, fontsize=12)
        ax.text(0.45, 0.85, f"{avg_duration} (avg. duration)", transform=ax.transAxes, fontsize=12)

        max_time = time_axis[-1] if len(time_axis) > 0 else 60
        ax.set_xticks(np.arange(0, max_time, 10))
        ax.set_xlim(0, max_time)
        ax.set_yticks([])
        ax.grid(True, linestyle='--', alpha=0.3)
        ax.set_xlabel('Time (seconds)')

    plt.tight_layout(rect=[0, 0, 1, 0.87])
    
    if save_path:
        plt.savefig(save_path, dpi=600, bbox_inches='tight')
        
    if show_plot:
        plt.show()
    else:
        plt.close()
        
    return save_path

# Note: plot_ghostly_report would also be moved here, with a similar signature
# accepting data rather than the processor object.
# For brevity, I'll omit its full implementation here but the logic is the same:
# it gets all necessary data as arguments. 