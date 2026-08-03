#!/usr/bin/env python3
"""Apple iOS 27 UI Kit(.sketch) → 컴포넌트 실측표(markdown) 생성기."""
import json, re
from collections import defaultdict

SK = '/private/tmp/claude-501/-private-tmp/53811950-5e4f-44f1-824d-287f202951e0/scratchpad/sketch-kit'
meta = json.load(open(f'{SK}/meta.json'))
PAGES = {v.get('name'): k for k, v in meta['pagesAndArtboards'].items()}

def load_page(sub):
    pid = next((v for k, v in PAGES.items() if sub in k), None)
    return json.load(open(f'{SK}/pages/{pid}.json')) if pid else None

def texts_of(l, acc):
    if l.get('_class') == 'text':
        a = ((((l.get('style') or {}).get('textStyle') or {}).get('encodedAttributes') or {}).get('MSAttributedStringFontAttribute') or {}).get('attributes', {})
        if a.get('name'): acc.add(f"{a.get('name')} {a.get('size')}")
    for c in l.get('layers') or []:
        texts_of(c, acc)

def radii_of(l, acc):
    if l.get('_class') in ('rectangle',):
        pts = l.get('points') or []
        if pts and pts[0].get('cornerRadius') not in (None, 0):
            acc.add(pts[0]['cornerRadius'])
    for c in l.get('layers') or []:
        radii_of(c, acc)

def summarize(page_sub, name_filter, exclude=('Dark', 'Examples'), limit=200):
    p = load_page(page_sub)
    if not p: return []
    rows = []
    for l in p.get('layers', []):
        nm = l.get('name') or ''
        if l.get('_class') not in ('symbolMaster', 'artboard'): continue
        if name_filter and name_filter not in nm: continue
        if any(x in nm for x in exclude): continue
        f = l.get('frame', {})
        fonts, rads = set(), set()
        texts_of(l, fonts); radii_of(l, rads)
        rows.append((nm, f.get('width'), f.get('height'),
                     ', '.join(sorted(fonts))[:60], ', '.join(str(round(r,1)) for r in sorted(rads))[:40]))
        if len(rows) >= limit: break
    return rows

def dedupe_by_size(rows):
    """같은 변형 계열은 크기별 대표만"""
    seen, out = set(), []
    for nm, w, h, fonts, rads in rows:
        base = re.sub(r'/(Leading|Trailing|Symbol \d|Text|Left.*|Active|Inactive|Value|Placeholder).*$', '', nm)
        key = (base, w, h)
        if key in seen: continue
        seen.add(key); out.append((nm, w, h, fonts, rads))
    return out

SECTIONS = [
    ('Lists', 'Lists', 'Lists/'),
    ('Buttons', 'Buttons', 'Buttons/'),
    ('Toolbars', 'Toolbars', 'Toolbars/'),
    ('Tab Bars', 'Tab Bars', 'Tab Bar'),
    ('Sheets', 'Sheets', 'Sheet'),
    ('Alerts', 'Alerts', 'Alert'),
    ('Action Sheets', 'Action Sheets', 'Action Sheet'),
    ('Text Fields', 'Text Fields', 'Text Field'),
    ('Segmented Controls', 'Segmented Controls', 'Segmented'),
    ('Menus', 'Menus', 'Menu'),
    ('Sidebars', 'Sidebars', 'Sidebar'),
    ('Popovers', 'Popovers', 'Popover'),
]

out = ['# Apple iOS 27 컴포넌트 실측표 (자동 추출)', '',
       '출처: Apple iOS 27 UI Kit 공식 .sketch (Sketch 2026.2) — Light 변형 기준.',
       '수치 단위 pt. 이 표가 화면 코딩·감사의 1차 기준이며, 규범(언제 무엇을)은 apple-hig 스킬 참조.', '']
for title, page, filt in SECTIONS:
    rows = dedupe_by_size(summarize(page, filt))
    if not rows: continue
    out.append(f'## {title}')
    out.append('| 컴포넌트 | W×H | 폰트 | 라디우스 |')
    out.append('|---|---|---|---|')
    for nm, w, h, fonts, rads in rows[:40]:
        short = nm.replace('Light/', '').replace('􀻃/', '')
        out.append(f'| {short[:58]} | {w}×{h} | {fonts or "—"} | {rads or "—"} |')
    out.append('')

doc = '\n'.join(out)
open('/private/tmp/claude-501/-private-tmp/53811950-5e4f-44f1-824d-287f202951e0/scratchpad/apple-blueprints.md', 'w').write(doc)
print(f"생성 완료: {len(doc.splitlines())}줄")
for line in doc.splitlines()[:5]: print(line)
