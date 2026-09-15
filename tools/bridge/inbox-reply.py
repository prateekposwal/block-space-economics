#!/usr/bin/env python3
"""
BSAHI — Inbox Reply Engine
==========================
Uses Reddit's inbox (via the logged-in browser session) to find replies
to OUR comments, then replies to each. This is reliable because Reddit
sends an inbox notification for every reply to our comments.
"""
import subprocess, base64, time, json, os, sys, random

REPO = '/Users/prateekposwal/block-space-economics'
REPLY_STATE = os.path.join(REPO, 'captured-data', 'reply-state.json')

def run_js(js_code, timeout=30):
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

def load_reply_state():
    try:
        with open(REPLY_STATE) as f: return json.load(f)
    except:
        return {'replied': {}, 'replies_today': 0, 'day': ''}

def save_reply_state(s):
    with open(REPLY_STATE, 'w') as f: json.dump(s, f)

def get_inbox():
    """Fetch unread inbox messages via the browser session (fetch from reddit.com)."""
    osa('tell application "Google Chrome" to make new tab at end of tabs of front window')
    time.sleep(1)
    osa('tell application "Google Chrome" to set URL of active tab of front window to "https://www.reddit.com/"')
    time.sleep(6)
    # Use fetch to get inbox JSON (same origin, has session cookie)
    kick = run_js(r"""
    (function() {
      window.__inbox = 'loading';
      fetch('https://www.reddit.com/message/inbox.json?limit=25', { credentials: 'include' })
        .then(function(r) { return r.json(); })
        .then(function(d) { window.__inbox = JSON.stringify(d); })
        .catch(function(e) { window.__inbox = 'ERR:' + e.message; });
      return 'started';
    })()
    """)
    time.sleep(5)
    result = run_js("window.__inbox ? window.__inbox.slice(0, 50) : 'none'")
    full = run_js("window.__inbox || 'none'")
    osa('tell application "Google Chrome" to close active tab of front window')
    try:
        data = json.loads(full)
        return data.get('data', {}).get('children', [])
    except:
        return []

def parse_inbox_replies(children):
    """Extract replies to our comments from inbox data."""
    replies = []
    for child in children:
        d = child.get('data', {})
        kind = child.get('kind', '')
        if kind == 't1':  # comment
            replies.append({
                'author': d.get('author', ''),
                'body': d.get('body', '')[:200],
                'subject': d.get('subject', ''),
                'context': d.get('context', ''),
                'link_title': d.get('link_title', ''),
                'name': d.get('name', ''),
                'created_utc': d.get('created_utc', 0)
            })
    return replies

def reply_to(thread_context, reply_text):
    """Open the thread context and reply."""
    # context looks like /r/Bitcoin/comments/xxx/title/comment_id/
    thread_url = 'https://www.reddit.com' + thread_context.split('/comment/')[0] + '/'
    osa('tell application "Google Chrome" to make new tab at end of tabs of front window')
    time.sleep(1)
    osa(f'tell application "Google Chrome" to set URL of active tab of front window to "{thread_url}"')
    time.sleep(10)

    # Find and click Reply on the relevant comment
    opened = run_js(r"""
    (function() {
      var btns = document.querySelectorAll('button[aria-label*="Reply"], [data-testid*="reply"]');
      if (btns.length) { btns[btns.length-1].click(); return 'opened'; }
      return 'NO_BTN';
    })()
    """)
    time.sleep(2)
    if opened == 'NO_BTN':
        osa('tell application "Google Chrome" to close active tab of front window')
        return None

    filled = run_js(r"""
    (function() {
      var box = document.querySelector('[contenteditable="true"][data-testid], [role="textbox"], textarea');
      if (!box) return 'NO_BOX';
      box.focus();
      return 'focused';
    })()
    """)
    if filled == 'NO_BOX':
        osa('tell application "Google Chrome" to close active tab of front window')
        return None
    time.sleep(1)
    subprocess.run(['pbcopy'], input=reply_text.encode(), timeout=10)
    osa('tell application "Google Chrome" to activate')
    time.sleep(0.3)
    osa('tell application "System Events" to keystroke "v" using command down')
    time.sleep(1.5)
    submitted = run_js(r"""
    (function() {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].innerText||'').trim();
        if (t === 'Reply' && !btns[i].disabled) { btns[i].click(); return 'REPLIED'; }
      }
      return 'NO_BTN';
    })()
    """)
    time.sleep(5)
    osa('tell application "Google Chrome" to close active tab of front window')
    return submitted

def build_reply(reply, data):
    """Build a graceful, in-domain reply to someone who replied to us."""
    # Acknowledge them, address their point, share data, invite more
    templates = [
        "Thanks for the thoughtful reply — this is exactly the kind of pushback that sharpens the work. On your point: the live data currently shows fees at {f} sat/vB and the mempool at {m} MB. Your perspective is fair, and it makes the longer-term question even more interesting. Curious if your observations match ours.",
        "Appreciate you engaging with this. You are right to push — our figures are early and directional. We are extending the dataset precisely so the conclusion can be tested. If the fee share grows, the thesis strengthens; if not, we update. That is the honest way to build research.",
        "Good challenge, and fair. We capture the network continuously precisely to avoid single-snapshot mistakes — the current read is {m} MB mempool at {f} sat/vB. Happy to share the raw data if useful, and we will post an update if the pattern shifts.",
        "Really glad you replied. The data supports part of your argument — {b} txs in the last block, fees still modest. Where we differ is what that implies going forward. That is exactly the kind of question worth watching over the next few cycles."
    ]
    return random.choice(templates).format(f=data['f'], m=data['m'], b=data['b'])

def get_live_data():
    try:
        r = subprocess.run(['node', '-e', '''
            var fs=require('fs'),path=require('path');
            var bf='captured-data/backfill';
            var dirs=fs.readdirSync(bf).filter(d=>d.startsWith('2026')).sort();
            var dd=path.join(bf,dirs[dirs.length-1]);
            var fs2=fs.readdirSync(dd).filter(f=>f.endsWith('.json')).sort();
            var c=JSON.parse(fs.readFileSync(path.join(dd,fs2[fs2.length-1]),'utf8'));
            var f=c.endpoints.fees.data||{}, m=c.endpoints.mempool.data||{}, b=c.endpoints.blocks.data||[];
            console.log(JSON.stringify({f:f.fastestFee, m:(m.vsize?Math.round(m.vsize/1e6):0), b:(b[0]?b[0].tx_count:0)}));
        '''], capture_output=True, text=True, timeout=10, cwd=REPO)
        return json.loads(r.stdout)
    except:
        return {'f': 3, 'm': 40, 'b': 3800}

def run_cycle():
    reply_state = load_reply_state()
    today = time.strftime('%Y-%m-%d')
    if reply_state['day'] != today:
        reply_state = {'replied': {}, 'replies_today': 0, 'day': today}

    data = get_live_data()
    inbox = get_inbox()
    replies = parse_inbox_replies(inbox)
    print(f"Inbox: {len(replies)} messages")

    # Filter: only replies to our comments (t1), not already replied to
    to_reply = [r for r in replies if r['name'] not in reply_state.get('replied', {}) and r.get('subject', '').lower() not in ['username mention']]
    print(f"To reply: {len(to_reply)}")

    for r in to_reply[:5]:
        if reply_state['replies_today'] >= 10:
            break
        print(f"Replying to {r['author']} on: {r['link_title'][:40]}")
        result = reply_to(r.get('context', ''), build_reply(r, data))
        if result and 'REPLIED' in result:
            reply_state['replied'][r['name']] = time.time()
            reply_state['replies_today'] += 1
            save_reply_state(reply_state)
            print(f"  ✓ Replied #{reply_state['replies_today']}")
        time.sleep(random.randint(30, 90))

    save_reply_state(reply_state)
    print(f"Replies today: {reply_state['replies_today']}")

if __name__ == '__main__':
    run_cycle()
