#!/bin/sh
# packaging/tara-report-wrapper.sh
# Installiert als /usr/bin/taraflow-report — startet das esbuild-Bundle mit node.
exec node /usr/lib/tara-report/taraflow-report.js "$@"
