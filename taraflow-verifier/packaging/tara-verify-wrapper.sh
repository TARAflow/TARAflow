#!/bin/sh
# packaging/tara-verify-wrapper.sh
# Installiert als /usr/bin/taraflow-verify — startet das esbuild-Bundle mit node.
# `exec` ersetzt die Shell durch node, sodass dessen Exit-Code (0 pass / 1 findings
# / 2 usage / 3 engine) unverändert an den Aufrufer/CI durchgereicht wird.
exec node /usr/lib/tara-verify/taraflow-verify.js "$@"
