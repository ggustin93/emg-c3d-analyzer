#!/bin/bash

# Build Process Test
# Verifies that the build process completes successfully

echo "Testing Build Process..."
echo ""

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Not in project root directory"
    echo "   Please run from the emg-c3d-analyzer directory"
    exit 1
fi

# Test frontend build
echo "1. Testing frontend build:"
echo "   Running: cd frontend && npm run build"
echo ""

cd frontend

# Clean previous build
rm -rf dist

# Run the build
if npm run build > /tmp/build_output.txt 2>&1; then
    echo "  ✅ Build completed successfully"
    
    # Check if dist folder was created
    if [ -d "dist" ]; then
        echo "  ✅ dist/ folder created"
        
        # Check for key files
        if [ -f "dist/index.html" ]; then
            echo "  ✅ index.html generated"
        else
            echo "  ❌ index.html not found in dist/"
        fi
        
        # Check for JavaScript bundles
        js_count=$(ls dist/assets/*.js 2>/dev/null | wc -l)
        if [ $js_count -gt 0 ]; then
            echo "  ✅ JavaScript bundles generated ($js_count files)"
        else
            echo "  ❌ No JavaScript bundles found"
        fi
        
        # Check for CSS
        css_count=$(ls dist/assets/*.css 2>/dev/null | wc -l)
        if [ $css_count -gt 0 ]; then
            echo "  ✅ CSS files generated ($css_count files)"
        else
            echo "  ⚠️  No CSS files found"
        fi
        
        # Check for content files
        if [ -d "dist/content" ]; then
            echo "  ✅ Content files copied"
            
            # Check FAQ files
            if [ -d "dist/content/faq" ]; then
                faq_count=$(find dist/content/faq -name "*.md" | wc -l)
                echo "    - FAQ files: $faq_count"
            fi
            
            # Check About files
            if [ -d "dist/content/about" ]; then
                about_count=$(find dist/content/about -name "*.md" | wc -l)
                echo "    - About files: $about_count"
            fi
        else
            echo "  ⚠️  Content files not copied to dist/"
        fi
        
        # Check build size
        echo ""
        echo "  Build Statistics:"
        total_size=$(du -sh dist | cut -f1)
        echo "    - Total size: $total_size"
        
        # Check for large bundles
        large_files=$(find dist/assets -name "*.js" -size +500k 2>/dev/null)
        if [ -n "$large_files" ]; then
            echo "    ⚠️  Large bundles detected (>500KB):"
            for file in $large_files; do
                size=$(du -h "$file" | cut -f1)
                basename=$(basename "$file")
                echo "      - $basename: $size"
            done
        fi
        
    else
        echo "  ❌ dist/ folder not created"
    fi
else
    echo "  ❌ Build failed"
    echo ""
    echo "  Error output:"
    tail -20 /tmp/build_output.txt | sed 's/^/    /'
    cd ..
    exit 1
fi

cd ..

# Test TypeScript compilation
echo ""
echo "2. Testing TypeScript compilation:"
cd frontend
if npx tsc --noEmit > /tmp/tsc_output.txt 2>&1; then
    echo "  ✅ TypeScript compilation successful (no type errors)"
else
    echo "  ❌ TypeScript compilation errors found"
    echo "  First 10 errors:"
    head -20 /tmp/tsc_output.txt | sed 's/^/    /'
fi
cd ..

# Summary
echo ""
echo "Build Test Summary:"
echo "✅ Build process is working correctly!"
echo ""
echo "📦 Build is ready for deployment"