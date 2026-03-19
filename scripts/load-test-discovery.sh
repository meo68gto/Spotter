#!/bin/bash
# ============================================================================
# Load Test: Discovery Search
# Tests the discover_golfers() function performance
# Target: < 100ms per query
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"

# Test parameters
CONCURRENT_REQUESTS=10
TOTAL_REQUESTS=100
TARGET_RESPONSE_TIME=100  # ms

# Results storage
declare -a response_times
total_requests=0
successful_requests=0
failed_requests=0
slow_requests=0

# Function to make a discovery request
make_discovery_request() {
    local start_time end_time duration
    start_time=$(date +%s%N)
    
    # Call the discover_golfers function via Supabase
    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        "${SUPABASE_URL}/rest/v1/rpc/discover_golfers" \
        -d '{
            "p_user_id": "00000000-0000-0000-0000-000000000001",
            "p_limit": 20,
            "p_offset": 0
        }' 2>/dev/null)
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))  # Convert to ms
    
    local http_code
    http_code=$(echo "$response" | tail -n1)
    
    echo "$duration $http_code"
}

# Function to run concurrent requests
run_concurrent_requests() {
    local pids=()
    local results=()
    
    for ((i=0; i<CONCURRENT_REQUESTS; i++)); do
        make_discovery_request &
        pids+=($!)
    done
    
    for pid in "${pids[@]}"; do
        wait $pid
    done
}

# Print header
echo "============================================================================"
echo "DISCOVERY SEARCH LOAD TEST"
echo "============================================================================"
echo "Target URL: ${SUPABASE_URL}"
echo "Concurrent Requests: ${CONCURRENT_REQUESTS}"
echo "Total Requests: ${TOTAL_REQUESTS}"
echo "Target Response Time: ${TARGET_RESPONSE_TIME}ms"
echo "============================================================================"
echo ""

# Run tests
echo "Running load test..."
echo ""

for ((batch=0; batch<TOTAL_REQUESTS/CONCURRENT_REQUESTS; batch++)); do
    printf "\rBatch %d/%d..." $((batch+1)) $((TOTAL_REQUESTS/CONCURRENT_REQUESTS))
    
    # Run batch of concurrent requests
    for ((i=0; i<CONCURRENT_REQUESTS; i++)); do
        (
            result=$(make_discovery_request)
            duration=$(echo "$result" | cut -d' ' -f1)
            http_code=$(echo "$result" | cut -d' ' -f2)
            
            echo "${duration},${http_code}" >> /tmp/discovery_results.csv
        ) &
    done
    
    wait
done

echo ""
echo ""

# Analyze results
echo "============================================================================"
echo "RESULTS ANALYSIS"
echo "============================================================================"

if [[ -f /tmp/discovery_results.csv ]]; then
    # Calculate statistics
    total_time=0
    min_time=999999
    max_time=0
    
    while IFS=',' read -r duration http_code; do
        total_requests=$((total_requests + 1))
        
        if [[ "$http_code" == "200" ]]; then
            successful_requests=$((successful_requests + 1))
        else
            failed_requests=$((failed_requests + 1))
        fi
        
        if [[ $duration -gt $TARGET_RESPONSE_TIME ]]; then
            slow_requests=$((slow_requests + 1))
        fi
        
        total_time=$((total_time + duration))
        
        if [[ $duration -lt $min_time ]]; then
            min_time=$duration
        fi
        
        if [[ $duration -gt $max_time ]]; then
            max_time=$duration
        fi
        
        response_times+=($duration)
    done < /tmp/discovery_results.csv
    
    # Calculate average
    avg_time=$((total_time / total_requests))
    
    # Calculate percentiles (sort the array)
    IFS=$'\n' sorted_times=($(sort -n <<<"${response_times[*]}")); unset IFS
    p50=${sorted_times[$((total_requests / 2))]}
    p95=${sorted_times[$((total_requests * 95 / 100))]}
    p99=${sorted_times[$((total_requests * 99 / 100))]}
    
    # Calculate throughput
    throughput=$(echo "scale=2; $total_requests / ($total_time / 1000)" | bc 2>/dev/null || echo "N/A")
    
    # Print results
    echo ""
    echo "Request Statistics:"
    echo "  Total Requests:     ${total_requests}"
    echo "  Successful:         ${successful_requests}"
    echo "  Failed:             ${failed_requests}"
    echo "  Slow (>${TARGET_RESPONSE_TIME}ms):   ${slow_requests}"
    echo ""
    echo "Response Time Statistics:"
    echo "  Min:                ${min_time}ms"
    echo "  Average:            ${avg_time}ms"
    echo "  Max:                ${max_time}ms"
    echo "  50th Percentile:    ${p50}ms"
    echo "  95th Percentile:    ${p95}ms"
    echo "  99th Percentile:    ${p99}ms"
    echo ""
    echo "Throughput:           ${throughput} req/sec"
    echo ""
    
    # Performance assessment
    echo "============================================================================"
    echo "PERFORMANCE ASSESSMENT"
    echo "============================================================================"
    
    if [[ $avg_time -lt $TARGET_RESPONSE_TIME && $p95 -lt $((TARGET_RESPONSE_TIME * 2)) ]]; then
        echo -e "${GREEN}✓ PASS${NC}: Discovery query meets performance target (${TARGET_RESPONSE_TIME}ms)"
        echo -e "  Average response time: ${avg_time}ms"
    else
        echo -e "${RED}✗ FAIL${NC}: Discovery query exceeds performance target"
        echo -e "  Target: ${TARGET_RESPONSE_TIME}ms"
        echo -e "  Average: ${avg_time}ms"
        echo -e "  95th percentile: ${p95}ms"
    fi
    
    if [[ $failed_requests -gt 0 ]]; then
        echo -e "${YELLOW}⚠ WARNING${NC}: ${failed_requests} requests failed"
    fi
    
    # Cleanup
    rm -f /tmp/discovery_results.csv
else
    echo "No results file found. Test may have failed."
    exit 1
fi

echo ""
echo "============================================================================"
echo "Load test complete."
echo "============================================================================"
