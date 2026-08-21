#!/usr/bin/env python3
"""
Git Automator — commit, branch, PR, and merge via GitHub API.
Usage: python3 tools/git_automator.py <command> [args]

Commands:
  commit-branch <branch-name> "commit message"   — stage all, commit, push, create PR
  merge-pr <pr-number>                           — merge an open PR (requires your approval)
  status                                         — check open PRs and branch state

Requires GITHUB_TOKEN env var or ~/.github_token file.
"""
import os, sys, subprocess, json, urllib.request

REPO = 'prateekposwal/block-space-economics'

def get_token():
    token = os.environ.get('GITHUB_TOKEN')
    if not token:
        try:
            with open(os.path.expanduser('~/.github_token')) as f:
                token = f.read().strip()
        except:
            pass
    if not token:
        print("❌ No GitHub token found. Set GITHUB_TOKEN env var or create ~/.github_token")
        sys.exit(1)
    return token

def gh_api(path, data=None, method=None):
    token = get_token()
    url = f'https://api.github.com/repos/{REPO}/{path}'
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    }
    req = urllib.request.Request(url, headers=headers, method=method)
    if data is not None:
        req.data = json.dumps(data).encode()
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ API Error {e.code}: {e.reason}")
        if body:
            try:
                msg = json.loads(body)
                print(f"   {msg.get('message', body[:200])}")
            except:
                print(f"   {body[:200]}")
        return None

def cmd_status():
    # Check open PRs
    prs = gh_api('pulls?state=open')
    if prs:
        print(f"\nOpen PRs ({len(prs)}):")
        for pr in prs:
            print(f"  #{pr['number']}: {pr['title'][:60]} — {pr['html_url']}")
    else:
        print("No open PRs.")
    
    # Check local branch state
    result = subprocess.run(['git', 'status', '--short'], capture_output=True, text=True)
    if result.stdout.strip():
        print(f"\nLocal changes:\n{result.stdout[:200]}")

def cmd_commit_branch(branch_name, commit_msg):
    # Validate inputs
    if not branch_name or not commit_msg:
        print("❌ Usage: commit-branch <branch-name> 'commit message'")
        return
    
    branch = f'chore/{branch_name}'
    
    # Check if branch already exists
    result = subprocess.run(['git', 'rev-parse', '--verify', branch], capture_output=True, text=True)
    if result.returncode == 0:
        print(f"⚠ Branch '{branch}' exists. Switching to it.")
        subprocess.run(['git', 'checkout', branch])
    else:
        result = subprocess.run(['git', 'checkout', '-b', branch], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Failed to create branch: {result.stderr}")
            return
    
    # Data-integrity gate (single canonical script — json.parse + conflict
    # markers). Reject the commit before staging anything if any data file is
    # malformed; this path previously had NO gate and could push broken data.
    gate = subprocess.run(
        ['python3', 'tools/validate_data_json.py'],
        capture_output=True, text=True)
    if gate.returncode != 0:
        print('❌ Data integrity gate REJECTED the commit (nothing staged):')
        print(gate.stderr)
        return

    # Stage all
    subprocess.run(['git', 'add', '-A'])
    
    # Commit
    result = subprocess.run(['git', 'commit', '-m', commit_msg, '--no-verify'], capture_output=True, text=True)
    if result.returncode != 0:
        # Check if there's nothing to commit
        status = subprocess.run(['git', 'status', '--short'], capture_output=True, text=True)
        if not status.stdout.strip():
            print("⚠ Nothing to commit — no changes detected.")
            return
        print(f"❌ Commit failed: {result.stderr[:200]}")
        return
    
    # Push
    result = subprocess.run(['git', 'push', 'origin', branch], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Push failed: {result.stderr[:200]}")
        return
    
    # Create PR
    pr_data = {
        'title': commit_msg,
        'head': branch,
        'base': 'main',
        'body': f'Automated via git_automator.py\n\nCommit: {commit_msg}',
    }
    pr = gh_api('pulls', data=pr_data)
    if pr:
        print(f"✅ PR created: {pr['html_url']}")
        print(f"   Visit the URL and click 'Merge pull request'")
    else:
        print("❌ PR creation failed.")

def cmd_merge_pr(pr_number):
    try:
        num = int(pr_number)
    except:
        print("❌ PR number must be an integer")
        return
    
    pr = gh_api(f'pulls/{num}')
    if not pr:
        return
    
    if pr.get('merged'):
        print(f"⚠ PR #{num} is already merged.")
        return
    
    if pr.get('state') != 'open':
        print(f"⚠ PR #{num} is not open (state: {pr.get('state')}).")
        return
    
    print(f"PR #{num}: {pr['title']}")
    print(f"  Can merge via API: you need to approve first.")
    print(f"  Visit: {pr['html_url']}")
    print(f"  Click 'Merge pull request' → 'Confirm merge'")

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    command = sys.argv[1]
    
    if command == 'status':
        cmd_status()
    elif command == 'commit-branch' and len(sys.argv) >= 4:
        cmd_commit_branch(sys.argv[2], sys.argv[3])
    elif command == 'merge-pr' and len(sys.argv) >= 3:
        cmd_merge_pr(sys.argv[2])
    else:
        print(__doc__)

if __name__ == '__main__':
    main()
