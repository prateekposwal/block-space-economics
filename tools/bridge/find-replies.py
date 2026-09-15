#!/usr/bin/env python3
"""
BSAHI — Reply Finder
====================
Finds replies to OUR comments on Reddit threads we engaged with.
Locates our comment (author New_Spare3193 / will) and checks for
replies under it. Returns the reply content + reply box location.
"""
import subprocess, base64, time, json, os, sys

REPO = '/Users/prateekposwal/block-space-economics'
OUR_USERNAMES = ['New_Spare3193']  # our Reddit account

def run_js(js_code, timeout=25):
    encoded = base64.b64encode(js_code.encode('utf-8')).decode('ascii')
    script = f'''
    on run
        set jsCode to do shell script "echo {encoded} | base64 --decode"
        tell application "Google Chrome"
            set theResult to execute active tab of front window javascript jsCode
            return theResult
        end tell
    end run
    '''
    try:
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip() if result.returncode == 0 else "ERR"
    except: return "TIMEOUT"

def osa(script, timeout=15):
    try: subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=timeout)
    except: pass

def find_replies(thread_url):
    """Open thread, find our comment, check for replies to it. Returns reply text + author."""
    osa('tell application "Google Chrome" to make new tab at end of tabs of front window')
    time.sleep(1)
    osa(f'tell application "Google Chrome" to set URL of active tab of front window to "{thread_url}"')
    time.sleep(11)

    result = run_js(r"""
    (function() {
      // Find all comment blocks; identify ours and any replies directly under it
      var ourName = 'New_Spare3193';
      // Get all comment text with authors
      var comments = [];
      // Reddit comment structure: <shreddit-comment> or div with author
      document.querySelectorAll('shreddit-comment, [id^="t1_"], [class*="comment"]').forEach(function(el) {
        var text = (el.innerText||'').slice(0, 200);
        var isOurs = text.includes('New_Spare3193');
        comments.push({isOurs: isOurs, text: text.slice(0, 120), id: el.id});
      });
      // Check for reply buttons
      var replyBtns = document.querySelectorAll('button[aria-label*="Reply"], [data-testid*="reply"]').length;
      return JSON.stringify({commentCount: comments.length, replyBtns: replyBtns, sample: comments.slice(0, 3)});
    })()
    """)
    osa('tell application "Google Chrome" to close active tab of front window')
    return result

if __name__ == '__main__':
    url = sys.argv[1] if len(sys.argv) > 1 else None
    if url:
        print(find_replies(url))
    else:
        # Check all our threads
        state = json.load(open(os.path.join(REPO, 'captured-data', 'comment-state.json')))
        threads = state.get('commented_threads', [])
        for t in threads:
            print(f"--- {t[:50]} ---")
            print(find_replies(t))
            time.sleep(2)
