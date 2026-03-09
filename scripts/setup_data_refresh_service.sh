#!/bin/bash
#
# Data Refresh Scheduled Service Manager
#
# Runs scanner.py, flow_analysis.py, and discover.py every 10 minutes,
# 9:30 AM – 4:10 PM ET, Mon-Fri on trading days only. Uses launchd
# StartCalendarInterval with explicit time slots (205 entries: 41 slots x 5 weekdays).
#
# Usage:
#   ./scripts/setup_data_refresh_service.sh install   - Install and load service
#   ./scripts/setup_data_refresh_service.sh uninstall - Stop and remove service
#   ./scripts/setup_data_refresh_service.sh status    - Check service status
#   ./scripts/setup_data_refresh_service.sh logs      - Tail service logs
#   ./scripts/setup_data_refresh_service.sh start     - Run data refresh manually now

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.convex-scavenger.data-refresh.plist"
PLIST_SRC="$PROJECT_DIR/config/$PLIST_NAME"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LABEL="com.convex-scavenger.data-refresh"
LOG_DIR="$PROJECT_DIR/logs"
WRAPPER="$PROJECT_DIR/scripts/run_data_refresh.sh"

# --- Helpers ---

generate_plist() {
    local entries=""

    for weekday in 1 2 3 4 5; do
        hour=9
        minute=30
        while [ "$hour" -lt 16 ] || ([ "$hour" -eq 16 ] && [ "$minute" -le 10 ]); do
            entries+="        <dict>
            <key>Hour</key>
            <integer>${hour}</integer>
            <key>Minute</key>
            <integer>${minute}</integer>
            <key>Weekday</key>
            <integer>${weekday}</integer>
        </dict>
"
            minute=$((minute + 10))
            if [ "$minute" -ge 60 ]; then
                minute=$((minute - 60))
                hour=$((hour + 1))
            fi
        done
    done

    cat > "$PLIST_SRC" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${WRAPPER}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>

    <key>StartCalendarInterval</key>
    <array>
${entries}    </array>

    <key>RunAtLoad</key>
    <false/>

    <key>KeepAlive</key>
    <false/>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/data-refresh.out.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/data-refresh.err.log</string>

    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
PLIST
}

# --- Commands ---

install() {
    echo "Installing Data Refresh service..."
    echo ""

    # 1. Verify wrapper script exists
    if [[ ! -f "$WRAPPER" ]]; then
        echo "ERROR: Wrapper script not found at $WRAPPER"
        exit 1
    fi
    chmod +x "$WRAPPER"

    # 2. Verify Python scripts exist
    for script in scanner.py flow_analysis.py discover.py; do
        if [[ ! -f "$PROJECT_DIR/scripts/$script" ]]; then
            echo "ERROR: $script not found at $PROJECT_DIR/scripts/$script"
            exit 1
        fi
    done

    # 3. Create directories
    mkdir -p "$LOG_DIR"
    mkdir -p "$PROJECT_DIR/data"
    echo "  Log directory: $LOG_DIR"
    echo "  Data directory: data/"

    # 4. Generate plist
    echo "  Generating plist (205 schedule entries)..."
    generate_plist

    # 5. Validate plist
    if ! plutil -lint "$PLIST_SRC" > /dev/null 2>&1; then
        echo "ERROR: Generated plist is invalid"
        plutil -lint "$PLIST_SRC"
        exit 1
    fi
    echo "  Plist validated OK"

    # 6. Unload old service if present
    launchctl unload "$PLIST_DST" 2>/dev/null || true

    # 7. Install and load
    cp "$PLIST_SRC" "$PLIST_DST"
    launchctl load "$PLIST_DST"

    echo ""
    echo "Service installed and loaded."
    echo ""
    status
}

uninstall() {
    echo "Uninstalling Data Refresh service..."

    if [[ -f "$PLIST_DST" ]]; then
        launchctl unload "$PLIST_DST" 2>/dev/null || true
        rm -f "$PLIST_DST"
        echo "Service removed."
    else
        echo "Service not installed."
    fi
}

status() {
    echo "Data Refresh Service Status"
    echo "==========================="

    # Check plist installed
    if [[ ! -f "$PLIST_DST" ]]; then
        echo "Service: NOT INSTALLED"
        echo ""
        echo "Run: ./scripts/setup_data_refresh_service.sh install"
        return 1
    fi

    # Check launchctl
    if launchctl list 2>/dev/null | grep -q "$LABEL"; then
        echo "Service: LOADED"
    else
        echo "Service: NOT LOADED (plist exists but not loaded)"
    fi

    # Schedule
    echo "Schedule: Every 10 min, 9:30 AM – 4:10 PM ET, Mon-Fri"

    # Last refresh time for each data file
    for datafile in scanner.json flow_analysis.json discover.json; do
        local filepath="$PROJECT_DIR/data/$datafile"
        if [[ -f "$filepath" ]]; then
            local mtime
            mtime=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$filepath" 2>/dev/null || echo "unknown")
            echo "Last $datafile: $mtime"
        else
            echo "Last $datafile: (not yet written)"
        fi
    done

    # Recent logs
    if [[ -f "$LOG_DIR/data-refresh.out.log" ]]; then
        echo ""
        echo "Recent log:"
        tail -5 "$LOG_DIR/data-refresh.out.log" 2>/dev/null || echo "  (empty)"
    fi
}

logs() {
    echo "Tailing Data Refresh logs..."
    echo "(Ctrl+C to stop)"
    echo ""
    tail -f "$LOG_DIR"/data-refresh.out.log "$LOG_DIR"/data-refresh.err.log 2>/dev/null
}

start_now() {
    echo "Running data refresh manually..."
    exec bash "$WRAPPER"
}

# --- Main ---

case "${1:-status}" in
    install)
        install
        ;;
    uninstall)
        uninstall
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    start)
        start_now
        ;;
    *)
        echo "Usage: $0 {install|uninstall|status|logs|start}"
        exit 1
        ;;
esac
