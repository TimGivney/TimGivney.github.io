#!/usr/bin/env python3
"""Build /meridian reader pages (HTML) and PDFs from tools/meridian/docs/*.md.

Usage: python3 tools/meridian/build.py            # HTML only
       python3 tools/meridian/build.py --pdf      # HTML + PDFs (needs google-chrome)
Requires: pip install markdown
"""
import glob, os, re, subprocess, sys, html
import markdown

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools/meridian/docs')
OUT = os.path.join(ROOT, 'client/public/meridian')
READ = os.path.join(OUT, 'read')
CANON = '  <p class="canon">This document follows <a href="meridian-charter.html">The Meridian Charter</a>. Where any document in the archive differs from the Charter, the Charter governs.</p>\n'
HUMANINITY = 'the unexplainable truths and values that a functional human is. The quality the Custodian Lottery Republic exists to protect.'

TEMPLATE = open(os.path.join(ROOT, 'tools/meridian/template.html')).read()

def build(path, pdf=False):
    slug = os.path.basename(path)[:-3]
    md = open(path, encoding='utf-8').read()
    title = re.search(r'^# (.+)$', md, re.M).group(1).strip()
    body_md = re.sub(r'^# .+\n', '', md, count=1, flags=re.M)
    meta = ''
    m = re.match(r'\s*\*\*Author:\*\*(.*?)\n', body_md)
    if m:
        meta = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', m.group(1)).strip()
        body_md = body_md[m.end():]
    body = markdown.markdown(body_md, extensions=['tables', 'smarty'])
    # heading ids + toc
    toc = []
    def hid(mo):
        level, text = mo.group(1), mo.group(2)
        plain = re.sub(r'<[^>]+>', '', text)
        anchor = re.sub(r'[^a-z0-9]+', '-', html.unescape(plain).lower()).strip('-')[:60]
        if level == '2':
            toc.append(f'<li><a href="#{anchor}">{plain}</a></li>')
        return f'<h{level} id="{anchor}">{text}</h{level}>'
    body = re.sub(r'<h([23])>(.*?)</h\1>', hid, body)
    desc = re.sub(r'<[^>]+>', '', re.search(r'<p>(.*?)</p>', body, re.S).group(1))[:300]
    page = (TEMPLATE.replace('{{title}}', html.escape(title))
            .replace('{{desc}}', html.escape(html.unescape(desc)))
            .replace('{{slug}}', slug)
            .replace('{{meta}}', meta)
            .replace('{{humaninity}}', HUMANINITY)
            .replace('{{canon}}', '' if slug == 'meridian-charter' else CANON)
            .replace('{{toc}}', '\n'.join(toc))
            .replace('{{body}}', body))
    os.makedirs(READ, exist_ok=True)
    out_html = os.path.join(READ, slug + '.html')
    open(out_html, 'w', encoding='utf-8').write(page)
    if pdf:
        subprocess.run(['google-chrome', '--headless=new', '--disable-gpu', '--no-sandbox',
                        '--no-pdf-header-footer', '--print-to-pdf=' + os.path.join(OUT, slug + '.pdf'),
                        'file://' + out_html], check=True, capture_output=True)
    return slug, title

if __name__ == '__main__':
    pdf = '--pdf' in sys.argv
    for f in sorted(glob.glob(os.path.join(SRC, '*.md'))):
        print(*build(f, pdf))
