"""
Example Usage: EMG Data Export
==============================

This script demonstrates how to use the EMGDataExporter for comprehensive
C3D data export and debugging.
"""

import json
from pathlib import Path
from .processor import GHOSTLYC3DProcessor
from .models import GameSessionParameters, ProcessingOptions
from .export_utils import EMGDataExporter, create_quick_export


def example_comprehensive_export():
    """Example of comprehensive data export."""
    
    # Example C3D file path (replace with actual path)
    c3d_file_path = "sample_data/example_session.c3d"
    
    # Create processor instance
    processor = GHOSTLYC3DProcessor(c3d_file_path)
    
    # Set up processing parameters
    processing_opts = ProcessingOptions(
        threshold_factor=0.3,
        min_duration_ms=50,
        smoothing_window=25
    )
    
    session_params = GameSessionParameters(
        session_mvc_value=100.0,
        session_mvc_threshold_percentage=75.0,
        session_expected_contractions=12,
        session_expected_contractions_ch1=12,
        session_expected_contractions_ch2=12
    )
    
    # Process the file
    result = processor.process_file(processing_opts, session_params)
    
    # Create comprehensive export
    exporter = EMGDataExporter(processor)
    
    # Full export with all data
    comprehensive_data = exporter.create_comprehensive_export(
        session_params=session_params,
        processing_opts=processing_opts,
        include_raw_signals=True,
        include_debug_info=True
    )
    
    # Save to file
    output_path = "exports/comprehensive_analysis.json"
    Path("exports").mkdir(exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(comprehensive_data, f, indent=2, ensure_ascii=False)
    
    print(f"Comprehensive export saved to: {output_path}")
    print(f"Export includes {len(comprehensive_data['channels'])} channels")
    print(f"Total analytics: {len(comprehensive_data['analytics'])} muscle groups")
    
    return comprehensive_data


def example_compact_export():
    """Example of compact export without raw signals."""
    
    c3d_file_path = "sample_data/example_session.c3d"
    processor = GHOSTLYC3DProcessor(c3d_file_path)
    
    processing_opts = ProcessingOptions()
    session_params = GameSessionParameters()
    
    # Process file
    processor.process_file(processing_opts, session_params)
    
    # Create compact export (no raw signals)
    exporter = EMGDataExporter(processor)
    compact_data = exporter.create_comprehensive_export(
        session_params=session_params,
        processing_opts=processing_opts,
        include_raw_signals=False,  # Saves space
        include_debug_info=False    # Production-ready
    )
    
    # Save compact version
    output_path = "exports/compact_analysis.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(compact_data, f, indent=2)
    
    print(f"Compact export saved to: {output_path}")
    return compact_data


def example_quick_export():
    """Example using the quick export function."""
    
    c3d_file_path = "sample_data/example_session.c3d"
    processor = GHOSTLYC3DProcessor(c3d_file_path)
    
    processing_opts = ProcessingOptions()
    session_params = GameSessionParameters()
    
    # Process file
    processor.process_file(processing_opts, session_params)
    
    # Quick export (includes everything)
    export_data = create_quick_export(
        processor_instance=processor,
        session_params=session_params,
        processing_opts=processing_opts
    )
    
    # Display summary
    print("Quick Export Summary:")
    print(f"- Channels: {len(export_data.get('channels', {}))}")
    print(f"- Analytics: {len(export_data.get('analytics', {}))}")
    print(f"- Debug info included: {'debug_info' in export_data}")
    print(f"- Raw signals included: {any('raw_data' in ch.get('signals', {}) for ch in export_data.get('channels', {}).values())}")
    
    return export_data


def example_export_specific_sections():
    """Example showing how to extract specific sections from export."""
    
    c3d_file_path = "sample_data/example_session.c3d"
    processor = GHOSTLYC3DProcessor(c3d_file_path)
    
    processing_opts = ProcessingOptions()
    session_params = GameSessionParameters()
    
    processor.process_file(processing_opts, session_params)
    
    exporter = EMGDataExporter(processor)
    full_export = exporter.create_comprehensive_export(
        session_params=session_params,
        processing_opts=processing_opts
    )
    
    # Extract specific sections for focused analysis
    
    # 1. Just the contraction analysis
    contraction_data = {}
    for channel, analytics in full_export.get('analytics', {}).items():
        contraction_data[channel] = analytics.get('contraction_analysis', {})
    
    # 2. Just the frequency analysis
    frequency_data = {}
    for channel, analytics in full_export.get('analytics', {}).items():
        frequency_data[channel] = analytics.get('frequency_analysis', {})
    
    # 3. Just the clinical metrics
    clinical_data = {}
    for channel, analytics in full_export.get('analytics', {}).items():
        clinical_data[channel] = analytics.get('clinical_metrics', {})
    
    # 4. Processing parameters and metadata only
    metadata_only = {
        'export_metadata': full_export.get('export_metadata'),
        'file_info': full_export.get('file_info'),
        'game_metadata': full_export.get('game_metadata'),
        'processing_parameters': full_export.get('processing_parameters'),
        'summary_statistics': full_export.get('summary_statistics')
    }
    
    # Save focused exports
    Path("exports/focused").mkdir(parents=True, exist_ok=True)
    
    exports = {
        'contractions': contraction_data,
        'frequency': frequency_data,
        'clinical': clinical_data,
        'metadata': metadata_only
    }
    
    for name, data in exports.items():
        output_path = f"exports/focused/{name}_analysis.json"
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Focused {name} export saved to: {output_path}")
    
    return exports


def example_debug_analysis():
    """Example showing how to use export data for debugging."""
    
    c3d_file_path = "sample_data/example_session.c3d"
    processor = GHOSTLYC3DProcessor(c3d_file_path)
    
    processing_opts = ProcessingOptions()
    session_params = GameSessionParameters()
    
    processor.process_file(processing_opts, session_params)
    
    exporter = EMGDataExporter(processor)
    debug_export = exporter.create_comprehensive_export(
        session_params=session_params,
        processing_opts=processing_opts,
        include_debug_info=True
    )
    
    # Analyze debug information
    debug_info = debug_export.get('debug_info', {})
    
    print("=== DEBUG ANALYSIS ===")
    print(f"Processor State: {debug_info.get('processor_state', {})}")
    print(f"Data Dimensions: {debug_info.get('data_dimensions', {})}")
    
    # Check for processing warnings
    warnings = debug_info.get('processing_warnings', [])
    if warnings:
        print(f"\n⚠️  Processing Warnings ({len(warnings)}):")
        for warning in warnings:
            print(f"  - {warning['channel']}: {warning['message']}")
    else:
        print("\n✅ No processing warnings")
    
    # Analyze channel coverage
    channels = debug_export.get('channels', {})
    analytics = debug_export.get('analytics', {})
    
    print(f"\n📊 Channel Coverage:")
    print(f"  - Raw channels detected: {len(channels)}")
    print(f"  - Analytics generated: {len(analytics)}")
    
    for channel_name in channels.keys():
        channel_type = channels[channel_name]['metadata'].get('signal_type', 'unknown')
        has_analytics = any(channel_name.replace(' Raw', '').replace(' activated', '') in analytics)
        print(f"  - {channel_name}: {channel_type} {'✅' if has_analytics else '❌'}")
    
    return debug_export


if __name__ == "__main__":
    """Run examples (requires valid C3D file)."""
    
    print("EMG Data Export Examples")
    print("=" * 40)
    
    try:
        # Run examples (you'll need to provide a valid C3D file path)
        print("\n1. Comprehensive Export:")
        # comprehensive_data = example_comprehensive_export()
        
        print("\n2. Compact Export:")
        # compact_data = example_compact_export()
        
        print("\n3. Quick Export:")
        # quick_data = example_quick_export()
        
        print("\n4. Focused Exports:")
        # focused_data = example_export_specific_sections()
        
        print("\n5. Debug Analysis:")
        # debug_data = example_debug_analysis()
        
        print("\n✅ All examples completed successfully!")
        print("Update the file paths and uncomment the examples to run.")
        
    except Exception as e:
        print(f"❌ Example failed: {str(e)}")
        print("Make sure to provide valid C3D file paths in the examples.")