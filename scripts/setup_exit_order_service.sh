#!/bin/bash
#
# Setup Exit Order Service
#
# Installs/uninstalls the launchd service for periodic exit order monitoring
#
# Usage:
#   ./scripts/setup_exit_order_service.sh install    # Install and start
#   ./scripts/setup_exit_order_service.sh uninstall  # Stop and uninstall
#   ./scripts/setup_exit_order_service.sh status     # Check status
#   ./scripts/setup_exit_order_service.sh logs       # View logs
#

set -e

SERVICE_NAME="com.convex-scavenger.exit-order-service"
PLIST_SOURCE="$(dirname "$0")/../config/${SERVICE_NAME}.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
LOG_DIR="$(dirname "$0")/../logs"

case "$1" in
    install)
        echo "Installing Exit Order Service..."
        
        # Create logs directory
        mkdir -p "$LOG_DIR"
        
        # Copy plist to LaunchAgents
        cp "$PLIST_SOURCE" "$PLIST_DEST"
        
        # Load the service
        launchctl load "$PLIST_DEST"
        
        echo "✓ Service installed and started"
        echo ""
        echo "The service will:"
        echo "  - Run immediately"
        echo "  - Run every 5 minutes"
        echo "  - Only place orders during market hours (9:30 AM - 4:00 PM ET)"
        echo ""
        echo "Logs: $LOG_DIR/"
        ;;
        
    uninstall)
        echo "Uninstalling Exit Order Service..."
        
        # Unload the service (ignore errors if not loaded)
        launchctl unload "$PLIST_DEST" 2>/dev/null || true
        
        # Remove the plist
        rm -f "$PLIST_DEST"
        
        echo "✓ Service uninstalled"
        ;;
        
    status)
        echo "Exit Order Service Status"
        echo "========================="
        
        if launchctl list | grep -q "$SERVICE_NAME"; then
            echo "Status: LOADED"
            launchctl list "$SERVICE_NAME" 2>/dev/null || echo "(Details not available)"
        else
            echo "Status: NOT LOADED"
        fi
        
        echo ""
        echo "Recent activity:"
        if [ -f "$LOG_DIR/exit-order-service.out.log" ]; then
            tail -20 "$LOG_DIR/exit-order-service.out.log"
        else
            echo "(No logs yet)"
        fi
        ;;
        
    logs)
        echo "Exit Order Service Logs"
        echo "======================="
        
        if [ -f "$LOG_DIR/exit-order-service.out.log" ]; then
            tail -f "$LOG_DIR/exit-order-service.out.log"
        else
            echo "No logs found at $LOG_DIR/exit-order-service.out.log"
        fi
        ;;
        
    run-once)
        echo "Running exit order check once..."
        python3 "$(dirname "$0")/exit_order_service.py"
        ;;
        
    *)
        echo "Usage: $0 {install|uninstall|status|logs|run-once}"
        echo ""
        echo "Commands:"
        echo "  install    - Install and start the launchd service"
        echo "  uninstall  - Stop and remove the launchd service"
        echo "  status     - Check if service is running and show recent logs"
        echo "  logs       - Tail the service logs (Ctrl+C to stop)"
        echo "  run-once   - Run a single check immediately"
        exit 1
        ;;
esac
