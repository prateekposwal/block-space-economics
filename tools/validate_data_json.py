#!/usr/bin/env python3
"""
validate_data_json.py — THE single canonical JSON-integrity + conflict-marker gate.

PATTERN-FIX (root cause): the "data files must parse and must not contain merge
conflict markers" check was DUPLICATED ad-hoc across four data-committing paths
(data-snapshot.yml, research-data.yml, 19-web-snapshot-agent.js, and
git_automator.py had NO gate at all). The duplication drifted: the JS agent
validated only 4 files and MISSED the sccr files, and git_automator was
ungated. That drift is exactly how a stash-pop conflict shipped markers into
data/. This file is the ONE ignition-check every data-committing path calls, so
a fix in one place fixes the pattern for all.

Usage (exit 0 = clean, exit 1 = REJECT — commit must not proceed):
    python3 tools/validate_data_json.py [path...]
    - no args: scan ./data/*.json + ./research/reproduce/input/*.json
    - explicit paths: scan exactly those

Fails closed on: any JSON parse error OR any file containing merge-conflict
marker lines (<<<<<<< ======= >>>>>>>). Prints each offending file to stderr.
"""
import json
import sys

MARKERS = ('<<<<<<<', '=======', '>>>>>>>')


def is_json(path, text):
    try:
        json.loads(text)
        return None
    except Exception as e:  # noqa: BLE001 - report any parse failure verbatim
        return 'JSON parse error: {}'.format(e)


def validate(path):
    """Return an error string for a single file, or None if it is clean."""
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            text = fh.read()
    except OSError as e:
        return 'cannot read: {}'.format(e)
    for marker in MARKERS:
        if marker in text:
            return 'contains conflict marker {!r}'.format(marker)
    return is_json(path, text)


def main(argv):
    if argv:
        targets = argv
    else:
        import glob
        targets = sorted(glob.glob('data/*.json')) + \
            sorted(glob.glob('research/reproduce/input/*.json'))
    errors = {}
    for path in targets:
        err = validate(path)
        if err:
            errors[path] = err
    if errors:
        sys.stderr.write('INVALID DATA — commit REJECTED:\n')
        for path, err in sorted(errors.items()):
            sys.stderr.write('  - {} : {}\n'.format(path, err))
        return 1
    sys.stderr.write('validate_data_json: OK ({} file(s) clean)\n'.format(len(targets)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
