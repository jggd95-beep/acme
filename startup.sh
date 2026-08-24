#!/bin/sh
set -eu
cd /workspace

healthy() {
  curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/
}

# Real vite only — never match this shell's command line
kill_vite() {
  for d in /proc/[0-9]*; do
    pid=${d#/proc/}
    [ "$pid" = "$$" ] && continue
    cmd=$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null || true)
    case "$cmd" in
      node\ /workspace/node_modules/.bin/vite*|node\ *vite\ dev*|sh\ -c\ vite\ dev*)
        kill -9 "$pid" 2>/dev/null || true
        ;;
    esac
  done
}

hourly_up() {
  for d in /proc/[0-9]*; do
    cmd=$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null || true)
    case "$cmd" in
      *hourly-save.sh*) return 0 ;;
    esac
  done
  return 1
}

if ! hourly_up; then
  sh /workspace/scripts/hourly-save.sh >>/tmp/hourly-save.log 2>&1 &
fi

if healthy; then
  exit 0
fi

# Process up but not answering = the frozen preview. Kill and start clean.
kill_vite
sleep 1

npm run dev >>/tmp/app-startup.log 2>&1 &

i=0
while [ "$i" -lt 40 ]; do
  if healthy; then
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done
# Leave it running; platform will retry. Do not pretend we are healthy.
exit 1
