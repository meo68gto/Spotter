#!/bin/bash
# ============================================================================
# Load Test: Round Operations
# Tests round creation and related operations performance
# Target: < 200ms per operation
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
CONCURRENT_REQUESTS=5
TOTAL_REQUESTS=50
TARGET_RESPONSE_TIME=200  # ms

# Results storage
declare -a response_times
total_requests=0
successful_requests=0
failed_requests=0
slow_requests=0

# Function to make a rounds list request
make_rounds_request() {
    local start_time end_time duration
    start_time=$(date +%s%N)
    
    # Query rounds via Supabase REST API
    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X GET \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        "${SUPABASE_URL}/rest/v1/rounds?select=*&status=eq.open&limit=20" \
        2>/dev/null)
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))  # Convert to ms
    
    local http_code
    http_code=$(echo "$response" | tail -n1)
    
    echo "$duration $http_code"
}

# Function to make a round participants request
make_participants_request() {
    local start_time end_time duration
    start_time=$(date +%s%N)
    
    # Query round participants via Supabase REST API
    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X GET \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -H "Content-Type: application/json" \
        "${SUPABASE_URL}/rest/v1/round_participants_v2?select=*&limit=20" \
        2>/dev/null)
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))  # Convert to ms
    
    local http_code
    http_code=$(echo "$response" | tail -n1)
    
    echo "$duration $http_code"
}

# Print header
echo "============================================================================"
echo "ROUND OPERATIONS LOAD TEST"
echo "============================================================================"
echo "Target URL: ${SUPABASE_URL}"
echo "Concurrent Requests: ${CONCURRENT_REQUESTS}"
echo "Total Requests: ${TOTAL_REQUESTS}"
echo "Target Response Time: ${TARGET_RESPONSE_TIME}ms"
echo "============================================================================"
echo ""

# Run tests for rounds list
echo "Testing rounds list queries..."

for ((batch=0; batch<TOTAL_REQUESTS/CONCURRENT_REQUESTS/2; batch++)); do
    printf "\rBatch %d/%d..." $((batch+1)) $((TOTAL_REQUESTS/CONCURRENT_REQUESTS/2))
    
    # Run batch of concurrent requests
    for ((i=0; i<CONCURRENT_REQUESTS; i++)); do
        (
            result=$(make_rounds_request)
            duration=$(echo "$result" | cut -d' ' -f1)
            http_code=$(echo "$result" | cut -d' ' -f2)
            
            echo "${duration},${http_code},rounds" >> /tmp/rounds_results.csv
        ) &
    done
    
    wait
done

echo ""
echo ""

# Run tests for participants
echo "Testing participants queries..."

for ((batch=0; batch<TOTAL_REQUESTS/CONCURRENT_REQUESTS/2; batch++)); do
    printf "\rBatch %d/%d..." $((batch+1)) $((TOTAL_REQUESTS/CONCURRENT_REQUESTS/2))
    
    # Run batch of concurrent requests
    for ((i=0; i<CONCURRENT_REQUESTS; i++)); do
        (
            result=$(make_participants_request)
            duration=$(echo "$result" | cut -d' ' -f1)
            http_code=$(echo "$result" | cut -d' ' -f2)
            
            echo "${duration},${http_code},participants" >> /tmp/rounds_results.csv
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

if [[ -f /tmp/rounds_results.csv ]]; then
    # Calculate statistics
    total_time=0
    min_time=999999
    max_time=0
    
    rounds_count=0
    participants_count=0
    rounds_time=0
    participants_time=0
    
    while IFS=',' read -r duration http_code query_type; do
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
        
        if [[ "$query_type" == "rounds" ]]; then
            rounds_count=$((rounds_count + 1))
            rounds_time=$((rounds_time + duration))
        else
            participants_count=$((participants_count + 1))
            participants_time=$((participants_time + duration))
        fi
        
        if [[ $duration -lt $min_time ]]; then
            min_time=$duration
        fi
        
        if [[ $duration -gt $max_time ]]; then
            max_time=$duration
        fi
        
        response_times+=($duration)
    done < /tmp/rounds_results.csv
    
    # Calculate averages
    avg_time=$((total_time / total_requests))
    rounds_avg=$((rounds_time / rounds_count))
    participants_avg=$((participants_time / participants_count))
    
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
    echo "By Query Type:"
    echo "  Rounds List:        ${rounds_count} requests, avg ${rounds_avg}ms"
    echo "  Participants:       ${participants_count} requests, avg ${participants_avg}ms"
    echo ""
    echo "Throughput:           ${throughput} req/sec"
    echo ""
    
    # Performance assessment
    echo "============================================================================"
    echo "PERFORMANCE ASSESSMENT"
    echo "============================================================================"
    
    if [[ $avg_time -lt $TARGET_RESPONSE_TIME && $p95 -lt $((TARGET_RESPONSE_TIME * 2)) ]]; then
        echo -e "${GREEN}✓ PASS${NC}: Round operations meet performance target (${TARGET_RESPONSE_TIME}ms)"
        echo -e "  Average response time: ${avg_time}ms"
    else
        echo -e "${RED}✗ FAIL${NC}: Round operations exceed performance target"
        echo -e "  Target: ${TARGET_RESPONSE_TIME}ms"
        echo -e "  Average: ${avg_time}ms"
        echo -e "  95th percentile: ${p95}ms"
    fi
    
    if [[ $failed_requests -gt 0 ]]; then
        echo -e "${YELLOW}⚠ WARNING${NC}: ${failed_requests} requests failed"
    fi
    
    # Cleanup
    rm -f /tmp/rounds_results.csv
else
    echo "No results file found. Test may have failed."
    exit 1
fi

echo ""
echo "============================================================================"
echo "Load test complete."
echo "============================================================================"
